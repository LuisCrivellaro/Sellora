import { describe, expect, it } from "vitest";
import { demoKinds, demoVariant, detectDemoKind, monogram, type DemoKind } from "./kinds";
import { createLeadDemo, demoPreviewUrl, leadDemoSchema, parseDemoDocument } from "./model";
import type { Lead, Segment } from "../types";

const b = (name: string, segment: Segment = "beleza", category?: string) => ({ name, city: "Cuiabá", uf: "MT", segment, phone: "", category });

describe("demos v3: tipo do negócio", () => {
  it("reconhece o tipo pelo nome (casos reais de Cuiabá)", () => {
    const cases: [string, DemoKind][] = [
      ["IM MASSAGEM", "massagem"], ["Salão Define", "cabelo"], ["Salão Evoria", "cabelo"],
      ["VK Concept Petit Spa", "estetica"], ["Vanuza Cabeleireira", "cabelo"], ["Seu Pimenta Barbearia", "barbearia"],
      ["Barber Shop do Zé", "barbearia"], ["Studio de Unhas Bela", "unhas"],
    ];
    for (const [name, kind] of cases) expect(detectDemoKind(b(name)), name).toBe(kind);
  });

  it("usa a categoria da fonte quando o nome não diz nada", () => {
    expect(detectDemoKind(b("Studio Ana", "beleza", "Massagem"))).toBe("massagem");
    expect(detectDemoKind(b("Espaço Lótus", "beleza", "Estética"))).toBe("estetica");
    expect(detectDemoKind(b("Casa Amarela", "restaurantes", "Padaria"))).toBe("cafe");
    expect(detectDemoKind(b("Doutor Pneu", "servicos", "Oficina mecânica"))).toBe("oficina");
    // "Cabeleireiro / barbearia" do OSM não decide sozinho: vale salão.
    expect(detectDemoKind(b("Studio Ana", "beleza", "Cabeleireiro / barbearia"))).toBe("cabelo");
  });

  it("não cruza segmentos e cai no padrão do segmento", () => {
    expect(detectDemoKind(b("Bar do Salão", "beleza"))).toBe("cabelo");
    expect(detectDemoKind(b("Loja Central", "comercio"))).toBe("loja");
    expect(detectDemoKind(b("Empresa X", "outros"))).toBe("presenca");
  });
});

describe("demos v3: variação por estabelecimento", () => {
  it("é determinística e não repete a mesma combinação para todos", () => {
    expect(demoVariant(b("Salão Define"))).toEqual(demoVariant(b("Salão Define")));
    const names = ["IM MASSAGEM", "Salão Define", "Salão Evoria", "VK Concept Petit Spa", "Vanuza Cabeleireira", "Seu Pimenta Barbearia"];
    const looks = new Set(names.map((n) => { const v = demoVariant(b(n)); return `${v.kind}|${v.layout}|${v.palette.paper}|${v.headline}`; }));
    expect(looks.size).toBe(names.length);
    // Dois salões do mesmo tipo e cidade: ao menos uma dimensão visual diferente.
    const a = demoVariant(b("Salão Define")), c = demoVariant(b("Salão Evoria"));
    expect(a.layout !== c.layout || a.palette !== c.palette || a.headline !== c.headline).toBe(true);
  });

  it("tipos sem fotografia adequada usam layout tipográfico", () => {
    for (const [kind, spec] of Object.entries(demoKinds)) {
      if (spec.photo) continue;
      for (const n of ["A", "Bravo", "Casa Nova", "Delta 22"]) {
        const v = demoVariant({ ...b(`${n} ${spec.label}`, "outros"), name: `${n} ${spec.label}` });
        if (v.kind === kind) expect(v.layout).toBe("type");
      }
    }
  });

  it("todos os tipos têm 3 paletas com cores válidas e textos sem promessas numéricas", () => {
    for (const spec of Object.values(demoKinds)) {
      for (const p of spec.palettes) for (const c of [p.paper, p.ink, p.accent]) expect(c).toMatch(/^#[0-9a-f]{6}$/);
      expect(JSON.stringify(spec)).not.toMatch(/R\$|\d+%|\bmelhor (da|de) /i);
    }
  });

  it("monograma usa as iniciais do nome", () => {
    expect(monogram("Seu Pimenta Barbearia")).toBe("SP");
    expect(monogram("IM MASSAGEM")).toBe("IM");
    expect(monogram("Ótica")).toBe("ÓT");
  });
});

describe("demos v3: modelo", () => {
  const lead = { name: "Studio Ana", city: "Cuiabá", uf: "MT", segment: "beleza", phone: "" } as Lead;

  it("cria v3 com categoria; o link preserva a categoria", () => {
    const demo = createLeadDemo(lead, { category: "Massagem" });
    expect(demo.version).toBe(3);
    expect(demo.business.category).toBe("Massagem");
    // Após o merge com as demos v4/v5, a mensagem padrão é a de defaultDemoMessage; a categoria segue no negócio.
    expect(demo.message).toContain("Cuiabá");
    const doc = parseDemoDocument(new URL(demoPreviewUrl(demo, "https://sellora.example")).hash);
    expect(doc?.version).toBe(3);
    expect(doc?.business.category).toBe("Massagem");
  });

  it("demos antigas (v2, sem categoria) continuam válidas", () => {
    const old = { ...createLeadDemo(lead), version: 2 as const, business: { name: "Studio Ana", city: "Cuiabá", uf: "MT", segment: "beleza" as const, phone: "" } };
    expect(leadDemoSchema.safeParse(old).success).toBe(true);
  });
});
