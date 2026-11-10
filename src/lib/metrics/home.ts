import { OPEN_STAGES } from "../constants";
import { addDays, buildBuckets, countByBucket, daysBetween, startOfDay, type RangeKey } from "../dates";
import type { Database } from "../types";
import { clamp, ratio } from "../utils";
import { openAmount, transactionStatus } from "./finance";
import { isContactActivity, leadsWithoutContact, pendingFollowUps } from "./leads";
import { projectDeadline } from "./projects";

export function commercialSeries(db: Database, range: RangeKey, now = new Date()) {
  const buckets = buildBuckets(range, now);
  return {
    buckets,
    leads: countByBucket(buckets, db.leads.map((l) => l.createdAt)),
    contacts: countByBucket(buckets, db.activities.filter(isContactActivity).map((a) => a.completedAt)),
    proposals: countByBucket(buckets, db.proposals.map((p) => p.sentAt)),
  };
}

export interface RadarAxis {
  key: string;
  label: string;
  /** 0–100, ou null quando não há base para calcular. */
  value: number | null;
  formula: string;
  detail: string;
}

/**
 * Desempenho comercial dos últimos 30 dias, cada eixo normalizado 0–100 por
 * uma razão explícita (unidades incompatíveis nunca são comparadas cruas).
 */
export function commercialRadar(db: Database, now = new Date()): RadarAxis[] {
  const since = addDays(startOfDay(now), -30).getTime();
  const recent = (iso: string | null | undefined) => !!iso && new Date(iso).getTime() >= since;

  const newLeads = db.leads.filter((l) => recent(l.createdAt));
  const target = db.settings.monthlyLeadTarget;
  const qualified = newLeads.filter((l) => l.stage !== "novo");

  const open = db.leads.filter((l) => OPEN_STAGES.includes(l.stage));
  const openContacted = open.filter((l) => !!l.lastContactAt);

  const contacted = db.leads.filter((l) => !!l.lastContactAt);
  const proposed = new Set(db.proposals.filter((p) => p.status !== "rascunho" && p.status !== "pronta").map((p) => p.leadId));
  const contactedWithProposal = contacted.filter((l) => proposed.has(l.id));

  const decided = db.proposals.filter((p) => (p.status === "aprovada" || p.status === "recusada") && recent(p.decidedAt));
  const approved = decided.filter((p) => p.status === "aprovada");

  const followDone = db.activities.filter((a) => a.type === "follow_up" && a.completedAt && recent(a.completedAt));
  const followOverdue = pendingFollowUps(db.activities, now).filter((f) => f.overdue);

  const pct = (v: number | null) => (v === null ? null : Math.round(clamp(v, 0, 100)));

  return [
    {
      key: "prospeccao",
      label: "Prospecção",
      value: pct(ratio(newLeads.length, target)),
      formula: "Leads captados em 30 dias ÷ meta mensal",
      detail: `${newLeads.length} de ${target}`,
    },
    {
      key: "qualificacao",
      label: "Qualificação",
      value: pct(ratio(qualified.length, newLeads.length)),
      formula: "Leads novos (30 dias) que saíram da etapa Novo",
      detail: `${qualified.length} de ${newLeads.length}`,
    },
    {
      key: "contatos",
      label: "Contatos",
      value: pct(ratio(openContacted.length, open.length)),
      formula: "Leads em aberto com ao menos um contato registrado",
      detail: `${openContacted.length} de ${open.length}`,
    },
    {
      key: "propostas",
      label: "Propostas",
      value: pct(ratio(contactedWithProposal.length, contacted.length)),
      formula: "Leads contatados que receberam proposta",
      detail: `${contactedWithProposal.length} de ${contacted.length}`,
    },
    {
      key: "conversao",
      label: "Conversão",
      value: pct(ratio(approved.length, decided.length)),
      formula: "Propostas aprovadas ÷ decididas (30 dias)",
      detail: `${approved.length} de ${decided.length}`,
    },
    {
      key: "followups",
      label: "Follow-ups",
      value: pct(ratio(followDone.length, followDone.length + followOverdue.length)),
      formula: "Follow-ups feitos (30 dias) ÷ feitos + vencidos",
      detail: `${followDone.length} feitos, ${followOverdue.length} vencidos`,
    },
  ];
}

export function nextActions(db: Database, now = new Date()) {
  const followUps = pendingFollowUps(db.activities, now);
  const awaiting = db.proposals.filter((p) => p.status === "enviada" || p.status === "negociacao");
  const projectsSoon = db.projects.filter((p) => {
    const d = projectDeadline(p, now);
    return d.soon || d.overdue;
  });
  const receivables = db.transactions.filter((t) => t.kind === "receita" && openAmount(t) > 0);
  const overdueReceivables = receivables.filter((t) => transactionStatus(t, now) === "vencido");
  return [
    { key: "sem_contato", label: "Leads sem contato", count: leadsWithoutContact(db.leads).length, href: "/leads?filtro=sem_contato", tone: "magenta" as const, hint: "Leads em aberto sem nenhum contato registrado" },
    {
      key: "follow_ups",
      label: "Follow-ups pendentes",
      count: followUps.length,
      href: "/leads?filtro=follow_up",
      tone: "violet" as const,
      hint: `${followUps.filter((f) => f.overdue).length} vencidos`,
    },
    { key: "propostas", label: "Propostas aguardando resposta", count: awaiting.length, href: "/propostas?status=aguardando", tone: "lilac" as const, hint: "Enviadas ou em negociação" },
    {
      key: "prazos",
      label: "Projetos com prazo próximo",
      count: projectsSoon.length,
      href: "/projetos?filtro=prazo",
      tone: "warn" as const,
      hint: `Vencem em até 7 dias ou já atrasados`,
    },
    {
      key: "pagamentos",
      label: "Pagamentos pendentes",
      count: receivables.length,
      href: "/financeiro?status=pendente",
      tone: overdueReceivables.length ? ("danger" as const) : ("mint" as const),
      hint: `${overdueReceivables.length} vencidos`,
    },
  ];
}

export function daysSince(iso: string | null, now = new Date()) {
  return iso ? -daysBetween(now, iso) : null;
}
