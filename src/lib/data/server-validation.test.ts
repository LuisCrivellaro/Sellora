import { describe, expect, it } from "vitest";
import { safeNextPath, isSupabaseConfigured } from "../supabase/config";
import { UUID_RE, uid } from "../utils";
import { checkImportFile, remapIds } from "./import";
import { changeSetSchema, parseChangeSet } from "./row-schemas";
import { createEmptyDatabase, createSeed } from "./seed";
import { databaseToChangeSet } from "./sync";

const realDb = () => remapIds({ ...createSeed(new Date("2026-11-07T12:00:00Z")), demo: false });

describe("validação no servidor (Zod)", () => {
  it("aceita todas as entidades de um banco válido", () => {
    const parsed = changeSetSchema.safeParse(databaseToChangeSet(realDb()));
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 2))).toBe(true);
  });

  it("recusa ids fora do formato UUID (ex.: ids da semente de demonstração)", () => {
    const seed = createSeed();
    const parsed = changeSetSchema.safeParse(databaseToChangeSet({ ...seed, demo: false }));
    expect(parsed.success).toBe(false);
  });

  it("recusa tabela desconhecida, campo inválido e lote vazio de lixo", () => {
    expect(changeSetSchema.safeParse({ upserts: { usuarios: [] }, deletes: {} }).success).toBe(false);
    const c = databaseToChangeSet(realDb());
    const lead = { ...c.upserts.leads![0], uf: "São Paulo" };
    expect(changeSetSchema.safeParse({ ...c, upserts: { leads: [lead] } }).success).toBe(false);
    const neg = { ...c.upserts.transactions![0], amount: -10 };
    expect(changeSetSchema.safeParse({ upserts: { transactions: [neg] }, deletes: {} }).success).toBe(false);
    expect(changeSetSchema.safeParse({ upserts: {}, deletes: { leads: ["1; drop table leads"] } }).success).toBe(false);
  });

  it("aceita a origem prospeccao_ia (lead importado da Prospecção IA) e recusa origem desconhecida", () => {
    const c = databaseToChangeSet(realDb());
    const lead = { ...c.upserts.leads![0], source: "prospeccao_ia" };
    expect(changeSetSchema.safeParse({ upserts: { leads: [lead] }, deletes: {} }).success).toBe(true);
    expect(changeSetSchema.safeParse({ upserts: { leads: [{ ...lead, source: "robo" }] }, deletes: {} }).success).toBe(false);
  });

  it("normaliza entrada (trim, UF maiúscula, site vazio → null)", () => {
    const c = databaseToChangeSet(realDb());
    const lead = { ...c.upserts.leads![0], name: "  Café Aurora  ", uf: "sp", website: "" };
    const out = parseChangeSet({ upserts: { leads: [lead] }, deletes: {} });
    expect(out.upserts.leads![0]).toMatchObject({ name: "Café Aurora", uf: "SP", website: null });
  });

  it("projeto com prazo antes do início é recusado", () => {
    const c = databaseToChangeSet(realDb());
    const p = { ...c.upserts.projects![0], startDate: "2026-11-10T12:00:00.000Z", dueDate: "2026-11-01T12:00:00.000Z" };
    expect(changeSetSchema.safeParse({ upserts: { projects: [p] }, deletes: {} }).success).toBe(false);
  });
});

describe("importação do JSON local", () => {
  it("recusa arquivo de demonstração", () => {
    const r = checkImportFile(createSeed());
    expect(r.ok).toBe(false);
  });

  it("recusa arquivo que não é export da Sellora", () => {
    expect(checkImportFile({ foo: 1 }).ok).toBe(false);
    expect(checkImportFile(null).ok).toBe(false);
  });

  it("aceita dados reais e troca ids antigos por UUID mantendo vínculos", () => {
    const local = { ...createSeed(), demo: false };
    expect(checkImportFile(local).ok).toBe(true);
    const out = remapIds(local);
    expect(out.leads.every((l) => UUID_RE.test(l.id))).toBe(true);
    const leadIds = new Set(out.leads.map((l) => l.id));
    const clientIds = new Set(out.clients.map((c) => c.id));
    expect(out.activities.every((a) => a.leadId === null || leadIds.has(a.leadId))).toBe(true);
    expect(out.projects.every((p) => clientIds.has(p.clientId))).toBe(true);
    expect(out.leads.filter((l) => l.clientId).every((l) => clientIds.has(l.clientId!))).toBe(true);
  });

  it("vínculo para registro ausente vira null; projeto sem cliente é descartado", () => {
    const db = createEmptyDatabase();
    const local = {
      ...db,
      clients: [],
      projects: [{ ...realDb().projects[0], id: "proj_x", clientId: "cli_inexistente" }],
      transactions: [{ ...realDb().transactions[0], id: "tx_x", clientId: "cli_inexistente", projectId: "proj_x" }],
    };
    const out = remapIds(local);
    expect(out.projects).toHaveLength(0);
    expect(out.transactions[0].clientId).toBeNull();
    expect(out.transactions[0].projectId).toBeNull();
  });
});

describe("configuração e utilitários", () => {
  it("modo Supabase só com URL e chave plausíveis", () => {
    expect(isSupabaseConfigured("", "")).toBe(false);
    expect(isSupabaseConfigured("https://abc.supabase.co", "")).toBe(false);
    expect(isSupabaseConfigured("https://abc.supabase.co", "sb_publishable_abcdefghijklmnopqrstuvwxyz")).toBe(true);
  });

  it("destino pós-login aceita só caminhos internos", () => {
    expect(safeNextPath("/leads?visao=kanban")).toBe("/leads?visao=kanban");
    expect(safeNextPath("https://evil.com")).toBe("/dashboard");
    expect(safeNextPath("//evil.com")).toBe("/dashboard");
    expect(safeNextPath("/\\evil.com")).toBe("/dashboard");
    expect(safeNextPath("/entrar")).toBe("/dashboard");
    expect(safeNextPath("/\t/evil.com")).toBe("/dashboard");
    expect(safeNextPath("/\n/evil.com")).toBe("/dashboard");
    expect(safeNextPath("/%2F%2Fevil.com")).toBe("/%2F%2Fevil.com");
    expect(safeNextPath(undefined)).toBe("/dashboard");
  });

  it("uid gera UUID v4 válido", () => {
    expect(UUID_RE.test(uid("lead"))).toBe(true);
  });
});
