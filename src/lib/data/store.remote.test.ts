import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Database } from "../types";
import { createEmptyDatabase } from "./seed";

/**
 * Modo Supabase do store com as server actions simuladas: confere a fila de
 * gravação, a parada em erro, o reenvio e o descarte. (O banco real é testado
 * pelo script de RLS; aqui é só a lógica do navegador.)
 */

const actions = vi.hoisted(() => ({ loadDatabase: vi.fn(), applyChanges: vi.fn() }));
vi.mock("./actions", () => actions);

const lead = {
  name: "Padaria Teste",
  segment: "comercio" as const,
  city: "Campinas",
  uf: "SP",
  source: "manual" as const,
  website: "",
  websiteSituation: "sem_site" as const,
  stage: "novo" as const,
  priority: "media" as const,
  phone: "",
  email: "",
  instagram: "",
  potentialValue: 590,
  nextAction: "",
  nextActionAt: null,
  notes: "",
};

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeAll(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemplo.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_chave_de_teste_123456");
  vi.stubGlobal("window", {
    localStorage: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
    location: { assign: vi.fn(), pathname: "/dashboard", search: "" },
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.resetModules();
  actions.loadDatabase.mockReset();
  actions.applyChanges.mockReset();
  const db: Database = createEmptyDatabase(undefined, new Date("2026-11-07T12:00:00Z"));
  actions.loadDatabase.mockResolvedValue({ ok: true, data: { db, email: "admin@exemplo.com" } });
});

async function boot() {
  const store = await import("./store");
  const repo = await import("./repository");
  await store.ensureLoaded();
  return { store, repo };
}

describe("store em modo Supabase", () => {
  it("carrega do servidor e expõe a conta", async () => {
    const { store } = await boot();
    const s = store.getStoreState();
    expect(s.mode).toBe("supabase");
    expect(s.status).toBe("ready");
    expect(s.account?.email).toBe("admin@exemplo.com");
    expect(s.db?.demo).toBe(false);
  });

  it("gravação envia só o diff e confirma", async () => {
    actions.applyChanges.mockResolvedValue({ ok: true, data: null });
    const { store, repo } = await boot();
    const created = repo.createLead(lead);
    expect(store.getStoreState().sync.pending).toBe(1);
    await flush();
    expect(actions.applyChanges).toHaveBeenCalledTimes(1);
    const sent = actions.applyChanges.mock.calls[0][0];
    expect(sent.upserts.leads).toHaveLength(1);
    expect(sent.upserts.leads[0].id).toBe(created.id);
    expect(Object.keys(sent.upserts)).toEqual(["leads"]);
    expect(store.getStoreState().sync).toEqual({ pending: 0, error: null, authExpired: false });
  });

  it("falha para a fila; reenviar grava; nada é perdido", async () => {
    actions.applyChanges.mockResolvedValueOnce({ ok: false, code: "server", message: "Falhou." });
    const { store, repo } = await boot();
    repo.createLead(lead);
    await flush();
    expect(store.getStoreState().sync).toMatchObject({ pending: 1, error: "Falhou." });
    expect(store.getStoreState().db?.leads).toHaveLength(1);

    actions.applyChanges.mockResolvedValue({ ok: true, data: null });
    store.retrySync();
    await flush();
    expect(actions.applyChanges).toHaveBeenCalledTimes(2);
    expect(store.getStoreState().sync).toMatchObject({ pending: 0, error: null });
  });

  it("descartar volta ao último estado confirmado pelo banco", async () => {
    actions.applyChanges.mockResolvedValueOnce({ ok: true, data: null }).mockResolvedValue({ ok: false, code: "server", message: "Falhou." });
    const { store, repo } = await boot();
    const kept = repo.createLead(lead);
    await flush();
    repo.createLead({ ...lead, name: "Não salvo" });
    await flush();
    expect(store.getStoreState().db?.leads).toHaveLength(2);
    store.discardPending();
    expect(store.getStoreState().db?.leads.map((l) => l.id)).toEqual([kept.id]);
    expect(store.getStoreState().sync.pending).toBe(0);
  });

  it("sessão expirada sinaliza novo login", async () => {
    actions.applyChanges.mockResolvedValue({ ok: false, code: "auth", message: "Sua sessão expirou." });
    const { store, repo } = await boot();
    repo.createLead(lead);
    await flush();
    expect(store.getStoreState().sync.authExpired).toBe(true);
  });

  it("dados de demonstração nunca são gravados no banco", async () => {
    const { repo } = await boot();
    expect(() => repo.resetDemoData()).toThrow();
    expect(() => repo.startFromScratch()).toThrow();
    expect(actions.applyChanges).not.toHaveBeenCalled();
  });

  it("falha ao carregar mostra erro; sem sessão vai para /entrar", async () => {
    actions.loadDatabase.mockResolvedValueOnce({ ok: false, code: "server", message: "Não foi possível carregar os dados do banco." });
    const { store } = await boot();
    expect(store.getStoreState().status).toBe("error");

    vi.resetModules();
    actions.loadDatabase.mockResolvedValueOnce({ ok: false, code: "auth", message: "x" });
    const again = await import("./store");
    await again.ensureLoaded();
    expect((window.location.assign as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0]).toBe("/entrar?next=%2Fdashboard");
  });
});
