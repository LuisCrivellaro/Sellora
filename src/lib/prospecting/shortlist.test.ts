import { expect, it } from "vitest";
import { classify, type Candidate } from "./classify";
import { selectTopProspects } from "./shortlist";

const candidate: Candidate = { id: "osm:node/1", name: "Studio Teste", category: "Cabeleireiro", segment: "beleza", city: "Campinas", uf: "SP", address: "", addressComplete: false, distanceKm: 1, phone: "+55 19 3000-0000", email: "", website: "", instagram: "", otherSocials: [], openingHours: "", brand: null, closed: false, sourceLabel: "OpenStreetMap", sourceUrl: "https://www.openstreetmap.org/node/1" };
const result = (index: number) => ({ ...classify({ ...candidate, id: `osm:node/${index}`, name: `Negócio ${index}`, phone: `193000${String(index).padStart(4, "0")}` }, null, { radiusKm: 10 }), score: 40 + index });

it("seleciona os dez melhores depois de comparar todos, incluindo o melhor que chegou por último", () => {
  const rows = Array.from({ length: 25 }, (_, i) => result(i));
  const top = selectTopProspects(rows, 10);
  expect(top).toHaveLength(10);
  expect(top[0].id).toBe("osm:node/24");
  expect(top.at(-1)?.id).toBe("osm:node/15");
  expect(rows[0].id).toBe("osm:node/0");
});

it("exclui inadequados, descartados, duplicados e candidatos fora do raio e não completa com leads fracos", () => {
  const first = result(1);
  const rows = [first, { ...first, id: "dup", score: first.score - 1 }, { ...result(2), classification: "LOW" as const }, { ...result(3), classification: "SKIP" as const }, { ...result(4), distanceKm: 10.1 }, { ...result(5), discarded: true }, { ...result(6), distanceKm: null }];
  expect(selectTopProspects(rows, 10)).toEqual([first]);
});

it("desempata por confiança, distância e identidade estável", () => {
  const a = { ...result(1), score: 70, confidence: "alta" as const, distanceKm: 2 };
  const b = { ...result(2), score: 70, confidence: "baixa" as const, distanceKm: 1 };
  const c = { ...result(3), score: 70, confidence: "alta" as const, distanceKm: 1 };
  expect(selectTopProspects([b, a, c], 10).map((r) => r.id)).toEqual([c.id, a.id, b.id]);
});

