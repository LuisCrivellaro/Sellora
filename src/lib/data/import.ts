import type { Database, ID } from "../types";
import { uid, UUID_RE } from "../utils";

/**
 * Preparação do JSON exportado do modo local para importação no banco.
 * - Recusa arquivos de demonstração (dados fictícios nunca entram no banco real).
 * - Troca identificadores antigos (ex.: "lead_ab12…") por UUID, mantendo os vínculos.
 * - Vínculos para registros que não estão no arquivo viram null.
 */

export type ImportCheck =
  | { ok: true; db: Database; counts: Record<string, number> }
  | { ok: false; message: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export function checkImportFile(value: unknown): ImportCheck {
  if (!isObj(value)) return { ok: false, message: "Arquivo inválido: não é um export da Sellora." };
  const lists = ["leads", "clients", "activities", "projects", "proposals", "transactions"] as const;
  if (lists.some((k) => !Array.isArray(value[k])) || !isObj(value.settings)) {
    return { ok: false, message: "Arquivo inválido: faltam listas esperadas (leads, clientes, projetos…)." };
  }
  if (value.demo !== false) {
    return {
      ok: false,
      message: "Este arquivo contém dados de demonstração e não pode ir para o banco real. No modo local, use “Começar do zero”, cadastre os dados reais e exporte de novo.",
    };
  }
  const db = value as unknown as Database;
  const counts = {
    Leads: db.leads.length,
    Clientes: db.clients.length,
    Projetos: db.projects.length,
    Propostas: db.proposals.length,
    Lançamentos: db.transactions.length,
    Atividades: db.activities.length,
  };
  return { ok: true, db, counts };
}

export function remapIds(db: Database): Database {
  const map = new Map<ID, ID>();
  const fresh = (old: ID) => {
    const next = UUID_RE.test(old) ? old : uid();
    map.set(old, next);
    return next;
  };
  // 1ª passada: novos ids para todas as entidades com vínculo possível.
  db.leads.forEach((x) => fresh(x.id));
  db.clients.forEach((x) => fresh(x.id));
  db.projects.forEach((x) => fresh(x.id));
  db.proposals.forEach((x) => fresh(x.id));
  db.transactions.forEach((x) => fresh(x.id));
  // Projeto sem o cliente no arquivo não pode ser gravado (cliente é obrigatório):
  // sai do mapa para que nada aponte para ele.
  db.projects.forEach((p) => {
    if (!map.has(p.clientId)) map.delete(p.id);
  });

  const ref = (old: ID | null | undefined): ID | null => (old ? (map.get(old) ?? null) : null);
  const own = (old: ID) => map.get(old) ?? (UUID_RE.test(old) ? old : uid());

  return {
    ...db,
    leads: db.leads.map((l) => ({ ...l, id: own(l.id), clientId: ref(l.clientId) })),
    clients: db.clients.map((c) => ({ ...c, id: own(c.id), leadId: ref(c.leadId) })),
    activities: db.activities.map((a) => ({
      ...a,
      id: UUID_RE.test(a.id) ? a.id : uid(),
      leadId: ref(a.leadId),
      clientId: ref(a.clientId),
      projectId: ref(a.projectId),
    })),
    projects: db.projects
      .filter((p) => map.has(p.clientId) && map.has(p.id))
      .map((p) => ({
        ...p,
        id: own(p.id),
        clientId: map.get(p.clientId) as ID,
        proposalId: ref(p.proposalId),
        tasks: p.tasks.map((t) => ({ ...t, id: UUID_RE.test(t.id) ? t.id : uid() })),
      })),
    proposals: db.proposals.map((p) => ({
      ...p,
      id: own(p.id),
      leadId: ref(p.leadId),
      clientId: ref(p.clientId),
      items: p.items.map((it) => ({ ...it, id: UUID_RE.test(it.id) ? it.id : uid() })),
    })),
    transactions: db.transactions.map((t) => ({
      ...t,
      id: own(t.id),
      clientId: ref(t.clientId),
      projectId: ref(t.projectId),
      payments: t.payments.map((p) => ({ ...p, id: UUID_RE.test(p.id) ? p.id : uid() })),
    })),
  };
}
