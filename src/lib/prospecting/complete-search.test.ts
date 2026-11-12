import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyDatabase } from "../data/seed";
import { getDb, replaceDatabase } from "../data/store";
import { classify, type Candidate } from "./classify";
import { completeProspectSearch } from "./complete-search";
import { getProspectState, loadProspects, removeSearchHistory, startSearch } from "./store";
import type { JobView } from "./types";
import { enqueueDemoGeneration } from "../demos/generation-client";

vi.mock("../demos/generation-client", () => ({ enqueueDemoGeneration: vi.fn() }));

beforeAll(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) } });
  loadProspects("local");
});
beforeEach(() => { replaceDatabase(createEmptyDatabase()); removeSearchHistory(); vi.clearAllMocks(); });

const candidate: Candidate = { id: "osm:node/1", name: "Studio Teste", category: "Cabeleireiro", segment: "beleza", city: "Campinas", uf: "SP", address: "", addressComplete: false, distanceKm: 1, phone: "+55 19 3000-0000", email: "", website: "", instagram: "", otherSocials: [], openingHours: "", brand: null, closed: false, sourceLabel: "OpenStreetMap", sourceUrl: "https://www.openstreetmap.org/node/1" };
const job: JobView = { id: "job1", executor: "osm", params: { city: "Campinas", uf: "SP", segment: "beleza", radiusKm: 10, maxResults: 10, opportunity: "todas" }, status: "completed", phase: "done", message: "Concluída", candidates: 1, analyzed: 1, planned: 1, found: 1, warnings: [], error: null, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), results: [classify(candidate, null, { radiusKm: 10 })], attribution: "OpenStreetMap" };

describe("pesquisa para revisão administrativa", () => {
  it("salva os resultados sem importar ou gerar demos, inclusive com a intenção antiga de geração automática", () => {
    startSearch({ ...job, status: "running", results: null }, true);
    expect(getProspectState().searches[0].generateDemos).toBe(true);
    completeProspectSearch(job);
    expect(getDb().leads).toHaveLength(0);
    expect(getProspectState().results).toHaveLength(1);
    expect(getProspectState().results[0].importedLeadId).toBeNull();
    expect(enqueueDemoGeneration).not.toHaveBeenCalled();
    completeProspectSearch(job);
    expect(getDb().leads).toHaveLength(0);
    expect(getProspectState().results).toHaveLength(1);
    expect(enqueueDemoGeneration).not.toHaveBeenCalled();
  });
  it("busca simples e pesquisa cancelada não geram demos nem importam leads", () => {
    startSearch(job);
    completeProspectSearch(job);
    expect(getDb().leads).toHaveLength(0);
    startSearch({ ...job, id: "cancelled" }, true);
    completeProspectSearch({ ...job, id: "cancelled", status: "cancelled" });
    expect(getDb().leads).toHaveLength(0);
  });
});
