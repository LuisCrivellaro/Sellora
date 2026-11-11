import type { Activity, Client, Lead } from "../types";
import { leadDemoSchema } from "../demos/model";
import type { ChangeSet, ItemRecord, PaymentRecord, ProjectRecord, ProposalRecord, TableName, TaskRecord, TransactionRecord } from "./sync";

/**
 * Único ponto de tradução entre os tipos TypeScript (camelCase) e as colunas do
 * Postgres (snake_case). Leitura normaliza datas para ISO e numéricos para number.
 */

type Row = Record<string, unknown>;

const ts = (v: unknown): string => new Date(String(v)).toISOString();
const tsOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : ts(v));
const num = (v: unknown): number => Number(v);
const str = (v: unknown): string => (v === null || v === undefined ? "" : String(v));
const idOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

/** created_at/updated_at dos filhos (o domínio não guarda datas neles). */
const childStamps = (now: string) => ({ created_at: now, updated_at: now });

/* ───────────── Domínio → linha ───────────── */

export function leadToRow(l: Lead): Row {
  return {
    demo: l.demo ?? null,
    id: l.id,
    name: l.name,
    segment: l.segment,
    city: l.city,
    uf: l.uf,
    source: l.source,
    website: l.website,
    website_situation: l.websiteSituation,
    stage: l.stage,
    priority: l.priority,
    phone: l.phone,
    email: l.email,
    instagram: l.instagram,
    potential_value: l.potentialValue,
    last_contact_at: l.lastContactAt,
    next_action: l.nextAction,
    next_action_at: l.nextActionAt,
    notes: l.notes,
    client_id: l.clientId,
    lost_reason: l.lostReason,
    created_at: l.createdAt,
    updated_at: l.updatedAt,
  };
}

export function clientToRow(c: Client): Row {
  return {
    id: c.id,
    lead_id: c.leadId,
    name: c.name,
    segment: c.segment,
    city: c.city,
    uf: c.uf,
    contact_name: c.contactName,
    phone: c.phone,
    email: c.email,
    status: c.status,
    site_url: c.siteUrl,
    notes: c.notes,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export function activityToRow(a: Activity, now: string): Row {
  return {
    id: a.id,
    lead_id: a.leadId,
    client_id: a.clientId,
    project_id: a.projectId,
    type: a.type,
    description: a.description,
    due_at: a.dueAt,
    completed_at: a.completedAt,
    created_at: a.createdAt,
    updated_at: now,
  };
}

export function projectToRow(p: ProjectRecord): Row {
  return {
    id: p.id,
    client_id: p.clientId,
    proposal_id: p.proposalId,
    title: p.title,
    site_type: p.siteType,
    stage: p.stage,
    start_date: p.startDate,
    due_date: p.dueDate,
    contract_value: p.contractValue,
    preview_url: p.previewUrl,
    published_url: p.publishedUrl,
    published_at: p.publishedAt,
    delivered_at: p.deliveredAt,
    notes: p.notes,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function taskToRow(t: TaskRecord, now: string): Row {
  return { id: t.id, project_id: t.projectId, title: t.title, stage: t.stage, done: t.done, done_at: t.doneAt, position: t.position, ...childStamps(now) };
}

export function proposalToRow(p: ProposalRecord): Row {
  return {
    id: p.id,
    lead_id: p.leadId,
    client_id: p.clientId,
    recipient_name: p.recipientName,
    title: p.title,
    package_id: p.packageId,
    discount: p.discount,
    deadline_days: p.deadlineDays,
    revisions: p.revisions,
    payment_terms: p.paymentTerms,
    scope: p.scope,
    exclusions: p.exclusions,
    valid_until: p.validUntil,
    status: p.status,
    sent_at: p.sentAt,
    decided_at: p.decidedAt,
    next_action: p.nextAction,
    notes: p.notes,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
  };
}

export function itemToRow(i: ItemRecord, now: string): Row {
  return { id: i.id, proposal_id: i.proposalId, description: i.description, quantity: i.quantity, unit_price: i.unitPrice, position: i.position, ...childStamps(now) };
}

export function transactionToRow(t: TransactionRecord): Row {
  return {
    id: t.id,
    kind: t.kind,
    client_id: t.clientId,
    project_id: t.projectId,
    description: t.description,
    amount: t.amount,
    due_date: t.dueDate,
    cancelled: t.cancelled,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

export function paymentToRow(p: PaymentRecord, now: string): Row {
  return { id: p.id, transaction_id: p.transactionId, amount: p.amount, paid_at: p.date, note: p.note, position: p.position, ...childStamps(now) };
}

/* ───────────── Linha → domínio ───────────── */

export function leadFromRow(r: Row): Lead {
  return {
    demo: leadDemoSchema.safeParse(r.demo).data ?? null,
    id: String(r.id),
    name: str(r.name),
    segment: r.segment as Lead["segment"],
    city: str(r.city),
    uf: str(r.uf),
    source: r.source as Lead["source"],
    website: r.website ? String(r.website) : null,
    websiteSituation: r.website_situation as Lead["websiteSituation"],
    stage: r.stage as Lead["stage"],
    priority: r.priority as Lead["priority"],
    phone: str(r.phone),
    email: str(r.email),
    instagram: str(r.instagram),
    potentialValue: num(r.potential_value),
    lastContactAt: tsOrNull(r.last_contact_at),
    nextAction: str(r.next_action),
    nextActionAt: tsOrNull(r.next_action_at),
    notes: str(r.notes),
    clientId: idOrNull(r.client_id),
    lostReason: str(r.lost_reason),
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

export function clientFromRow(r: Row): Client {
  return {
    id: String(r.id),
    leadId: idOrNull(r.lead_id),
    name: str(r.name),
    segment: r.segment as Client["segment"],
    city: str(r.city),
    uf: str(r.uf),
    contactName: str(r.contact_name),
    phone: str(r.phone),
    email: str(r.email),
    status: r.status as Client["status"],
    siteUrl: str(r.site_url),
    notes: str(r.notes),
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

export function activityFromRow(r: Row): Activity {
  return {
    id: String(r.id),
    leadId: idOrNull(r.lead_id),
    clientId: idOrNull(r.client_id),
    projectId: idOrNull(r.project_id),
    type: r.type as Activity["type"],
    description: str(r.description),
    dueAt: tsOrNull(r.due_at),
    completedAt: tsOrNull(r.completed_at),
    createdAt: ts(r.created_at),
  };
}

export function projectFromRow(r: Row): ProjectRecord {
  return {
    id: String(r.id),
    clientId: String(r.client_id),
    proposalId: idOrNull(r.proposal_id),
    title: str(r.title),
    siteType: r.site_type as ProjectRecord["siteType"],
    stage: r.stage as ProjectRecord["stage"],
    startDate: ts(r.start_date),
    dueDate: ts(r.due_date),
    contractValue: num(r.contract_value),
    previewUrl: str(r.preview_url),
    publishedUrl: str(r.published_url),
    publishedAt: tsOrNull(r.published_at),
    deliveredAt: tsOrNull(r.delivered_at),
    notes: str(r.notes),
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

export function taskFromRow(r: Row): TaskRecord {
  return {
    id: String(r.id),
    projectId: String(r.project_id),
    title: str(r.title),
    stage: r.stage as TaskRecord["stage"],
    done: Boolean(r.done),
    doneAt: tsOrNull(r.done_at),
    position: num(r.position),
  };
}

export function proposalFromRow(r: Row): ProposalRecord {
  return {
    id: String(r.id),
    leadId: idOrNull(r.lead_id),
    clientId: idOrNull(r.client_id),
    recipientName: str(r.recipient_name),
    title: str(r.title),
    packageId: r.package_id as ProposalRecord["packageId"],
    discount: num(r.discount),
    deadlineDays: num(r.deadline_days),
    revisions: num(r.revisions),
    paymentTerms: str(r.payment_terms),
    scope: str(r.scope),
    exclusions: str(r.exclusions),
    validUntil: ts(r.valid_until),
    status: r.status as ProposalRecord["status"],
    sentAt: tsOrNull(r.sent_at),
    decidedAt: tsOrNull(r.decided_at),
    nextAction: str(r.next_action),
    notes: str(r.notes),
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

export function itemFromRow(r: Row): ItemRecord {
  return {
    id: String(r.id),
    proposalId: String(r.proposal_id),
    description: str(r.description),
    quantity: num(r.quantity),
    unitPrice: num(r.unit_price),
    position: num(r.position),
  };
}

export function transactionFromRow(r: Row): TransactionRecord {
  return {
    id: String(r.id),
    kind: r.kind as TransactionRecord["kind"],
    clientId: idOrNull(r.client_id),
    projectId: idOrNull(r.project_id),
    description: str(r.description),
    amount: num(r.amount),
    dueDate: ts(r.due_date),
    cancelled: Boolean(r.cancelled),
    createdAt: ts(r.created_at),
    updatedAt: ts(r.updated_at),
  };
}

export function paymentFromRow(r: Row): PaymentRecord {
  return {
    id: String(r.id),
    transactionId: String(r.transaction_id),
    amount: num(r.amount),
    date: ts(r.paid_at),
    note: str(r.note),
    position: num(r.position),
  };
}

/* ───────────── Conjunto de mudanças → payload da função apply_changes ───────────── */

export interface ChangePayload {
  upserts: Partial<Record<TableName, Row[]>>;
  deletes: Partial<Record<TableName, string[]>>;
  settings?: unknown;
}

export function changeSetToPayload(c: ChangeSet, now: string = new Date().toISOString()): ChangePayload {
  const u = c.upserts;
  const upserts: ChangePayload["upserts"] = {};
  if (u.leads) upserts.leads = u.leads.map(leadToRow);
  if (u.clients) upserts.clients = u.clients.map(clientToRow);
  if (u.proposals) upserts.proposals = u.proposals.map(proposalToRow);
  if (u.proposal_items) upserts.proposal_items = u.proposal_items.map((x) => itemToRow(x, now));
  if (u.projects) upserts.projects = u.projects.map(projectToRow);
  if (u.project_tasks) upserts.project_tasks = u.project_tasks.map((x) => taskToRow(x, now));
  if (u.transactions) upserts.transactions = u.transactions.map(transactionToRow);
  if (u.payments) upserts.payments = u.payments.map((x) => paymentToRow(x, now));
  if (u.activities) upserts.activities = u.activities.map((x) => activityToRow(x, now));
  const payload: ChangePayload = { upserts, deletes: { ...c.deletes } };
  if (c.settings) payload.settings = c.settings;
  return payload;
}
