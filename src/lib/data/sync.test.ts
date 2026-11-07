import { describe, expect, it } from "vitest";
import type { Database } from "../types";
import { remapIds } from "./import";
import {
  activityFromRow,
  changeSetToPayload,
  clientFromRow,
  itemFromRow,
  leadFromRow,
  paymentFromRow,
  projectFromRow,
  proposalFromRow,
  taskFromRow,
  transactionFromRow,
} from "./mappers";
import { createEmptyDatabase, createSeed } from "./seed";
import { assembleDatabase, databaseToChangeSet, diffDatabases, isEmptyChangeSet, splitProject } from "./sync";

/** Banco de exemplo com ids UUID (formato do Postgres), sem flag de demonstração. */
function sampleDb(): Database {
  return remapIds({ ...createSeed(new Date("2026-11-07T12:00:00Z")), demo: false });
}

describe("diff entre estados (modo Supabase)", () => {
  it("estados iguais não geram mudanças", () => {
    const db = sampleDb();
    expect(isEmptyChangeSet(diffDatabases(db, db))).toBe(true);
    expect(isEmptyChangeSet(diffDatabases(db, structuredClone(db)))).toBe(true);
  });

  it("detecta inclusão, alteração e exclusão de linhas de topo", () => {
    const db = sampleDb();
    const [first, second, ...rest] = db.leads;
    const added = { ...first, id: "4b0f3a52-8a33-4b8e-9d4e-2f8d3c1a7e10", name: "Novo" };
    const next: Database = { ...db, leads: [added, { ...first, name: "Alterado" }, ...rest] };
    const c = diffDatabases(db, next);
    expect(c.upserts.leads?.map((l) => l.id).sort()).toEqual([added.id, first.id].sort());
    expect(c.deletes.leads).toEqual([second.id]);
    expect(c.upserts.clients).toBeUndefined();
  });

  it("filhos: só a tarefa alterada vai para o banco; pai intacto não é reenviado", () => {
    const db = sampleDb();
    const p = db.projects[0];
    const next: Database = {
      ...db,
      projects: db.projects.map((x) => (x.id === p.id ? { ...x, tasks: x.tasks.map((t, i) => (i === 0 ? { ...t, done: !t.done } : t)) } : x)),
    };
    const c = diffDatabases(db, next);
    expect(c.upserts.projects).toBeUndefined();
    expect(c.upserts.project_tasks).toHaveLength(1);
    expect(c.upserts.project_tasks?.[0]).toMatchObject({ id: p.tasks[0].id, projectId: p.id, position: 0 });
  });

  it("remover item da proposta gera exclusão do filho e reposiciona os seguintes", () => {
    const db = sampleDb();
    const prop = db.proposals.find((x) => x.items.length >= 2) ?? db.proposals[0];
    const withTwo = prop.items.length >= 2 ? prop : { ...prop, items: [...prop.items, { ...prop.items[0], id: "0c6f9b7e-1d2a-4c3b-8e5f-6a7b8c9d0e1f" }] };
    const base: Database = { ...db, proposals: db.proposals.map((x) => (x.id === prop.id ? withTwo : x)) };
    const next: Database = { ...base, proposals: base.proposals.map((x) => (x.id === prop.id ? { ...x, items: x.items.slice(1) } : x)) };
    const c = diffDatabases(base, next);
    expect(c.deletes.proposal_items).toEqual([withTwo.items[0].id]);
    expect(c.upserts.proposal_items?.[0]).toMatchObject({ id: withTwo.items[1].id, position: 0 });
  });

  it("pai excluído não lista filhos (cascata no banco)", () => {
    const db = sampleDb();
    const tx = db.transactions.find((t) => t.payments.length > 0)!;
    const c = diffDatabases(db, { ...db, transactions: db.transactions.filter((t) => t.id !== tx.id) });
    expect(c.deletes.transactions).toEqual([tx.id]);
    expect(c.deletes.payments).toBeUndefined();
  });

  it("configurações só entram quando mudam", () => {
    const db = sampleDb();
    const next = { ...db, settings: { ...db.settings, monthlyLeadTarget: 77 } };
    expect(diffDatabases(db, next).settings?.monthlyLeadTarget).toBe(77);
    expect(diffDatabases(db, { ...db, settings: { ...db.settings } }).settings).toBeUndefined();
  });
});

describe("mapeamento TS ↔ colunas", () => {
  it("ida e volta (payload snake_case → domínio) preserva o banco inteiro", () => {
    const db = sampleDb();
    const payload = changeSetToPayload(databaseToChangeSet(db));
    const u = payload.upserts;
    const rebuilt = assembleDatabase(
      {
        leads: (u.leads ?? []).map(leadFromRow),
        clients: (u.clients ?? []).map(clientFromRow),
        activities: (u.activities ?? []).map(activityFromRow),
        projects: (u.projects ?? []).map(projectFromRow),
        tasks: (u.project_tasks ?? []).map(taskFromRow),
        proposals: (u.proposals ?? []).map(proposalFromRow),
        items: (u.proposal_items ?? []).map(itemFromRow),
        transactions: (u.transactions ?? []).map(transactionFromRow),
        payments: (u.payments ?? []).map(paymentFromRow),
      },
      db.settings,
      { version: db.version, seededAt: db.seededAt },
    );
    expect(rebuilt).toEqual(db);
  });

  it("colunas usam snake_case e pagamento usa paid_at", () => {
    const db = sampleDb();
    const payload = changeSetToPayload(databaseToChangeSet(db));
    expect(Object.keys(payload.upserts.leads![0])).toContain("website_situation");
    expect(Object.keys(payload.upserts.leads![0])).not.toContain("websiteSituation");
    expect(payload.upserts.payments![0]).toHaveProperty("paid_at");
    expect(payload.upserts.leads![0]).not.toHaveProperty("owner_id");
  });

  it("normaliza datas e numéricos vindos do Postgres", () => {
    const row = { ...changeSetToPayload(databaseToChangeSet(sampleDb())).upserts.leads![0] };
    row.created_at = "2026-11-07 15:00:00+00";
    row.potential_value = "990.50";
    const lead = leadFromRow(row);
    expect(lead.createdAt).toBe("2026-11-07T15:00:00.000Z");
    expect(lead.potentialValue).toBe(990.5);
  });

  it("achatamento guarda posição dos filhos", () => {
    const p = sampleDb().projects[0];
    const { children } = splitProject(p);
    expect(children.map((c) => c.position)).toEqual(p.tasks.map((_, i) => i));
  });

  it("banco vazio não gera nada para gravar", () => {
    expect(isEmptyChangeSet(databaseToChangeSet(createEmptyDatabase()))).toBe(true);
  });
});
