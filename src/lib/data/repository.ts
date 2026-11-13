"use client";

import { DEFAULT_PROJECT_TASKS, LEAD_STAGES, leadStageMeta, proposalStatusMeta } from "../constants";
import { addDays } from "../dates";
import { proposalTotal } from "../metrics/proposals";
import { normalizeName, phoneDigits } from "../prospecting/classify";
import {
  activityInputSchema,
  clientInputSchema,
  leadInputSchema,
  openingBalanceSchema,
  packageSchema,
  paymentInputSchema,
  profileSchema,
  projectInputSchema,
  proposalInputSchema,
  transactionInputSchema,
  type ActivityInput,
  type ClientInput,
  type LeadInput,
  type PaymentInput,
  type ProjectInput,
  type ProposalInput,
  type TransactionInput,
} from "../schemas";
import type {
  Activity,
  Client,
  Database,
  ID,
  Lead,
  LeadStage,
  PackageConfig,
  Project,
  ProjectStage,
  Proposal,
  ProposalStatus,
  Settings,
  Transaction,
} from "../types";
import { uid } from "../utils";
import { findCrmDuplicate, prospectToLeadInput, type CrmMatch } from "../prospecting/to-lead";
import type { ProspectResult } from "../prospecting/types";
import { createEmptyDatabase, createSeed } from "./seed";
import { commit, getDb, getMode, getStoreState } from "./store";
import { createLeadDemo, defaultDemoMessage, demoMessageForCopy, demoMessageSchema, demoPublicationSchema, demoRevision, leadDemoSchema, type DemoPublication, type LeadDemo } from "../demos/model";
import { createDemoPersonalization } from "../demos/personalization";
import { approvedConcepts, findApprovedConcept } from "../demos/concepts";
import { demoCreativeIssues } from "../demos/creative-review";
import { generationResultSchema, type GenerationResult } from "../demos/creation";
import { isCurrentDemoSent, normalizeWhatsappPhone, MANUAL_DEMO_ACTIVITY } from "../demos/whatsapp";

/**
 * Operações de escrita. Toda entrada passa pelo schema Zod antes de gravar —
 * mesma fronteira que um backend validaria. Retornam o registro salvo.
 */

const nowIso = () => new Date().toISOString();

function stageActivity(target: { leadId?: ID | null; clientId?: ID | null; projectId?: ID | null }, description: string): Activity {
  const t = nowIso();
  return {
    id: uid("act"),
    leadId: target.leadId ?? null,
    clientId: target.clientId ?? null,
    projectId: target.projectId ?? null,
    type: "etapa",
    description,
    dueAt: null,
    completedAt: t,
    createdAt: t,
  };
}

/* ───────────────────────────── Leads ───────────────────────────── */

export function createLead(input: LeadInput): Lead {
  const data = leadInputSchema.parse(input);
  const t = nowIso();
  const lead: Lead = {
    ...data,
    website: data.website || null,
    lastContactAt: null,
    clientId: null,
    lostReason: "",
    id: uid("lead"),
    createdAt: t,
    updatedAt: t,
  };
  commit((db) => ({ ...db, leads: [lead, ...db.leads] }));
  return lead;
}

export function updateLead(id: ID, input: LeadInput): Lead {
  const data = leadInputSchema.parse(input);
  let saved: Lead | undefined;
  commit((db) => {
    const prev = db.leads.find((l) => l.id === id);
    if (!prev) throw new Error("Lead não encontrado.");
    saved = { ...prev, ...data, website: data.website || null, updatedAt: nowIso() };
    const activities = prev.stage !== data.stage ? [stageActivity({ leadId: id }, `Etapa: ${leadStageMeta[prev.stage].label} → ${leadStageMeta[data.stage].label}`), ...db.activities] : db.activities;
    const next = { ...db, activities, leads: db.leads.map((l) => (l.id === id ? (saved as Lead) : l)) };
    if (data.stage !== "ganho") return next;
    const won = withClientForLead(next, id);
    saved = won.db.leads.find((l) => l.id === id) as Lead;
    return won.db;
  });
  return saved as Lead;
}

export function moveLeadStage(id: ID, stage: LeadStage) {
  commit((db) => {
    const prev = db.leads.find((l) => l.id === id);
    if (!prev || prev.stage === stage) return db;
    const next = {
      ...db,
      activities: [stageActivity({ leadId: id }, `Etapa: ${leadStageMeta[prev.stage].label} → ${leadStageMeta[stage].label}`), ...db.activities],
      leads: db.leads.map((l) => (l.id === id ? { ...l, stage, updatedAt: nowIso() } : l)),
    };
    // Venda ganha: garante o cliente (vincula um existente ou cria), sem duplicar.
    return stage === "ganho" ? withClientForLead(next, id).db : next;
  });
}

/**
 * Garante o cliente de um lead (função pura sobre o banco):
 * 1. lead já vinculado → usa o cliente existente;
 * 2. cliente sem lead com mesmo nome+cidade ou mesmo telefone → vincula;
 * 3. senão cria. Propostas do lead passam a apontar para o cliente.
 * Não altera a etapa do lead.
 */
function withClientForLead(db: Database, leadId: ID): { db: Database; client: Client; created: boolean } {
  const lead = db.leads.find((l) => l.id === leadId);
  if (!lead) throw new Error("Lead não encontrado.");
  const linked = (lead.clientId ? db.clients.find((c) => c.id === lead.clientId) : undefined) ?? db.clients.find((c) => c.leadId === leadId);
  const phone = phoneDigits(lead.phone);
  const same =
    linked ??
    db.clients.find(
      (c) =>
        !c.leadId &&
        ((normalizeName(c.name) === normalizeName(lead.name) && normalizeName(c.city) === normalizeName(lead.city)) ||
          (phone.length >= 10 && phoneDigits(c.phone).slice(-10) === phone.slice(-10))),
    );
  const t = nowIso();
  const client: Client = same
    ? same
    : {
        id: uid("cli"),
        leadId,
        name: lead.name,
        segment: lead.segment,
        city: lead.city,
        uf: lead.uf,
        contactName: "",
        phone: lead.phone,
        email: lead.email,
        status: "ativo",
        siteUrl: "",
        notes: lead.notes,
        createdAt: t,
        updatedAt: t,
      };
  const untouched = same && same.leadId === leadId && lead.clientId === same.id && !db.proposals.some((p) => p.leadId === leadId && p.clientId !== same.id);
  if (untouched) return { db, client, created: false };
  return {
    client: same ? { ...same, leadId: same.leadId ?? leadId } : client,
    created: !same,
    db: {
      ...db,
      clients: same ? db.clients.map((c) => (c.id === same.id && !c.leadId ? { ...c, leadId, updatedAt: t } : c)) : [client, ...db.clients],
      leads: db.leads.map((l) => (l.id === leadId ? { ...l, clientId: client.id, updatedAt: t } : l)),
      proposals: db.proposals.map((p) => (p.leadId === leadId && p.clientId !== client.id ? { ...p, clientId: client.id } : p)),
    },
  };
}

/** Exclui o lead e solta os vínculos que apontavam para ele (cliente, propostas, atividades mantidas). */
export function deleteLead(id: ID) {
  commit((db) => ({
    ...db,
    leads: db.leads.filter((l) => l.id !== id),
    activities: db.activities.filter((a) => a.leadId !== id || a.clientId).map((a) => (a.leadId === id ? { ...a, leadId: null } : a)),
    clients: db.clients.map((c) => (c.leadId === id ? { ...c, leadId: null } : c)),
    proposals: db.proposals.map((p) => (p.leadId === id ? { ...p, leadId: null } : p)),
  }));
}

/** Registra atividade. Contatos concluídos atualizam "último contato". */
export function addActivity(target: { leadId?: ID | null; clientId?: ID | null; projectId?: ID | null }, input: ActivityInput): Activity {
  const data = activityInputSchema.parse(input);
  const t = nowIso();
  const activity: Activity = {
    id: uid("act"),
    leadId: target.leadId ?? null,
    clientId: target.clientId ?? null,
    projectId: target.projectId ?? null,
    type: data.type,
    description: data.description,
    dueAt: data.dueAt,
    completedAt: data.completed ? t : null,
    createdAt: t,
  };
  const isContact = data.completed && ["ligacao", "whatsapp", "email", "visita", "reuniao"].includes(data.type);
  commit((db) => ({
    ...db,
    activities: [activity, ...db.activities],
    leads: isContact && target.leadId ? db.leads.map((l) => (l.id === target.leadId ? { ...l, lastContactAt: t, updatedAt: t } : l)) : db.leads,
  }));
  return activity;
}

export function toggleActivity(id: ID) {
  commit((db) => ({
    ...db,
    activities: db.activities.map((a) => (a.id === id ? { ...a, completedAt: a.completedAt ? null : nowIso() } : a)),
  }));
}

/* ───────────────────────────── Prospecção IA → CRM ───────────────────────────── */

export interface ProspectImportReport {
  demos: { resultId: string; leadId: string; reused: boolean }[];
  created: { resultId: string; lead: Lead }[];
  duplicates: { resultId: string; match: CrmMatch }[];
  invalid: { resultId: string; message: string }[];
}

/**
 * Importa resultados da Prospecção IA como leads novos, numa única gravação.
 * Duplicidade conferida contra o CRM no momento da gravação (e dentro do lote):
 * um lead já cadastrado nunca é sobrescrito. Mesmos schemas do cadastro manual.
 */
export function importProspects(results: (ProspectResult & { discarded?: boolean })[], options?: { generateDemos: boolean }): ProspectImportReport {
  const report: ProspectImportReport = { created: [], duplicates: [], invalid: [], demos: [] };
  commit((db) => {
    const leads: Lead[] = [];
    const activities: Activity[] = [];
    const demoUpdates = new Map<string, LeadDemo>();
    for (const r of results) {
      if (options?.generateDemos && (r.discarded || !["HOT", "WARM"].includes(r.classification))) continue;
      const match = findCrmDuplicate(r, [...leads, ...db.leads]);
      if (match) {
        report.duplicates.push({ resultId: r.id, match });
        if (options?.generateDemos) {
          const existing = [...leads, ...db.leads].find((l) => l.id === match.leadId)!;
          if (existing.stage === "ganho" || existing.stage === "perdido") continue;
          const previous = demoUpdates.get(existing.id) ?? existing.demo;
          demoUpdates.set(existing.id, previous ?? createLeadDemo(existing, { category: r.category }));
          report.demos.push({ resultId: r.id, leadId: existing.id, reused: !!previous });
        }
        continue;
      }
      const { input, activity } = prospectToLeadInput(r, db.settings.packages);
      const parsed = leadInputSchema.safeParse(input);
      if (!parsed.success) {
        report.invalid.push({ resultId: r.id, message: parsed.error.issues[0]?.message ?? "Dados inválidos." });
        continue;
      }
      const t = nowIso();
      const lead: Lead = { ...parsed.data, website: parsed.data.website || null, lastContactAt: null, clientId: null, lostReason: "", id: uid("lead"), createdAt: t, updatedAt: t };
      if (options?.generateDemos) {
        lead.demo = createLeadDemo(lead, { category: r.category });
        report.demos.push({ resultId: r.id, leadId: lead.id, reused: false });
      }
      const note = activityInputSchema.parse({ type: "nota", description: activity, dueAt: null, completed: true });
      activities.push({ id: uid("act"), leadId: lead.id, clientId: null, projectId: null, type: note.type, description: note.description, dueAt: null, completedAt: t, createdAt: t });
      leads.push(lead);
      report.created.push({ resultId: r.id, lead });
    }
    if (!leads.length && !demoUpdates.size) return db;
    return { ...db, leads: [...leads, ...db.leads].map((l) => demoUpdates.has(l.id) ? { ...l, demo: demoUpdates.get(l.id), updatedAt: nowIso() } : l), activities: [...activities, ...db.activities] };
  });
  return report;
}

export function generateLeadDemo(leadId: ID): LeadDemo {
  let demo: LeadDemo | undefined;
  commit((db) => {
    const lead = db.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error("Lead não encontrado.");
    demo = lead.demo ?? createLeadDemo(lead);
    if (lead.demo) return db;
    return { ...db, leads: db.leads.map((l) => l.id === leadId ? { ...l, demo, updatedAt: nowIso() } : l) };
  });
  return demo!;
}

/** Aplica somente o resultado da versão solicitada. Edições concorrentes exigem nova tentativa. */
export function applyGeneratedLeadDemo(leadId: ID, result: GenerationResult, expectedRevision: string | null): LeadDemo {
  const generated = generationResultSchema.parse(result);
  let saved: LeadDemo | undefined;
  commit((db) => {
    const lead = db.leads.find((item) => item.id === leadId);
    if (!lead) throw new Error("Lead removido durante a geração.");
    const previous = lead.demo;
    if ((generated.creation && previous?.creation?.id === generated.creation.id) || (generated.site && previous?.site?.id === generated.site.id)) { saved = previous; return db; }
    if (demoRevision(previous) !== expectedRevision) throw new Error("A demo foi editada durante a geração. Gere novamente para aplicar ao conteúdo atual.");
    if (previous?.status === "rejected") throw new Error(REJECTED_DEMO);
    const base = previous ?? createLeadDemo(lead);
    const messageWasEdited = previous && previous.message !== previous.generatedMessage && previous.message !== defaultDemoMessage(previous.business)
      && !(previous.conceptId && previous.message === approvedConcepts[previous.conceptId].message);
    // V6 grava só a referência do site (o código fica imutável no armazenamento de sites; o anterior continua lá).
    const presentation = generated.site ? { version: 6, creation: undefined, site: generated.site } : { version: 5, creation: generated.creation, site: undefined };
    saved = leadDemoSchema.parse({ ...base, design: undefined, conceptId: undefined, ...presentation, textProvider: generated.textProvider ?? "codex", imageProvider: generated.imageProvider ?? "codex",
      message: messageWasEdited ? previous.message : generated.message, generatedMessage: generated.message,
      status: "pending", approvedAt: null, approvedBy: null, updatedAt: nowIso() });
    const issues = demoCreativeIssues({ ...saved, message: generated.message }, db.leads.flatMap((item) => item.demo ? [item.demo] : []));
    if (issues.length) throw new Error(`A criação ainda contém repetições. ${issues.join(" ")}`);
    return { ...db, leads: db.leads.map((item) => item.id === leadId ? { ...item, demo: saved, updatedAt: nowIso() } : item) };
  });
  return saved!;
}

/**
 * Copia para o lead o resumo da publicação confirmado pelo servidor (Coolify). Não mexe em `demo.updatedAt`,
 * aprovação ou mensagem: publicar é uma etapa independente e não pode invalidar uma geração em andamento.
 */
export function applyDemoPublication(leadId: ID, publication: DemoPublication): boolean {
  const next = demoPublicationSchema.parse(publication);
  let changed = false;
  commit((db) => {
    const lead = db.leads.find((item) => item.id === leadId);
    if (!lead?.demo) return db;
    const comparable = (value?: DemoPublication) => value ? JSON.stringify({ ...value, syncedAt: null }) : null;
    if (comparable(lead.demo.publication) === comparable(next)) return db;
    changed = true;
    const demo = leadDemoSchema.parse({ ...lead.demo, publication: next });
    return { ...db, leads: db.leads.map((item) => item.id === leadId ? { ...item, demo, updatedAt: nowIso() } : item) };
  });
  return changed;
}

function updateLeadDemo(leadId: ID, update: (demo: LeadDemo, db: Database) => LeadDemo) {
  commit((db) => {
    const lead = db.leads.find((l) => l.id === leadId);
    if (!lead?.demo) throw new Error("Gere a demo antes de revisar a mensagem.");
    const demo = leadDemoSchema.parse(update(lead.demo, db));
    return { ...db, leads: db.leads.map((l) => l.id === leadId ? { ...l, demo, updatedAt: nowIso() } : l) };
  });
}

const REJECTED_DEMO = "Esta demo foi recusada. Restaure-a para aguardando aprovação antes de alterar.";

function demoReviewer(db: Database): string {
  return getMode() === "supabase" ? getStoreState().account?.email || db.settings.profile.name || "Revisor" : db.settings.profile.name || "Revisor local";
}

export function saveDemoMessage(leadId: ID, message: string) {
  const text = demoMessageSchema.parse(message);
  updateLeadDemo(leadId, (demo) => {
    if (demo.status === "rejected") throw new Error(REJECTED_DEMO);
    return demo.message === text ? demo : { ...demo, message: text, status: "pending", approvedAt: null, approvedBy: null, updatedAt: nowIso() };
  });
}

export function approveLeadDemo(leadId: ID) {
  updateLeadDemo(leadId, (demo, db) => {
    if (demo.status === "rejected") throw new Error(REJECTED_DEMO);
    const issues = demoCreativeIssues(demo, db.leads.flatMap((lead) => lead.demo ? [lead.demo] : []));
    if (issues.length) throw new Error(`Revisão criativa pendente. ${issues.join(" ")}`);
    return { ...demo, status: "approved", approvedAt: nowIso(), updatedAt: nowIso(), approvedBy: demoReviewer(db) };
  });
}

/**
 * Recusa só a demo deste lead: o lead, a mensagem, o envio declarado e o histórico ficam.
 * Remove a aprovação (nada recusado pode ser enviado) e registra uma nota no CRM.
 */
export function rejectLeadDemo(leadId: ID) {
  setDemoRejection(leadId, true);
}

/** Desfaz a recusa: a demo volta para "Aguardando aprovação" (exige nova aprovação). */
export function restoreLeadDemo(leadId: ID) {
  setDemoRejection(leadId, false);
}

function setDemoRejection(leadId: ID, rejected: boolean) {
  commit((db) => {
    const lead = db.leads.find((l) => l.id === leadId);
    if (!lead?.demo) throw new Error("Este lead não tem demo.");
    if ((lead.demo.status === "rejected") === rejected) return db;
    const t = nowIso();
    const by = demoReviewer(db);
    const demo = leadDemoSchema.parse(rejected
      ? { ...lead.demo, status: "rejected", approvedAt: null, approvedBy: null, rejectedAt: t, rejectedBy: by, updatedAt: t }
      : { ...lead.demo, status: "pending", rejectedAt: null, rejectedBy: null, updatedAt: t });
    const note = activityInputSchema.parse({ type: "nota", description: rejected ? `Demo recusada por ${by}. Lead e histórico preservados; envio bloqueado até restaurar.` : `Demo restaurada por ${by} para aguardando aprovação.`, dueAt: null, completed: true });
    const activity: Activity = { id: uid("act"), leadId, clientId: null, projectId: null, type: note.type, description: note.description, dueAt: null, completedAt: t, createdAt: t };
    return { ...db, leads: db.leads.map((l) => l.id === leadId ? { ...l, demo, updatedAt: t } : l), activities: [activity, ...db.activities] };
  });
}

export function revokeDemoApproval(leadId: ID) {
  updateLeadDemo(leadId, (demo) => {
    if (demo.status === "rejected") throw new Error(REJECTED_DEMO);
    return { ...demo, status: "pending", approvedAt: null, approvedBy: null, updatedAt: nowIso() };
  });
}

export function upgradeLeadDemoDesign(leadId: ID) {
  if (getDb().leads.find((l) => l.id === leadId)?.demo?.status === "rejected") throw new Error(REJECTED_DEMO);
  upgradeLeadDemoDesigns([leadId]);
}

export function upgradeLeadDemoDesigns(leadIds: ID[]): number {
  const selected = new Set(leadIds);
  let updated = 0;
  commit((db) => {
    const leads = db.leads.map((lead) => {
      if (!selected.has(lead.id) || !lead.demo || lead.demo.version >= 4 || lead.demo.status === "rejected") return lead;
      const conceptId = findApprovedConcept(lead.demo.business);
      if (!conceptId && lead.demo.version === 3) return lead;
      const message = conceptId && lead.demo.message === defaultDemoMessage(lead.demo.business) ? approvedConcepts[conceptId].message : lead.demo.message;
      const demo = leadDemoSchema.parse({ ...lead.demo, version: conceptId ? 4 : 3, conceptId, message,
        design: conceptId ? undefined : createDemoPersonalization(lead.demo.business), status: "pending", approvedAt: null, approvedBy: null, updatedAt: nowIso() });
      updated += 1;
      return { ...lead, demo, updatedAt: nowIso() };
    });
    return updated ? { ...db, leads } : db;
  });
  return updated;
}

/** Declaração manual do operador, nunca confirmação de entrega do WhatsApp. */
export function markDemoManuallySent(leadId: ID, origin: string) {
  commit((db) => {
    const lead = db.leads.find((l) => l.id === leadId);
    if (!lead?.demo) throw new Error("Gere e aprove a mensagem antes de registrar o envio.");
    const text = demoMessageForCopy(lead.demo, origin);
    const phone = normalizeWhatsappPhone(lead.phone);
    if (!phone) throw new Error("Confirme um telefone válido antes de registrar o envio.");
    if (isCurrentDemoSent(lead.demo, lead.phone)) return db;
    const t = nowIso();
    const by = getStoreState().account?.email || db.settings.profile.name || "Revisor local";
    const demo = leadDemoSchema.parse({ ...lead.demo, updatedAt: t, lastManualSend: { at: t, by, phone, body: lead.demo.message, text, designVersion: lead.demo.version } });
    const activity: Activity = { id: uid(), leadId, clientId: null, projectId: null, type: "whatsapp", description: MANUAL_DEMO_ACTIVITY, dueAt: null, completedAt: t, createdAt: t };
    return { ...db, leads: db.leads.map((l) => l.id === leadId ? { ...l, demo, lastContactAt: t, stage: l.stage === "novo" || l.stage === "qualificado" ? "contatado" : l.stage, updatedAt: t } : l), activities: [activity, ...db.activities] };
  });
}

export interface LeadFileImportReport {
  created: Lead[];
  duplicates: { name: string; match: CrmMatch }[];
}

/**
 * Importa leads vindos de arquivo (CSV) numa única gravação. Mesma conferência
 * de duplicidade da Prospecção IA (nome+cidade, telefone, site, Instagram),
 * contra o CRM e dentro do próprio lote; existentes nunca são sobrescritos.
 */
export function importLeadInputs(inputs: LeadInput[], origin: string): LeadFileImportReport {
  const report: LeadFileImportReport = { created: [], duplicates: [] };
  commit((db) => {
    const activities: Activity[] = [];
    for (const raw of inputs) {
      const data = leadInputSchema.parse(raw);
      const match = findCrmDuplicate({ name: data.name, city: data.city, phone: data.phone, website: data.website, instagram: data.instagram }, [...report.created, ...db.leads]);
      if (match) {
        report.duplicates.push({ name: data.name, match });
        continue;
      }
      const t = nowIso();
      const lead: Lead = { ...data, website: data.website || null, lastContactAt: null, clientId: null, lostReason: "", id: uid("lead"), createdAt: t, updatedAt: t };
      activities.push({ id: uid("act"), leadId: lead.id, clientId: null, projectId: null, type: "nota", description: `Importado de arquivo: ${origin}`.slice(0, 500), dueAt: null, completedAt: t, createdAt: t });
      report.created.push(lead);
    }
    if (!report.created.length) return db;
    return { ...db, leads: [...report.created, ...db.leads], activities: [...activities, ...db.activities] };
  });
  return report;
}

/**
 * Converte lead ganho em cliente (+ projeto inicial). Idempotente: se o lead
 * já tem cliente, apenas retorna o existente — não duplica.
 */
export function convertLeadToClient(leadId: ID): Client {
  let client: Client | undefined;
  commit((d) => {
    const won = markLeadWon(d, leadId);
    client = won.client;
    return won.db;
  });
  return client as Client;
}

/** Lead → Ganho (com histórico) + cliente garantido. Pura; idempotente. */
function markLeadWon(db: Database, leadId: ID): { db: Database; client: Client } {
  const lead = db.leads.find((l) => l.id === leadId);
  if (!lead) throw new Error("Lead não encontrado.");
  const staged: Database =
    lead.stage === "ganho"
      ? db
      : {
          ...db,
          activities: [stageActivity({ leadId }, `Etapa: ${leadStageMeta[lead.stage].label} → Ganho`), ...db.activities],
          leads: db.leads.map((l) => (l.id === leadId ? { ...l, stage: "ganho", nextAction: "Iniciar briefing", nextActionAt: null, updatedAt: nowIso() } : l)),
        };
  const won = withClientForLead(staged, leadId);
  return { db: won.db, client: won.client };
}

/* ───────────────────────────── Fechamento de venda ───────────────────────────── */

export interface InstallmentPlan {
  description: string;
  amount: number;
  dueDate: string;
}

/**
 * Parcelas de um contrato: entrada (percentual configurável) no início e o
 * restante na entrega. A soma é sempre igual ao total, em centavos exatos.
 * 0% ou 100% de entrada geram uma única parcela.
 */
export function buildInstallments(total: number, entryPercent: number, startDate: string, dueDate: string, label: string): InstallmentPlan[] {
  const cents = Math.round(total * 100);
  if (cents <= 0) return [];
  const pct = Math.min(100, Math.max(0, entryPercent));
  const entry = Math.round((cents * pct) / 100);
  const rest = cents - entry;
  const out: InstallmentPlan[] = [];
  if (entry > 0) out.push({ description: `Entrada (${pct}%) · ${label}`.slice(0, 140), amount: entry / 100, dueDate: startDate });
  if (rest > 0) out.push({ description: `${entry > 0 ? `Saldo na entrega (${100 - pct}%)` : "Pagamento na entrega"} · ${label}`.slice(0, 140), amount: rest / 100, dueDate });
  return out;
}

export interface SaleResult {
  client: Client;
  project: Project;
  transactions: Transaction[];
  /** false quando a venda já estava fechada (nada foi duplicado). */
  created: boolean;
}

/**
 * Fecha a venda a partir de uma proposta, numa única gravação:
 * proposta → Aprovada · lead → Ganho · cliente vinculado/criado · projeto com o
 * valor contratado · parcelas a receber (contas a receber, NÃO caixa).
 * Idempotente: se a proposta já tem projeto, devolve o existente.
 * Nenhuma cobrança, contrato ou mensagem é enviada.
 */
export function closeSale(proposalId: ID): SaleResult {
  let result: SaleResult | undefined;
  commit((db0) => {
    const proposal = db0.proposals.find((p) => p.id === proposalId);
    if (!proposal) throw new Error("Proposta não encontrada.");
    const existing = db0.projects.find((p) => p.proposalId === proposalId);
    if (existing) {
      const owner = db0.clients.find((c) => c.id === existing.clientId);
      if (!owner) throw new Error("Cliente do projeto não encontrado.");
      result = { client: owner, project: existing, transactions: db0.transactions.filter((x) => x.projectId === existing.id && x.kind === "receita"), created: false };
      return db0;
    }
    if (proposal.status === "recusada") throw new Error("Proposta recusada não pode virar venda. Altere o status antes.");
    const total = proposalTotal(proposal);
    if (total <= 0) throw new Error("A proposta precisa ter valor maior que zero para fechar a venda.");

    let db = db0;
    let client: Client | undefined;
    if (proposal.leadId && db.leads.some((l) => l.id === proposal.leadId)) {
      const won = markLeadWon(db, proposal.leadId);
      db = won.db;
      client = won.client;
    } else if (proposal.clientId) {
      client = db.clients.find((c) => c.id === proposal.clientId);
    }
    if (!client) throw new Error("Vincule a proposta a um lead ou cliente antes de fechar a venda.");
    const clientId = client.id;

    const t = nowIso();
    const start = new Date();
    const due = addDays(start, proposal.deadlineDays).toISOString();
    const project: Project = {
      id: uid("proj"),
      clientId,
      proposalId,
      title: `Site ${client.name}`.slice(0, 100),
      siteType: proposal.packageId === "essencial" ? "landing" : proposal.packageId === "profissional" ? "institucional" : "personalizado",
      stage: "briefing",
      startDate: start.toISOString(),
      dueDate: due,
      contractValue: total,
      tasks: DEFAULT_PROJECT_TASKS.map((task) => ({ id: uid("task"), title: task.title, stage: task.stage, done: false, doneAt: null })),
      previewUrl: "",
      publishedUrl: "",
      publishedAt: null,
      deliveredAt: null,
      contractCancelledAt: null,
      notes: proposal.scope ?? "",
      createdAt: t,
      updatedAt: t,
    };
    const transactions: Transaction[] = buildInstallments(total, db.settings.entryPercent, start.toISOString(), due, project.title).map((i) => ({
      id: uid("tx"),
      kind: "receita",
      clientId,
      projectId: project.id,
      description: i.description,
      amount: i.amount,
      dueDate: i.dueDate,
      category: "",
      notes: "",
      payments: [],
      cancelled: false,
      createdAt: t,
      updatedAt: t,
    }));
    const approving = proposal.status !== "aprovada";
    const log = stageActivity(
      { leadId: proposal.leadId, clientId, projectId: project.id },
      `Venda fechada: projeto “${project.title}” criado com ${transactions.length} parcela(s) a receber.${approving ? ` Proposta: ${proposalStatusMeta[proposal.status].label} → Aprovada.` : ""}`,
    );
    result = { client, project, transactions, created: true };
    return {
      ...db,
      activities: [log, ...db.activities],
      proposals: db.proposals.map((p) => (p.id === proposalId ? { ...p, clientId, status: "aprovada", ...applyStatusDates(p, "aprovada"), updatedAt: t } : p)),
      projects: [project, ...db.projects],
      transactions: [...transactions, ...db.transactions],
    };
  });
  return result as SaleResult;
}

/* ───────────────────────────── Clientes ───────────────────────────── */

export function createClient(input: ClientInput): Client {
  const data = clientInputSchema.parse(input);
  const t = nowIso();
  const client: Client = { ...data, id: uid("cli"), leadId: null, createdAt: t, updatedAt: t };
  commit((db) => ({ ...db, clients: [client, ...db.clients] }));
  return client;
}

export function updateClient(id: ID, input: ClientInput): Client {
  const data = clientInputSchema.parse(input);
  let saved: Client | undefined;
  commit((db) => ({
    ...db,
    clients: db.clients.map((c) => {
      if (c.id !== id) return c;
      saved = { ...c, ...data, updatedAt: nowIso() };
      return saved;
    }),
  }));
  if (!saved) throw new Error("Cliente não encontrado.");
  return saved;
}

/* ───────────────────────────── Projetos ───────────────────────────── */

export function createProject(input: ProjectInput): Project {
  const data = projectInputSchema.parse(input);
  const t = nowIso();
  const project: Project = {
    ...data,
    proposalId: null,
    tasks: DEFAULT_PROJECT_TASKS.map((task) => ({ id: uid("task"), title: task.title, stage: task.stage, done: false, doneAt: null })),
    publishedAt: data.publishedUrl ? t : null,
    deliveredAt: null,
    contractCancelledAt: null,
    id: uid("proj"),
    createdAt: t,
    updatedAt: t,
  };
  commit((db) => ({ ...db, projects: [project, ...db.projects] }));
  return project;
}

export function updateProject(id: ID, input: ProjectInput): Project {
  const data = projectInputSchema.parse(input);
  let saved: Project | undefined;
  commit((db) => ({
    ...db,
    projects: db.projects.map((p) => {
      if (p.id !== id) return p;
      const t = nowIso();
      saved = {
        ...p,
        ...data,
        publishedAt: data.publishedUrl ? (p.publishedAt ?? t) : null,
        deliveredAt: data.stage === "entrega" ? (p.deliveredAt ?? t) : null,
        updatedAt: t,
      };
      return saved;
    }),
  }));
  if (!saved) throw new Error("Projeto não encontrado.");
  return saved;
}

export function setProjectStage(id: ID, stage: ProjectStage) {
  commit((db) => ({
    ...db,
    projects: db.projects.map((p) =>
      p.id === id ? { ...p, stage, deliveredAt: stage === "entrega" ? (p.deliveredAt ?? nowIso()) : null, updatedAt: nowIso() } : p,
    ),
  }));
}

export function toggleProjectTask(projectId: ID, taskId: ID) {
  commit((db) => {
    const project = db.projects.find((p) => p.id === projectId);
    const task = project?.tasks.find((t) => t.id === taskId);
    if (!project || !task) return db;
    const done = !task.done;
    const t = nowIso();
    const activities = done
      ? [{ id: uid("act"), leadId: null, clientId: project.clientId, projectId, type: "nota" as const, description: `Tarefa concluída: ${task.title}`, dueAt: null, completedAt: t, createdAt: t }, ...db.activities]
      : db.activities;
    return {
      ...db,
      activities,
      projects: db.projects.map((p) =>
        p.id === projectId ? { ...p, updatedAt: t, tasks: p.tasks.map((x) => (x.id === taskId ? { ...x, done, doneAt: done ? t : null } : x)) } : p,
      ),
    };
  });
}

export function addProjectTask(projectId: ID, title: string, stage: ProjectStage) {
  const clean = title.trim();
  if (clean.length < 2) throw new Error("Descreva a tarefa com ao menos 2 caracteres.");
  commit((db) => ({
    ...db,
    projects: db.projects.map((p) =>
      p.id === projectId ? { ...p, updatedAt: nowIso(), tasks: [...p.tasks, { id: uid("task"), title: clean, stage, done: false, doneAt: null }] } : p,
    ),
  }));
}

export function removeProjectTask(projectId: ID, taskId: ID) {
  commit((db) => ({
    ...db,
    projects: db.projects.map((p) => (p.id === projectId ? { ...p, updatedAt: nowIso(), tasks: p.tasks.filter((t) => t.id !== taskId) } : p)),
  }));
}

/* ───────────────────────────── Propostas ───────────────────────────── */

function applyStatusDates(prev: Proposal | null, status: ProposalStatus) {
  const t = nowIso();
  return {
    // "Pronta" ainda não saiu: só conta como enviada a partir do status "enviada".
    sentAt: status === "rascunho" || status === "pronta" ? null : (prev?.sentAt ?? t),
    decidedAt: status === "aprovada" || status === "recusada" || status === "expirada" ? (prev?.decidedAt ?? t) : null,
  };
}

/**
 * Mantém o funil coerente com a proposta: enviar leva o lead a "Proposta" e
 * negociar a "Negociação" — só para a frente, nunca recua nem mexe em ganho/perdido.
 */
function advanceLeadForProposal(db: Database, leadId: ID | null, status: ProposalStatus): Database {
  const target: LeadStage | null = status === "enviada" ? "proposta" : status === "negociacao" ? "negociacao" : null;
  const lead = leadId ? db.leads.find((l) => l.id === leadId) : undefined;
  if (!target || !lead || lead.stage === "ganho" || lead.stage === "perdido") return db;
  if (LEAD_STAGES.indexOf(lead.stage) >= LEAD_STAGES.indexOf(target)) return db;
  return {
    ...db,
    activities: [stageActivity({ leadId: lead.id }, `Etapa: ${leadStageMeta[lead.stage].label} → ${leadStageMeta[target].label}`), ...db.activities],
    leads: db.leads.map((l) => (l.id === lead.id ? { ...l, stage: target, updatedAt: nowIso() } : l)),
  };
}

export function createProposal(input: ProposalInput): Proposal {
  const data = proposalInputSchema.parse(input);
  const t = nowIso();
  const proposal: Proposal = { ...data, ...applyStatusDates(null, data.status), id: uid("prop"), createdAt: t, updatedAt: t };
  commit((db) => advanceLeadForProposal({ ...db, proposals: [proposal, ...db.proposals] }, proposal.leadId, proposal.status));
  return proposal;
}

export function updateProposal(id: ID, input: ProposalInput): Proposal {
  const data = proposalInputSchema.parse(input);
  let saved: Proposal | undefined;
  commit((db) =>
    advanceLeadForProposal(
      {
        ...db,
        proposals: db.proposals.map((p) => {
          if (p.id !== id) return p;
          saved = { ...p, ...data, ...applyStatusDates(p, data.status), updatedAt: nowIso() };
          return saved;
        }),
      },
      data.leadId,
      data.status,
    ),
  );
  if (!saved) throw new Error("Proposta não encontrada.");
  return saved;
}

export function setProposalStatus(id: ID, status: ProposalStatus) {
  commit((db) => {
    const prev = db.proposals.find((p) => p.id === id);
    if (!prev || prev.status === status) return db;
    const activities = prev.leadId
      ? [stageActivity({ leadId: prev.leadId, clientId: prev.clientId }, `Proposta: ${proposalStatusMeta[prev.status].label} → ${proposalStatusMeta[status].label}`), ...db.activities]
      : db.activities;
    return advanceLeadForProposal(
      {
        ...db,
        activities,
        proposals: db.proposals.map((p) => (p.id === id ? { ...p, status, ...applyStatusDates(p, status), updatedAt: nowIso() } : p)),
      },
      prev.leadId,
      status,
    );
  });
}

/** Marca como "Expirada" as propostas abertas com validade vencida. Devolve quantas mudaram. */
export function expireOverdueProposals(now = new Date()): number {
  let changed = 0;
  commit((db) => {
    const due = db.proposals.filter((p) => ["rascunho", "pronta", "enviada", "negociacao"].includes(p.status) && new Date(p.validUntil).getTime() < now.getTime() - 86_400_000);
    if (!due.length) return db;
    changed = due.length;
    const ids = new Set(due.map((p) => p.id));
    return {
      ...db,
      proposals: db.proposals.map((p) => (ids.has(p.id) ? { ...p, status: "expirada" as const, ...applyStatusDates(p, "expirada"), updatedAt: nowIso() } : p)),
    };
  });
  return changed;
}

export function duplicateProposal(id: ID): Proposal {
  const db = getDb();
  const src = db.proposals.find((p) => p.id === id);
  if (!src) throw new Error("Proposta não encontrada.");
  const t = nowIso();
  const copy: Proposal = {
    ...structuredClone(src),
    id: uid("prop"),
    title: `${src.title} (cópia)`,
    items: src.items.map((it) => ({ ...it, id: uid("item") })),
    status: "rascunho",
    sentAt: null,
    decidedAt: null,
    validUntil: addDays(new Date(), db.settings.defaultProposalValidityDays).toISOString(),
    createdAt: t,
    updatedAt: t,
  };
  commit((d) => ({ ...d, proposals: [copy, ...d.proposals] }));
  return copy;
}

export function deleteProposal(id: ID) {
  commit((db) => ({
    ...db,
    proposals: db.proposals.filter((p) => p.id !== id),
    projects: db.projects.map((p) => (p.proposalId === id ? { ...p, proposalId: null } : p)),
  }));
}

/* ───────────────────────────── Financeiro ───────────────────────────── */

/*
 * Regras de integridade (valem nos dois modos; no Supabase o banco repete a
 * principal com um gatilho — ver migration de produção do financeiro):
 * - a soma dos pagamentos nunca passa do valor do lançamento;
 * - lançamento com pagamento registrado não é cancelado nem apagado: primeiro
 *   estorna-se o pagamento, com motivo;
 * - toda correção relevante (valor, vencimento, estorno, cancelamento) gera um
 *   registro de atividade com o antes/depois — nada some em silêncio.
 */

const cents = (v: number) => Math.round(v * 100);
const paidOf = (tx: Transaction) => tx.payments.reduce((s, p) => s + cents(p.amount), 0) / 100;
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dayOf = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Registro de auditoria do financeiro (aparece no histórico do cliente/projeto). */
function financeLog(tx: Pick<Transaction, "clientId" | "projectId">, description: string): Activity {
  const t = nowIso();
  return { id: uid("act"), leadId: null, clientId: tx.clientId, projectId: tx.projectId, type: "nota", description: `Financeiro: ${description}`.slice(0, 500), dueAt: null, completedAt: t, createdAt: t };
}

/** Janela em que um pagamento idêntico é tratado como clique duplicado. */
const DUPLICATE_WINDOW_MS = 15_000;
const recentPayments = new Map<string, number>();

function guardDuplicate(key: string) {
  const now = Date.now();
  for (const [k, at] of recentPayments) if (now - at > DUPLICATE_WINDOW_MS) recentPayments.delete(k);
  if (recentPayments.has(key)) throw new Error("Este pagamento acabou de ser registrado. Confira as movimentações antes de lançar de novo.");
  recentPayments.set(key, now);
}

export interface SettleNow {
  date: string;
  method?: PaymentInput["method"];
  note?: string;
}

/**
 * Cria um lançamento (recebível ou despesa). Com `settleNow`, registra na
 * mesma gravação o pagamento integral (recebimento avulso já recebido ou
 * despesa já paga) — uma operação só, sem risco de ficar pela metade.
 */
export function createTransaction(input: TransactionInput, settleNow?: SettleNow): Transaction {
  const data = transactionInputSchema.parse(input);
  const t = nowIso();
  const payments = settleNow ? [{ id: uid("pay"), ...paymentInputSchema.parse({ amount: data.amount, date: settleNow.date, method: settleNow.method ?? "", note: settleNow.note ?? "" }) }] : [];
  if (settleNow) guardDuplicate(`new|${data.kind}|${data.description.toLowerCase()}|${cents(data.amount)}|${dayOf(settleNow.date)}`);
  const tx: Transaction = { ...data, payments, cancelled: false, id: uid("tx"), createdAt: t, updatedAt: t };
  commit((db) => ({ ...db, transactions: [tx, ...db.transactions] }));
  return tx;
}

/** Registra recebimento/pagamento (total ou parcial). Não processa pagamento real. */
export function addPayment(transactionId: ID, input: PaymentInput) {
  const data = paymentInputSchema.parse(input);
  const tx = getDb().transactions.find((x) => x.id === transactionId);
  if (!tx) throw new Error("Lançamento não encontrado.");
  if (tx.cancelled) throw new Error("Lançamento cancelado: reative-o antes de registrar pagamento.");
  const remaining = (cents(tx.amount) - cents(paidOf(tx))) / 100;
  if (remaining <= 0) throw new Error("Este lançamento já está quitado.");
  if (cents(data.amount) > cents(remaining)) throw new Error(`Valor maior que o saldo em aberto (${brl(remaining)}).`);
  guardDuplicate(`pay|${transactionId}|${cents(data.amount)}|${dayOf(data.date)}`);
  commit((d) => ({
    ...d,
    transactions: d.transactions.map((x) => (x.id === transactionId ? { ...x, updatedAt: nowIso(), payments: [...x.payments, { id: uid("pay"), ...data }] } : x)),
  }));
}

export interface TransactionPatch {
  description: string;
  amount: number | string;
  dueDate: string;
  category: Transaction["category"];
  notes: string;
  clientId: ID | null;
  projectId: ID | null;
}

/** Corrige um lançamento. Valor não pode ficar abaixo do já pago; mudanças de valor/vencimento ficam registradas. */
export function updateTransaction(id: ID, patch: TransactionPatch): Transaction {
  const current = getDb().transactions.find((x) => x.id === id);
  if (!current) throw new Error("Lançamento não encontrado.");
  const data = transactionInputSchema.parse({ ...patch, kind: current.kind });
  const paid = paidOf(current);
  if (cents(data.amount) < cents(paid)) throw new Error(`O valor não pode ficar abaixo do já pago (${brl(paid)}). Estorne o pagamento antes.`);
  const changes: string[] = [];
  if (cents(data.amount) !== cents(current.amount)) changes.push(`valor ${brl(current.amount)} → ${brl(data.amount)}`);
  if (dayOf(data.dueDate) !== dayOf(current.dueDate)) changes.push(`vencimento ${dayOf(current.dueDate)} → ${dayOf(data.dueDate)}`);
  if (data.description !== current.description) changes.push(`descrição “${current.description}” → “${data.description}”`);
  const saved: Transaction = { ...current, ...data, updatedAt: nowIso() };
  commit((db) => ({
    ...db,
    activities: changes.length ? [financeLog(saved, `lançamento corrigido — ${changes.join("; ")}`), ...db.activities] : db.activities,
    transactions: db.transactions.map((x) => (x.id === id ? saved : x)),
  }));
  return saved;
}

/** Estorna (desfaz) um pagamento registrado por engano. Exige motivo e fica no histórico. */
export function reversePayment(transactionId: ID, paymentId: ID, reason: string) {
  const why = reason.trim();
  if (why.length < 3) throw new Error("Informe o motivo do estorno (ao menos 3 caracteres).");
  const tx = getDb().transactions.find((x) => x.id === transactionId);
  const payment = tx?.payments.find((p) => p.id === paymentId);
  if (!tx || !payment) throw new Error("Pagamento não encontrado.");
  commit((db) => ({
    ...db,
    activities: [financeLog(tx, `estorno de ${brl(payment.amount)} pago em ${dayOf(payment.date)} em “${tx.description}”. Motivo: ${why.slice(0, 200)}`), ...db.activities],
    transactions: db.transactions.map((x) => (x.id === transactionId ? { ...x, updatedAt: nowIso(), payments: x.payments.filter((p) => p.id !== paymentId) } : x)),
  }));
}

/** Cancela/reativa um lançamento. Com pagamento registrado, é preciso estornar antes (o dinheiro já movimentado não some). */
export function setTransactionCancelled(id: ID, cancelled: boolean) {
  const tx = getDb().transactions.find((x) => x.id === id);
  if (!tx) throw new Error("Lançamento não encontrado.");
  if (tx.cancelled === cancelled) return;
  if (cancelled && tx.payments.length) throw new Error("Este lançamento tem pagamento registrado. Estorne o pagamento antes de cancelar.");
  commit((db) => ({
    ...db,
    activities: [financeLog(tx, `${cancelled ? "lançamento cancelado" : "lançamento reativado"} — “${tx.description}” (${brl(tx.amount)})`), ...db.activities],
    transactions: db.transactions.map((x) => (x.id === id ? { ...x, cancelled, updatedAt: nowIso() } : x)),
  }));
}

/**
 * Cancela o contrato de um projeto: deixa de contar como receita contratada,
 * parcelas sem pagamento são canceladas e parcelas parcialmente pagas são
 * encerradas no valor já recebido (o recebido continua no caixa).
 */
export function cancelProjectContract(projectId: ID, reason: string) {
  const why = reason.trim();
  if (why.length < 3) throw new Error("Informe o motivo do cancelamento (ao menos 3 caracteres).");
  const project = getDb().projects.find((p) => p.id === projectId);
  if (!project) throw new Error("Projeto não encontrado.");
  if (project.contractCancelledAt) return;
  commit((db) => {
    const t = nowIso();
    const notes: string[] = [];
    const transactions = db.transactions.map((x) => {
      if (x.projectId !== projectId || x.kind !== "receita" || x.cancelled) return x;
      const paid = paidOf(x);
      if (cents(paid) >= cents(x.amount)) return x;
      if (paid === 0) {
        notes.push(`“${x.description}” (${brl(x.amount)}) cancelada`);
        return { ...x, cancelled: true, updatedAt: t };
      }
      notes.push(`“${x.description}” encerrada em ${brl(paid)} (era ${brl(x.amount)})`);
      return { ...x, amount: paid, updatedAt: t };
    });
    return {
      ...db,
      activities: [financeLog({ clientId: project.clientId, projectId }, `contrato de ${brl(project.contractValue)} cancelado. Motivo: ${why.slice(0, 160)}.${notes.length ? ` Parcelas: ${notes.join("; ")}.` : ""}`), ...db.activities],
      projects: db.projects.map((p) => (p.id === projectId ? { ...p, contractCancelledAt: t, updatedAt: t } : p)),
      transactions,
    };
  });
}

/** Reativa o contrato. Parcelas canceladas não voltam sozinhas: relance o que faltar receber. */
export function reactivateProjectContract(projectId: ID) {
  const project = getDb().projects.find((p) => p.id === projectId);
  if (!project?.contractCancelledAt) return;
  commit((db) => ({
    ...db,
    activities: [financeLog({ clientId: project.clientId, projectId }, `contrato de ${brl(project.contractValue)} reativado. Parcelas canceladas não foram restauradas automaticamente.`), ...db.activities],
    projects: db.projects.map((p) => (p.id === projectId ? { ...p, contractCancelledAt: null, updatedAt: nowIso() } : p)),
  }));
}

/** Saldo de caixa informado numa data (ex.: extrato). null remove a informação. */
export function setOpeningBalance(value: { amount: number | string; date: string } | null) {
  const parsed = value ? openingBalanceSchema.parse(value) : null;
  commit((db) => ({ ...db, settings: { ...db.settings, openingBalance: parsed ? { amount: Math.round(parsed.amount * 100) / 100, date: parsed.date } : null } }));
}

/* ───────────────────────────── Configurações ───────────────────────────── */

export function updateSettings(patch: Partial<Settings>) {
  if (patch.profile) profileSchema.parse(patch.profile);
  if (patch.packages) patch.packages.forEach((p: PackageConfig) => packageSchema.parse(p));
  commit((db) => ({ ...db, settings: { ...db.settings, ...patch } }));
}

/** Só no modo local: dados fictícios nunca vão para o banco real. */
export function resetDemoData() {
  if (getMode() !== "local") throw new Error("Dados de demonstração não podem ser gravados no banco real.");
  commit((db) => ({ ...createSeed(), settings: db.settings }));
}

/** Remove todos os registros (inclusive os fictícios) e passa a usar só dados digitados. */
export function startFromScratch() {
  if (getMode() !== "local") throw new Error("Limpeza total disponível só no modo local.");
  commit((db) => createEmptyDatabase(db.settings));
}

export function exportDatabase(): string {
  return JSON.stringify(getDb(), null, 2);
}

export type { Database };
