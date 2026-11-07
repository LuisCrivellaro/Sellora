"use client";

import { DEFAULT_PROJECT_TASKS, leadStageMeta, proposalStatusMeta } from "../constants";
import { addDays } from "../dates";
import {
  activityInputSchema,
  clientInputSchema,
  leadInputSchema,
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
import { createEmptyDatabase, createSeed } from "./seed";
import { commit, getDb, getMode } from "./store";

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
    return { ...db, activities, leads: db.leads.map((l) => (l.id === id ? (saved as Lead) : l)) };
  });
  return saved as Lead;
}

export function moveLeadStage(id: ID, stage: LeadStage) {
  commit((db) => {
    const prev = db.leads.find((l) => l.id === id);
    if (!prev || prev.stage === stage) return db;
    return {
      ...db,
      activities: [stageActivity({ leadId: id }, `Etapa: ${leadStageMeta[prev.stage].label} → ${leadStageMeta[stage].label}`), ...db.activities],
      leads: db.leads.map((l) => (l.id === id ? { ...l, stage, updatedAt: nowIso() } : l)),
    };
  });
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

/**
 * Converte lead ganho em cliente (+ projeto inicial). Idempotente: se o lead
 * já tem cliente, apenas retorna o existente — não duplica.
 */
export function convertLeadToClient(leadId: ID): Client {
  const db = getDb();
  const lead = db.leads.find((l) => l.id === leadId);
  if (!lead) throw new Error("Lead não encontrado.");
  const existing = lead.clientId ? db.clients.find((c) => c.id === lead.clientId) : undefined;
  if (existing) return existing;
  const t = nowIso();
  const client: Client = {
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
  const approved = db.proposals.find((p) => p.leadId === leadId && p.status === "aprovada");
  commit((d) => ({
    ...d,
    clients: [client, ...d.clients],
    activities: lead.stage !== "ganho" ? [stageActivity({ leadId }, `Etapa: ${leadStageMeta[lead.stage].label} → Ganho`), ...d.activities] : d.activities,
    leads: d.leads.map((l) => (l.id === leadId ? { ...l, stage: "ganho", clientId: client.id, nextAction: "Iniciar briefing", nextActionAt: null, updatedAt: t } : l)),
    proposals: approved ? d.proposals.map((p) => (p.id === approved.id ? { ...p, clientId: client.id } : p)) : d.proposals,
  }));
  return client;
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
    sentAt: status === "rascunho" ? null : (prev?.sentAt ?? t),
    decidedAt: status === "aprovada" || status === "recusada" ? (prev?.decidedAt ?? t) : null,
  };
}

export function createProposal(input: ProposalInput): Proposal {
  const data = proposalInputSchema.parse(input);
  const t = nowIso();
  const proposal: Proposal = { ...data, ...applyStatusDates(null, data.status), id: uid("prop"), createdAt: t, updatedAt: t };
  commit((db) => ({ ...db, proposals: [proposal, ...db.proposals] }));
  return proposal;
}

export function updateProposal(id: ID, input: ProposalInput): Proposal {
  const data = proposalInputSchema.parse(input);
  let saved: Proposal | undefined;
  commit((db) => ({
    ...db,
    proposals: db.proposals.map((p) => {
      if (p.id !== id) return p;
      saved = { ...p, ...data, ...applyStatusDates(p, data.status), updatedAt: nowIso() };
      return saved;
    }),
  }));
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
    return {
      ...db,
      activities,
      proposals: db.proposals.map((p) => (p.id === id ? { ...p, status, ...applyStatusDates(p, status), updatedAt: nowIso() } : p)),
    };
  });
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

export function createTransaction(input: TransactionInput): Transaction {
  const data = transactionInputSchema.parse(input);
  const t = nowIso();
  const tx: Transaction = { ...data, payments: [], cancelled: false, id: uid("tx"), createdAt: t, updatedAt: t };
  commit((db) => ({ ...db, transactions: [tx, ...db.transactions] }));
  return tx;
}

/** Registra recebimento (total ou parcial). Não processa pagamento real. */
export function addPayment(transactionId: ID, input: PaymentInput) {
  const data = paymentInputSchema.parse(input);
  const db = getDb();
  const tx = db.transactions.find((x) => x.id === transactionId);
  if (!tx) throw new Error("Lançamento não encontrado.");
  const paid = tx.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.round((tx.amount - paid) * 100) / 100;
  if (data.amount > remaining + 0.001) throw new Error(`Valor maior que o saldo em aberto (${remaining.toFixed(2).replace(".", ",")}).`);
  commit((d) => ({
    ...d,
    transactions: d.transactions.map((x) =>
      x.id === transactionId ? { ...x, updatedAt: nowIso(), payments: [...x.payments, { id: uid("pay"), ...data }] } : x,
    ),
  }));
}

export function setTransactionCancelled(id: ID, cancelled: boolean) {
  commit((db) => ({ ...db, transactions: db.transactions.map((x) => (x.id === id ? { ...x, cancelled, updatedAt: nowIso() } : x)) }));
}

export function removePayment(transactionId: ID, paymentId: ID) {
  commit((db) => ({
    ...db,
    transactions: db.transactions.map((x) =>
      x.id === transactionId ? { ...x, updatedAt: nowIso(), payments: x.payments.filter((p) => p.id !== paymentId) } : x,
    ),
  }));
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
