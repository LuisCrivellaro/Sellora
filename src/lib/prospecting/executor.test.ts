import { beforeEach, expect, it, vi } from "vitest";
import type { Candidate } from "./classify";
import { runOsmProspecting } from "./executor";
import { checkSite } from "./site-check";

const source = vi.hoisted(() => ({ candidates: [] as Candidate[] }));
vi.mock("./osm", async (original) => ({
  ...await original<typeof import("./osm")>(),
  geocodeCity: vi.fn(async () => ({ lat: -22.9, lon: -47.0 })),
  fetchOverpass: vi.fn(async () => source.candidates.map((_, index) => ({ id: index }))),
  toCandidate: (element: { id: number }) => source.candidates[element.id],
}));
vi.mock("./site-check", () => ({ checkSite: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  source.candidates = Array.from({ length: 25 }, (_, index) => ({
    id: `osm:node/${index}`, name: `Negócio ${index}`, category: "Cabeleireiro", segment: "beleza", city: "Campinas", uf: "SP", address: "", addressComplete: false,
    distanceKm: 1, phone: `193000${String(index).padStart(4, "0")}`, email: "", website: "", instagram: "", otherSocials: [], openingHours: "", brand: null, closed: false, sourceLabel: "OpenStreetMap", sourceUrl: `https://www.openstreetmap.org/node/${index}`,
  }));
});

it("avalia a região antes de escolher dez e não encerra nos primeiros contatos", async () => {
  const last = source.candidates.at(-1)!;
  Object.assign(last, { distanceKm: 2, address: "Rua de Teste, 10", addressComplete: true, openingHours: "Mo-Fr 09:00-18:00", instagram: "@negocioteste" });
  const report = vi.fn();
  const output = await runOsmProspecting({ city: "Campinas", uf: "SP", segment: "beleza", radiusKm: 10, maxResults: 100, opportunity: "todas" }, new AbortController().signal, report);
  expect(output.results).toHaveLength(10);
  expect(output.results[0].id).toBe(last.id);
  expect(report).toHaveBeenCalledWith(expect.objectContaining({ analyzed: 25 }));
  expect(checkSite).not.toHaveBeenCalled();
});

it("retorna menos de dez quando a região tem poucas oportunidades qualificadas", async () => {
  source.candidates = source.candidates.slice(0, 4);
  source.candidates[1].closed = true;
  source.candidates[2].distanceKm = 12;
  source.candidates[3].brand = "Franquia";
  const output = await runOsmProspecting({ city: "Campinas", uf: "SP", segment: "beleza", radiusKm: 10, maxResults: 10, opportunity: "todas" }, new AbortController().signal, vi.fn());
  expect(output.results.map((result) => result.id)).toEqual(["osm:node/0"]);
});
