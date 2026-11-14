import { expect, it } from "vitest";
import calibration from "./fixtures/calibration-history.json";
import { compareIdentity, identityOf, originalityReport, sectionFunctionFromId, type IdentitySource } from "./identity";

type Item = (typeof calibration.items)[number];
const source = (item: Item): IdentitySource => ({ segment: item.segment, fonts: item.fonts, palette: item.palette, sections: item.sections, hero: item.hero, headline: "" });
const byId = Object.fromEntries(calibration.items.map((item) => [item.site, item]));
const identity = (id: string) => ({ ...identityOf(source(byId[id])).identity, imageAspect: byId[id].imageAspect });
const pair = (a: string, b: string) => compareIdentity(identity(a), identity(b), byId[a].segment === byId[b].segment);

it("calibração com as 5 demos reais: o trio foto-painel repete estrutura entre segmentos; o restaurante v2 é distinto", () => {
  // barbearia, restaurante v1 e clínica: mesmo hero de foto inteira com painel e o mesmo esqueleto de seções.
  expect(["cor", "repetida"]).toContain(pair("871275a1", "9469cd61").verdict); // + mesma fonte de destaque (Young Serif)
  expect(["parecida", "repetida"]).toContain(pair("f2d9b0ce", "9469cd61").verdict);
  expect(["parecida", "repetida"]).toContain(pair("f2d9b0ce", "871275a1").verdict);
  // Oficina (colunas) x barbearia: hero diferente, mas mesmas fontes e mesmo esqueleto: fica marcada para revisão.
  expect(["parecida", "repetida"]).toContain(pair("562f0fac", "f2d9b0ce").verdict);
  // Restaurante v2 (tipográfico, fundo escuro, outras fontes e seções) é distinto do v1 do mesmo segmento.
  expect(pair("fd67a0e7", "871275a1").verdict).toBe("distinta");
});

it("as regras de acervo apontam a repetição de fontes e de esqueleto que a revisão manual encontrou", () => {
  const ordered = [...calibration.items].reverse().map(source); // mais nova primeiro
  // Reproduz a geração da oficina com o histórico que existia antes dela.
  const before = ordered.slice(1);
  const oficina = { ...identityOf(source(byId["562f0fac"])).identity, imageAspect: "4:5" };
  const report = originalityReport(oficina, "servicos", before);
  expect(report.issues.join(" ")).toContain("Big Shoulders Display");
  expect(report.compared).toBe(4);
  expect(report.partial).toBe(4);
  expect(report.notes.join(" ")).toContain("não têm identidade completa");
  // A clínica, gerada depois de barbearia e restaurante v1, repetia o hero das duas mais recentes e a Young Serif.
  const clinic = identityOf(source(byId["9469cd61"])).identity;
  const clinicReport = originalityReport(clinic, "saude", [source(byId["871275a1"]), source(byId["f2d9b0ce"])]);
  expect(clinicReport.issues.join(" ")).toContain("[foto-painel]");
  expect(clinicReport.issues.join(" ")).toContain("Young Serif");
});

it("troca só de cor é detectada como repetição; coincidências superficiais não reprovam", () => {
  const base = identity("562f0fac");
  const recolored = { ...base, background: "#101418", accent: "#2f7de1", tone: "escuro" as const };
  expect(compareIdentity(recolored, base, true).verdict).toBe("cor");
  const different = { ...base, hero: "tipografico", sections: ["hero", "oferta", "localizacao", "contato"], displayFont: "Fraunces", displayCategory: "serifa", bodyFont: "Figtree", imageAspect: "21:9", ctas: ["ver como chegar"] };
  const cmp = compareIdentity(different, { ...base, ctas: ["ver como chegar"] }, true);
  expect(cmp.verdict).toBe("distinta");
});

it("função das seções inferida dos ids antigos", () => {
  expect(["inicio", "oficina", "servicos", "atendimento", "duvidas", "contato", "rodape"].map(sectionFunctionFromId)).toEqual(["hero", "espaco", "oferta", "processo", "perguntas", "contato", "rodape"]);
});

it("hero repetido entre segmentos diferentes também é recusado (duas demos mais recentes)", () => {
  const base = identityOf(source(byId["562f0fac"])).identity; // oficina, [colunas]
  const recent = [{ segment: "saude", hero: "[colunas] texto à esquerda", fonts: ["Spectral", "Literata"], palette: ["#ffffff", "#eeeeee", "#111111", "#444444", "#0f5c59", "#ffffff"], sections: ["inicio", "contato"] }];
  const report = originalityReport({ ...base, displayFont: "Gloock", bodyFont: "Onest" }, "restaurantes", recent);
  expect(report.issues.join(" ")).toContain("[colunas]");
  expect(originalityReport({ ...base, hero: "indice", displayFont: "Gloock", bodyFont: "Onest" }, "restaurantes", recent).issues.join(" ")).not.toContain("arquétipo");
});
