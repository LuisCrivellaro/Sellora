import { describe, expect, it } from "vitest";
import type { Activity, Lead } from "../types";
import { buildOutreachMessage, DEMO_TRANSPARENCY, messageSimilarity, outreachActivityDescription, outreachActivityKind, outreachFacts, outreachIssues, recentFirstContacts, type OutreachKind } from "./messages";
import { manualDemoContactsOnDay } from "../demos/whatsapp";

type L = Parameters<typeof outreachFacts>[0];
const lead = (over: Partial<L> = {}): L => ({
  id: "lead-1", name: "Cantina Bella Nonna", city: "Campinas", segment: "restaurantes",
  website: null, websiteSituation: "sem_site", source: "manual", demo: null, ...over,
});
const LINK = /(https?:\/\/|www\.|wa\.me|\.com\b)/i;

describe("primeiro contato", () => {
  it("é personalizado com nome e cidade, curto, sem link e termina com pergunta", () => {
    for (const segment of ["restaurantes", "saude", "beleza", "servicos", "comercio", "outros"] as const) {
      const text = buildOutreachMessage(outreachFacts(lead({ segment })), "first_contact");
      expect(text).toContain("Cantina Bella Nonna");
      expect(text).toContain("Campinas");
      expect(text).not.toMatch(LINK);
      expect(text.length).toBeLessThanOrEqual(600);
      expect(text.trim().endsWith("?")).toBe(true);
      expect(outreachIssues(text, "first_contact")).toEqual([]);
    }
  });

  it("nunca leva link, mesmo com demo aprovada e URL informada", () => {
    const facts = outreachFacts(lead({ demo: { status: "approved", business: { category: "Pizzaria" } } as unknown as Lead["demo"] }));
    for (let variant = 0; variant < 12; variant++) {
      const text = buildOutreachMessage(facts, "first_contact", { variant, demoUrl: "https://demo.exemplo.com.br" });
      expect(text).not.toMatch(LINK);
      expect(text.toLowerCase()).toContain("pizzaria");
    }
  });

  it("usa o nome do perfil só quando é um nome real", () => {
    expect(outreachFacts(lead(), "Fundador Sellora").sender).toBeNull();
    expect(outreachFacts(lead(), "Luiz Crivellaro").sender).toBe("Luiz");
  });
});

describe("precisão das afirmações", () => {
  const variants = (l: L, kind: OutreachKind = "first_contact") => Array.from({ length: 16 }, (_, variant) => buildOutreachMessage(outreachFacts(l), kind, { variant }));

  it("sem site confirmado não afirma ausência de site: pergunta ou fala só da ideia", () => {
    for (const text of variants(lead({ website: null, websiteSituation: "sem_site", source: "prospeccao_ia" }))) {
      expect(text).not.toMatch(/n[aã]o (tem|t[eê]m|possui)m? (um )?site|sem site/i);
      expect(text).not.toMatch(/site de voc[eê]s/i);
    }
  });

  it("problema de celular só aparece quando a Prospecção IA verificou o site", () => {
    const verified = variants(lead({ website: "https://cantina.com.br", websiteSituation: "sem_mobile", source: "prospeccao_ia" }));
    expect(verified.some((t) => /celular/i.test(t))).toBe(true);
    const manual = variants(lead({ website: "https://cantina.com.br", websiteSituation: "sem_mobile", source: "manual" }));
    expect(manual.every((t) => !/celular|desatualizad|moderniz/i.test(t))).toBe(true);
    expect(outreachFacts(lead({ website: "https://cantina.com.br", websiteSituation: "sem_mobile", source: "manual" })).opportunity).toBe("complement");
  });

  it("não promete resultados nem cita números em nenhuma situação", () => {
    for (const kind of ["first_contact", "interested", "undecided", "declined"] as const)
      for (const text of variants(lead({ website: "https://cantina.com.br", websiteSituation: "desatualizado", source: "prospeccao_ia" }), kind)) {
        expect(text).not.toMatch(/garant|mais clientes|aument|\d+ ?%/i);
      }
  });

  it("sem demo não diz que já preparou uma", () => {
    for (const text of variants(lead())) expect(text).not.toMatch(/esbocei|montei|fiz um esboço|preparei/i);
  });

  it("o validador acusa link, afirmação de ausência de site e promessa em textos editados", () => {
    expect(outreachIssues("Oi! Vi que vocês não têm site. Olha: https://x.com.br", "first_contact").length).toBeGreaterThanOrEqual(3);
    expect(outreachIssues("Oi! Garanto mais clientes para vocês em 30 dias?", "first_contact")).toContainEqual(expect.stringMatching(/prometer/));
  });
});

describe("respostas contextualizadas", () => {
  const facts = outreachFacts(lead({ demo: { status: "approved", business: {} } as unknown as Lead["demo"] }));

  it("interessado recebe o link com aviso de conceito não oficial e imagens ilustrativas", () => {
    const text = buildOutreachMessage(facts, "interested", { demoUrl: "https://cantina-demo.exemplo.app" });
    expect(text).toContain("https://cantina-demo.exemplo.app");
    expect(text).toContain(DEMO_TRANSPARENCY);
    expect(text).toMatch(/ilustrativas/);
  });

  it("interessado sem demo aprovada não recebe link", () => {
    expect(buildOutreachMessage(facts, "interested", { demoUrl: null })).not.toMatch(LINK);
  });

  it("indeciso e recusa não levam link; recusa não insiste com pergunta", () => {
    const undecided = buildOutreachMessage(facts, "undecided");
    const declined = buildOutreachMessage(facts, "declined");
    expect(undecided).not.toMatch(LINK);
    expect(undecided).toMatch(/sem compromisso|não compromete|sem pressa|com calma/i);
    expect(declined).not.toMatch(LINK);
    expect(declined).not.toContain("?");
  });
});

describe("diversidade", () => {
  const names = ["Cantina Bella Nonna", "Restaurante Sabor Mineiro", "Bistrô da Praça", "Churrascaria Gaúcha", "Pizzaria Forno a Lenha", "Lanchonete do Zé", "Sushi Hikari", "Cozinha da Vó Ana"];

  it("leads do mesmo segmento recebem mensagens diferentes em estrutura e frases", () => {
    const sent: { text: string; name: string; city: string }[] = [];
    for (const [index, name] of names.entries()) {
      const text = buildOutreachMessage(outreachFacts(lead({ id: `lead-${index}`, name })), "first_contact", { recent: [...sent].reverse() });
      sent.push({ text, name, city: "Campinas" });
    }
    const all = sent.map((s) => s.text);
    expect(new Set(all).size).toBe(all.length);
    // Nenhum par muito parecido (trigramas, ignorando nome e cidade).
    const pairs = sent.flatMap((a, i) => sent.slice(i + 1).map((b) => messageSimilarity(a.text, b.text, [a, b])));
    expect(Math.max(...pairs)).toBeLessThan(0.6);
    // Aberturas variadas: pelo menos metade das primeiras frases distintas.
    const openings = new Set(sent.map((s) => s.text.split(/[!?.]/)[0].replace(s.name, "")));
    expect(openings.size).toBeGreaterThanOrEqual(Math.ceil(names.length / 2));
  });

  it("o histórico afasta o rascunho de um texto já enviado", () => {
    const facts = outreachFacts(lead({ id: "lead-x", name: "Cantina Nova" }));
    const first = buildOutreachMessage(facts, "first_contact");
    const other = buildOutreachMessage(facts, "first_contact", { recent: [{ text: first.replace("Cantina Nova", "Outra Cantina"), name: "Outra Cantina", city: "Campinas" }] });
    expect(messageSimilarity(first, other, [{ name: "Cantina Nova", city: "Campinas" }])).toBeLessThan(0.9);
    expect(other).not.toBe(first);
  });

  it("“Outra versão” troca o texto", () => {
    const facts = outreachFacts(lead());
    expect(buildOutreachMessage(facts, "first_contact", { variant: 1 })).not.toBe(buildOutreachMessage(facts, "first_contact", { variant: 0 }));
  });
});

describe("registro no CRM", () => {
  const activity = (leadId: string, description: string, at: string): Activity => ({ id: `a-${leadId}-${at}`, leadId, clientId: null, projectId: null, type: "whatsapp", description, dueAt: null, completedAt: at, createdAt: at });

  it("a atividade cabe no limite de 500 caracteres e é reconhecida pelo tipo", () => {
    const description = outreachActivityDescription("first_contact", "Olá! ".repeat(200));
    expect(description.length).toBeLessThanOrEqual(500);
    expect(outreachActivityKind({ description })).toBe("first_contact");
    expect(outreachActivityKind({ description: "Ligação" })).toBeNull();
  });

  it("primeiros contatos de outros leads alimentam o histórico e a meta diária", () => {
    const now = "2026-11-16T15:00:00.000Z";
    const activities = [
      activity("lead-a", outreachActivityDescription("first_contact", "Olá, Bistrô! Tudo bem?"), now),
      activity("lead-b", outreachActivityDescription("interested", "Que bom!"), now),
      activity("lead-c", outreachActivityDescription("first_contact", "Oi, Sushi! Tudo bem?"), now),
    ];
    const leads = [{ id: "lead-a", name: "Bistrô", city: "Campinas" }, { id: "lead-b", name: "B", city: "Campinas" }, { id: "lead-c", name: "Sushi", city: "Campinas" }];
    expect(recentFirstContacts(activities, leads, "lead-c").map((r) => r.text)).toEqual(["Olá, Bistrô! Tudo bem?"]);
    expect(manualDemoContactsOnDay(activities, now)).toBe(2);
  });
});
