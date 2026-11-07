import type {
  Activity,
  Client,
  Database,
  ID,
  Lead,
  Payment,
  Project,
  ProjectTask,
  Proposal,
  ProposalItem,
  Settings,
  Transaction,
} from "../types";

/**
 * Conjunto de mudanças entre dois estados do banco — o que o modo Supabase envia
 * ao servidor depois de cada operação. Linhas "achatadas": filhos (tarefas,
 * itens, pagamentos) viram registros próprios com referência ao pai e posição.
 * Funções puras, sem dependência de navegador ou servidor.
 */

export type ProjectRecord = Omit<Project, "tasks">;
export type TaskRecord = ProjectTask & { projectId: ID; position: number };
export type ProposalRecord = Omit<Proposal, "items">;
export type ItemRecord = ProposalItem & { proposalId: ID; position: number };
export type TransactionRecord = Omit<Transaction, "payments">;
export type PaymentRecord = Payment & { transactionId: ID; position: number };

export interface TableRecords {
  leads: Lead;
  clients: Client;
  proposals: ProposalRecord;
  proposal_items: ItemRecord;
  projects: ProjectRecord;
  project_tasks: TaskRecord;
  transactions: TransactionRecord;
  payments: PaymentRecord;
  activities: Activity;
}

export type TableName = keyof TableRecords;

export const TABLES: TableName[] = [
  "leads",
  "clients",
  "proposals",
  "proposal_items",
  "projects",
  "project_tasks",
  "transactions",
  "payments",
  "activities",
];

export interface ChangeSet {
  upserts: { [K in TableName]?: TableRecords[K][] };
  deletes: { [K in TableName]?: ID[] };
  settings?: Settings;
}

/* ───────────── Achatamento (entidade com filhos → registros) ───────────── */

export function splitProject(p: Project): { record: ProjectRecord; children: TaskRecord[] } {
  const { tasks, ...record } = p;
  return { record, children: tasks.map((t, position) => ({ ...t, projectId: p.id, position })) };
}

export function splitProposal(p: Proposal): { record: ProposalRecord; children: ItemRecord[] } {
  const { items, ...record } = p;
  return { record, children: items.map((it, position) => ({ ...it, proposalId: p.id, position })) };
}

export function splitTransaction(t: Transaction): { record: TransactionRecord; children: PaymentRecord[] } {
  const { payments, ...record } = t;
  return { record, children: payments.map((p, position) => ({ ...p, transactionId: t.id, position })) };
}

/* ───────────── Diferença ───────────── */

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function diffFlat<T extends { id: ID }>(prev: T[], next: T[]) {
  const before = new Map(prev.map((x) => [x.id, x]));
  const upserts: T[] = [];
  for (const n of next) {
    const p = before.get(n.id);
    before.delete(n.id);
    if (p === n) continue;
    if (!p || !same(p, n)) upserts.push(n);
  }
  return { upserts, deletes: [...before.keys()] };
}

/**
 * Diferença de uma entidade com filhos. Pais removidos apagam os filhos por
 * cascata no banco, então só filhos de pais que continuam são comparados.
 */
function diffNested<E extends { id: ID }, R, C extends { id: ID }>(
  prev: E[],
  next: E[],
  split: (e: E) => { record: R; children: C[] },
) {
  const before = new Map(prev.map((x) => [x.id, x]));
  const upserts: R[] = [];
  const childUpserts: C[] = [];
  const childDeletes: ID[] = [];
  for (const n of next) {
    const p = before.get(n.id);
    before.delete(n.id);
    if (p === n) continue;
    const ns = split(n);
    if (!p) {
      upserts.push(ns.record);
      childUpserts.push(...ns.children);
      continue;
    }
    const ps = split(p);
    if (!same(ps.record, ns.record)) upserts.push(ns.record);
    const c = diffFlat(ps.children, ns.children);
    childUpserts.push(...c.upserts);
    childDeletes.push(...c.deletes);
  }
  return { upserts, deletes: [...before.keys()], childUpserts, childDeletes };
}

export function diffDatabases(prev: Database, next: Database): ChangeSet {
  const out: ChangeSet = { upserts: {}, deletes: {} };
  const put = <K extends TableName>(table: K, ups: TableRecords[K][], dels: ID[]) => {
    if (ups.length) out.upserts[table] = ups as ChangeSet["upserts"][K];
    if (dels.length) out.deletes[table] = dels;
  };

  const leads = diffFlat(prev.leads, next.leads);
  put("leads", leads.upserts, leads.deletes);
  const clients = diffFlat(prev.clients, next.clients);
  put("clients", clients.upserts, clients.deletes);
  const activities = diffFlat(prev.activities, next.activities);
  put("activities", activities.upserts, activities.deletes);

  const projects = diffNested(prev.projects, next.projects, splitProject);
  put("projects", projects.upserts, projects.deletes);
  put("project_tasks", projects.childUpserts, projects.childDeletes);

  const proposals = diffNested(prev.proposals, next.proposals, splitProposal);
  put("proposals", proposals.upserts, proposals.deletes);
  put("proposal_items", proposals.childUpserts, proposals.childDeletes);

  const transactions = diffNested(prev.transactions, next.transactions, splitTransaction);
  put("transactions", transactions.upserts, transactions.deletes);
  put("payments", transactions.childUpserts, transactions.childDeletes);

  if (prev.settings !== next.settings && !same(prev.settings, next.settings)) out.settings = next.settings;
  return out;
}

export function isEmptyChangeSet(c: ChangeSet): boolean {
  return Object.keys(c.upserts).length === 0 && Object.keys(c.deletes).length === 0 && !c.settings;
}

/** Todos os registros de um banco como inserções (usado na importação do JSON local). */
export function databaseToChangeSet(db: Database): ChangeSet {
  const empty: Database = { ...db, leads: [], clients: [], activities: [], projects: [], proposals: [], transactions: [] };
  const changes = diffDatabases(empty, db);
  delete changes.settings;
  return changes;
}

/** Monta o banco a partir dos registros achatados (inverso do achatamento). */
export function assembleDatabase(
  parts: {
    leads: Lead[];
    clients: Client[];
    activities: Activity[];
    projects: ProjectRecord[];
    tasks: TaskRecord[];
    proposals: ProposalRecord[];
    items: ItemRecord[];
    transactions: TransactionRecord[];
    payments: PaymentRecord[];
  },
  settings: Settings,
  meta: { version: number; seededAt: string },
): Database {
  const group = <C extends { position: number }>(rows: C[], key: (c: C) => ID) => {
    const m = new Map<ID, C[]>();
    for (const r of rows) {
      const k = key(r);
      const list = m.get(k);
      if (list) list.push(r);
      else m.set(k, [r]);
    }
    for (const list of m.values()) list.sort((a, b) => a.position - b.position);
    return m;
  };
  const tasks = group(parts.tasks, (t) => t.projectId);
  const items = group(parts.items, (i) => i.proposalId);
  const payments = group(parts.payments, (p) => p.transactionId);

  return {
    version: meta.version,
    demo: false,
    seededAt: meta.seededAt,
    leads: parts.leads,
    clients: parts.clients,
    activities: parts.activities,
    projects: parts.projects.map((p) => ({
      ...p,
      tasks: (tasks.get(p.id) ?? []).map(({ id, title, stage, done, doneAt }) => ({ id, title, stage, done, doneAt })),
    })),
    proposals: parts.proposals.map((p) => ({
      ...p,
      items: (items.get(p.id) ?? []).map(({ id, description, quantity, unitPrice }) => ({ id, description, quantity, unitPrice })),
    })),
    transactions: parts.transactions.map((t) => ({
      ...t,
      payments: (payments.get(t.id) ?? []).map(({ id, amount, date, note }) => ({ id, amount, date, note })),
    })),
    settings,
  };
}
