import { CONTACT_ACTIVITY_TYPES, LEAD_SOURCES, LEAD_STAGES, OPEN_STAGES } from "../constants";
import { buildBuckets, countByBucket, daysBetween, startOfDay, type RangeKey } from "../dates";
import type { Activity, Database, Lead, LeadSource, LeadStage, LeadTemperature } from "../types";
import { ratio } from "../utils";

/** Regra explícita: temperatura deriva da etapa do funil. Perdidos não entram. */
export function temperatureOf(stage: LeadStage): LeadTemperature | null {
  switch (stage) {
    case "novo":
    case "qualificado":
      return "frio";
    case "contatado":
    case "respondeu":
      return "morno";
    case "diagnostico":
    case "proposta":
    case "negociacao":
      return "quente";
    case "ganho":
      return "convertido";
    default:
      return null;
  }
}

/**
 * Score de oportunidade 0–100, sempre acompanhado dos motivos:
 * situação do site (até 40) + prioridade (até 30) + temperatura (até 30).
 */
export function leadScore(lead: Lead): { score: number; reasons: string[] } {
  const site = { sem_site: 40, desatualizado: 30, sem_mobile: 25, adequado: 5 }[lead.websiteSituation];
  const prio = { alta: 30, media: 20, baixa: 10 }[lead.priority];
  const temp = temperatureOf(lead.stage);
  const t = temp === "quente" ? 30 : temp === "morno" ? 20 : temp === "frio" ? 10 : 0;
  const siteLabel = { sem_site: "não tem site", desatualizado: "site desatualizado", sem_mobile: "site sem versão mobile", adequado: "site já adequado" }[lead.websiteSituation];
  return {
    score: site + prio + t,
    reasons: [`+${site}: ${siteLabel}`, `+${prio}: prioridade ${lead.priority === "media" ? "média" : lead.priority}`, `+${t}: ${temp ? `lead ${temp}` : "fora do funil"}`],
  };
}

export function temperatureDistribution(leads: Lead[]) {
  const out: Record<LeadTemperature, number> = { frio: 0, morno: 0, quente: 0, convertido: 0 };
  for (const l of leads) {
    const t = temperatureOf(l.stage);
    if (t) out[t]++;
  }
  return out;
}

export function sourceDistribution(leads: Lead[]) {
  const counts = Object.fromEntries(LEAD_SOURCES.map((s) => [s, 0])) as Record<LeadSource, number>;
  for (const l of leads) counts[l.source]++;
  const total = leads.length;
  return LEAD_SOURCES.map((source) => ({ source, count: counts[source], share: ratio(counts[source], total) }));
}

export function stageDistribution(leads: Lead[]) {
  return LEAD_STAGES.map((stage) => ({ stage, count: leads.filter((l) => l.stage === stage).length }));
}

export const isContactActivity = (a: Activity) => !!a.completedAt && !!a.leadId && CONTACT_ACTIVITY_TYPES.includes(a.type);

const stageIndex = (s: LeadStage) => LEAD_STAGES.indexOf(s);

/**
 * Funil acumulado: um lead em "proposta" já passou por "contatado".
 * Perdidos contam até a etapa alcançada (aproximação: contados como contatados se tiveram contato).
 */
export function funnel(db: Database) {
  const leads = db.leads;
  const contacted = new Set(db.activities.filter(isContactActivity).map((a) => a.leadId));
  const withProposal = new Set(db.proposals.filter((p) => p.status !== "rascunho" && p.status !== "pronta" && p.leadId).map((p) => p.leadId));
  const reached = (l: Lead, s: LeadStage) => l.stage !== "perdido" && stageIndex(l.stage) >= stageIndex(s);
  const total = leads.length;
  const contactedCount = leads.filter((l) => contacted.has(l.id) || reached(l, "contatado")).length;
  const proposalCount = leads.filter((l) => withProposal.has(l.id) || reached(l, "proposta")).length;
  const won = leads.filter((l) => l.stage === "ganho").length;
  return {
    total,
    contacted: contactedCount,
    proposals: proposalCount,
    won,
    /** Vendas ÷ leads cadastrados. */
    conversion: ratio(won, total),
    steps: [
      { key: "leads", label: "Leads cadastrados", value: total },
      { key: "contatos", label: "Contatados", value: contactedCount },
      { key: "propostas", label: "Com proposta", value: proposalCount },
      { key: "vendas", label: "Vendas fechadas", value: won },
    ],
  };
}

export function capturedSeries(leads: Lead[], range: RangeKey, now = new Date()) {
  const buckets = buildBuckets(range, now);
  return { buckets, values: countByBucket(buckets, leads.map((l) => l.createdAt)) };
}

/** Leads abertos sem nenhum contato registrado. */
export function leadsWithoutContact(leads: Lead[]) {
  return leads.filter((l) => OPEN_STAGES.includes(l.stage) && !l.lastContactAt);
}

export function pendingFollowUps(activities: Activity[], now = new Date()) {
  const today = startOfDay(now);
  return activities
    .filter((a) => a.type === "follow_up" && !a.completedAt && a.dueAt)
    .map((a) => ({ activity: a, overdue: new Date(a.dueAt as string) < today, dueInDays: daysBetween(now, a.dueAt as string) }))
    .sort((a, b) => (a.activity.dueAt as string).localeCompare(b.activity.dueAt as string));
}

/** Contagem diária de atividades concluídas (contatos e tarefas) para heatmap. */
export function activityHeatmap(activities: Activity[], weeks: number, now = new Date(), filter: (a: Activity) => boolean = () => true) {
  const today = startOfDay(now);
  // Coluna = semana (segunda a domingo), linha = dia da semana.
  const dow = (today.getDay() + 6) % 7; // 0 = segunda
  const lastMonday = new Date(today);
  lastMonday.setDate(today.getDate() - dow);
  const firstMonday = new Date(lastMonday);
  firstMonday.setDate(lastMonday.getDate() - (weeks - 1) * 7);
  const grid: { date: Date; count: number; future: boolean }[][] = Array.from({ length: 7 }, (_, row) =>
    Array.from({ length: weeks }, (_, col) => {
      const date = new Date(firstMonday);
      date.setDate(firstMonday.getDate() + col * 7 + row);
      return { date, count: 0, future: date > today };
    }),
  );
  for (const a of activities) {
    if (!a.completedAt || !filter(a)) continue;
    const d = startOfDay(a.completedAt);
    const diff = Math.round((d.getTime() - firstMonday.getTime()) / 86_400_000);
    if (diff < 0) continue;
    const col = Math.floor(diff / 7);
    const row = diff % 7;
    if (col < weeks) grid[row][col].count++;
  }
  const weekStarts = Array.from({ length: weeks }, (_, col) => {
    const d = new Date(firstMonday);
    d.setDate(firstMonday.getDate() + col * 7);
    return d;
  });
  const max = Math.max(0, ...grid.flat().map((c) => c.count));
  return { grid, weekStarts, max };
}
