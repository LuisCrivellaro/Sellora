import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyDatabase } from "./seed";
import { getDb, replaceDatabase } from "./store";
import { applyGeneratedLeadDemo, approveLeadDemo, createLead, generateLeadDemo, importProspects, rejectLeadDemo, restoreLeadDemo, revokeDemoApproval, saveDemoMessage, markDemoManuallySent, upgradeLeadDemoDesign, upgradeLeadDemoDesigns } from "./repository";
import { demoMessageForCopy, demoPreviewUrl, demoRevision, parseDemoDocument, parseDemoFragment } from "../demos/model";
import { demoReviewStage, whatsappDraftUrl } from "../demos/whatsapp";
import { leadFromRow, leadToRow } from "./mappers";
import { leadRowSchema } from "./row-schemas";
import type { ProspectResult } from "../prospecting/types";
import { demoCreativeContent, demoCreativeIssues } from "../demos/creative-review";
import { generatedFixture } from "../demos/generation-fixtures";

beforeAll(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) } });
});
beforeEach(() => replaceDatabase(createEmptyDatabase()));

const input = { name: "Café São João", city: "Campinas", uf: "SP", segment: "restaurantes" as const, source: "manual" as const, website: "", websiteSituation: "sem_site" as const, stage: "novo" as const, priority: "alta" as const, phone: "", email: "", instagram: "", potentialValue: 590, nextAction: "", nextActionAt: null, notes: "INFORMAÇÃO INTERNA" };
const prospect = (id: string, classification = "HOT"): ProspectResult => ({ id, ...input, category: "Café", address: "", distanceKm: null, otherSocials: [], openingHours: "", presence: "sem_site", classification, score: 80, scoreParts: [], confidence: "baixa", diagnosis: "Sem site na fonte", problems: [], justification: "Fonte OSM", evidence: [], sources: [], siteCheck: null, checkedAt: new Date().toISOString() }) as ProspectResult;

describe("demos e aprovação humana", () => {
  it("aplica a criação dinâmica e preserva edição, snapshot e histórico de envio", () => {
    const lead = createLead({ ...input, phone: "(19) 99999-1234" });
    generateLeadDemo(lead.id);
    saveDemoMessage(lead.id, "Mensagem editada pelo operador que precisa ser conservada.");
    approveLeadDemo(lead.id);
    markDemoManuallySent(lead.id, "http://localhost:3100");
    const before = getDb().leads[0].demo!;
    const result = { creation: generatedFixture, message: "Nova mensagem criada pelo gerador para este conceito." };
    applyGeneratedLeadDemo(lead.id, result, demoRevision(before));
    const after = getDb().leads[0].demo!;
    expect(after.version).toBe(5);
    expect(after.message).toBe(before.message);
    expect(after.generatedMessage).toBe(result.message);
    expect(after.lastManualSend).toEqual(before.lastManualSend);
    expect(after.business).toEqual(before.business);
    expect(after.status).toBe("pending");
    expect(leadFromRow(leadToRow(getDb().leads[0])).demo).toEqual(after);
    applyGeneratedLeadDemo(lead.id, result, demoRevision(before));
    expect(getDb().leads[0].demo).toEqual(after);
  });
  it("recusa sobrescrever uma mensagem editada enquanto o gerador estava trabalhando", () => {
    const lead = createLead(input);
    const before = generateLeadDemo(lead.id);
    saveDemoMessage(lead.id, "Edição feita enquanto a geração estava em andamento.");
    expect(() => applyGeneratedLeadDemo(lead.id, { creation: generatedFixture, message: "Mensagem gerada que chegou depois da edição do operador." }, demoRevision(before))).toThrow(/editada/);
    expect(getDb().leads[0].demo?.version).toBe(3);
  });
  it("impede aprovar uma foto reaproveitada em outro negócio do mesmo nicho", () => {
    const first = createLead({ ...input, name: "Café Aurora" });
    const second = createLead({ ...input, name: "Café Jardim" });
    generateLeadDemo(first.id);
    generateLeadDemo(second.id);
    saveDemoMessage(second.id, "Uma abordagem escrita especialmente para a proposta visual deste café.");
    expect(() => approveLeadDemo(second.id)).toThrow(/imagem|foto/i);
    expect(getDb().leads.find((lead) => lead.id === second.id)?.demo?.status).toBe("pending");
  });
  it("detecta a mesma mensagem com nomes e cidades diferentes, mesmo com fotos distintas", () => {
    const first = createLead(input);
    const second = createLead({ ...input, name: "Estúdio Jasmim", city: "Santos", segment: "beleza" });
    generateLeadDemo(first.id);
    generateLeadDemo(second.id);
    expect(() => approveLeadDemo(second.id)).toThrow(/mensagem|texto/i);
  });
  it("aplica os conceitos aprovados aos dois negócios, incluindo foto, textos e mensagem próprios", () => {
    const cravo = generateLeadDemo(createLead({ ...input, name: "Cravo e Canela", city: "São Paulo", segment: "beleza" }).id);
    const headmasters = generateLeadDemo(createLead({ ...input, name: "Headmasters Cabelo & Estética", city: "São paulo", segment: "beleza" }).id);
    expect(cravo.version).toBe(4);
    expect(headmasters.version).toBe(4);
    expect(cravo.conceptId).toBe("cravo-20261112");
    expect(headmasters.conceptId).toBe("headmasters-20261112");
    const cravoContent = demoCreativeContent(cravo);
    const headmastersContent = demoCreativeContent(headmasters);
    expect(cravoContent.photo).toBe("/demos/unique/cravo-portrait.png");
    expect(headmastersContent.photo).toBe("/demos/unique/headmasters-still-life.png");
    expect(cravoContent.photoOrigin).not.toBe(headmastersContent.photoOrigin);
    expect(cravoContent.texts).toContain("Deixe aparecer quem você é.");
    expect(headmastersContent.texts).toContain("SEU VISUAL. SUA ASSINATURA.");
    expect(demoCreativeIssues(cravo, [headmasters])).toEqual([]);
    expect(demoCreativeIssues(headmasters, [cravo])).toEqual([]);
    expect(cravo.message).toContain("retrato ilustrativo exclusivo");
    expect(headmasters.message).toContain("abertura tipográfica");
    for (const demo of [cravo, headmasters]) {
      const decoded = parseDemoDocument(new URL(demoPreviewUrl(demo, "https://sellora.example")).hash);
      expect(decoded?.conceptId).toBe(demo.conceptId);
      expect(JSON.stringify(decoded)).not.toContain(demo.message);
      const lead = getDb().leads.find((lead) => lead.demo?.id === demo.id)!;
      expect(leadFromRow(leadToRow(lead)).demo).toEqual(demo);
      expect(leadRowSchema.parse(lead).demo).toEqual(demo);
    }
  });
  it("aplica o conceito aprovado a uma demo v3 e mantém a mensagem editada e o envio anterior", () => {
    const lead = createLead({ ...input, name: "Cravo e Canela", city: "São Paulo", segment: "beleza", phone: "(11) 99999-1234" });
    generateLeadDemo(lead.id);
    const current = getDb();
    const legacy = generateLeadDemo(createLead(input).id);
    replaceDatabase({ ...current, leads: current.leads.map((item) => ({ ...item, demo: { ...item.demo!, version: 3, conceptId: undefined, design: legacy.design } })) });
    saveDemoMessage(lead.id, "Uma mensagem autoral que foi revisada pelo operador.");
    approveLeadDemo(lead.id);
    markDemoManuallySent(lead.id, "https://sellora.example");
    const before = getDb().leads[0].demo!;
    upgradeLeadDemoDesign(lead.id);
    const updated = getDb().leads[0].demo!;
    expect(updated.version).toBe(4);
    expect(updated.conceptId).toBe("cravo-20261112");
    expect(updated.message).toBe(before.message);
    expect(updated.lastManualSend).toEqual(before.lastManualSend);
    expect(updated.status).toBe("pending");
  });
  it("a geração em lote usa os conceitos próprios e reaproveita a mesma versão na reimportação", () => {
    const results = [
      { ...prospect("cravo"), name: "Cravo e Canela", city: "São Paulo", segment: "beleza" as const },
      { ...prospect("headmasters"), name: "Headmasters Cabelo & Estética", city: "São Paulo", segment: "beleza" as const },
    ];
    const report = importProspects(results, { generateDemos: true });
    expect(report.demos).toHaveLength(2);
    const demos = getDb().leads.map((lead) => lead.demo!);
    expect(demos.every((demo) => demo.version === 4)).toBe(true);
    expect(new Set(demos.map((demo) => demoCreativeContent(demo).photoOrigin)).size).toBe(2);
    getDb().leads.forEach((lead) => approveLeadDemo(lead.id));
    const approved = getDb().leads.map((lead) => lead.demo);
    const again = importProspects(results, { generateDemos: true });
    expect(again.demos.every((demo) => demo.reused)).toBe(true);
    expect(getDb().leads.map((lead) => lead.demo)).toEqual(approved);
  });
  it("recusa usar a imagem de um conceito aprovado em outro negócio ou carregar mídia arbitrária", () => {
    const demo = generateLeadDemo(createLead({ ...input, name: "Cravo e Canela", city: "São Paulo", segment: "beleza" }).id);
    const encode = (payload: object) => "#" + Buffer.from(JSON.stringify(payload)).toString("base64url");
    expect(parseDemoDocument(encode({ version: 4, conceptId: demo.conceptId, business: { ...demo.business, name: "Outro Negócio" } }))).toBeNull();
    expect(parseDemoDocument(encode({ version: 4, conceptId: "https://external.example/image.png", business: demo.business }))).toBeNull();
    expect(leadRowSchema.safeParse({ ...getDb().leads[0], demo: { ...demo, conceptId: undefined } }).success).toBe(false);
    const decoded = parseDemoDocument(encode({ version: 4, conceptId: demo.conceptId, business: demo.business, notes: "privado", media: "https://external.example/image.png" }));
    expect(decoded).not.toHaveProperty("notes");
    expect(decoded).not.toHaveProperty("media");
  });
  it("individualiza leads do mesmo segmento e preserva a composição no link e no armazenamento", () => {
    const names = ["Café São João", "Café Aurora", "Café Jardim", "Café Central", "Café da Praça", "Café Horizonte"];
    const demos = names.map((name) => generateLeadDemo(createLead({ ...input, name }).id));
    expect(demos.every((demo) => demo.version === 3 && demo.design)).toBe(true);
    expect(new Set(demos.map((demo) => JSON.stringify(demo.design))).size).toBe(names.length);
    expect(new Set(demos.map((demo) => demo.design?.layout)).size).toBeGreaterThan(1);
    expect(new Set(demos.map((demo) => demo.design?.paper)).size).toBeGreaterThan(1);
    for (const demo of demos) {
      const decoded = parseDemoDocument(new URL(demoPreviewUrl(demo, "https://sellora.example")).hash);
      expect(decoded?.design).toEqual(demo.design);
      const saved = getDb().leads.find((lead) => lead.demo?.id === demo.id)!;
      expect(generateLeadDemo(saved.id)).toEqual(demo);
      expect(leadFromRow(leadToRow(saved)).demo?.design).toEqual(demo.design);
      expect(leadRowSchema.parse(saved).demo?.design).toEqual(demo.design);
    }
  });
  it("atualiza também demos v2 mantendo snapshot, mensagem e envio anterior", () => {
    const lead = createLead({ ...input, phone: "(19) 99999-1234" });
    generateLeadDemo(lead.id);
    const current = getDb();
    replaceDatabase({ ...current, leads: current.leads.map((item) => ({ ...item, demo: { ...item.demo!, version: 2, design: undefined } })) });
    approveLeadDemo(lead.id);
    markDemoManuallySent(lead.id, "https://sellora.example");
    const previous = getDb().leads[0].demo!;
    upgradeLeadDemoDesign(lead.id);
    const updated = getDb().leads[0].demo!;
    expect(updated.version).toBe(3);
    expect(updated.design).toBeTruthy();
    expect(updated.business).toEqual(previous.business);
    expect(updated.message).toBe(previous.message);
    expect(updated.lastManualSend).toEqual(previous.lastManualSend);
    expect(updated.status).toBe("pending");
    upgradeLeadDemoDesign(lead.id);
    expect(getDb().leads[0].demo).toEqual(updated);
  });
  it("personaliza o lote antigo em uma gravação, preservando as demos atuais e os contatos", () => {
    const leads = ["Café Aurora", "Café Jardim", "Café Central"].map((name) => createLead({ ...input, name }));
    leads.forEach((lead) => generateLeadDemo(lead.id));
    const original = getDb();
    replaceDatabase({ ...original, leads: original.leads.map((lead) => lead.id === leads[2].id ? lead : { ...lead, demo: { ...lead.demo!, version: 2, design: undefined } }) });
    const activities = getDb().activities;
    expect(upgradeLeadDemoDesigns(leads.map((lead) => lead.id))).toBe(2);
    expect(getDb().leads.every((lead) => lead.demo?.version === 3)).toBe(true);
    expect(getDb().leads.find((lead) => lead.id === leads[2].id)).toEqual(original.leads.find((lead) => lead.id === leads[2].id));
    expect(getDb().activities).toEqual(activities);
    expect(upgradeLeadDemoDesigns(leads.map((lead) => lead.id))).toBe(0);
  });
  it("mantém links antigos e rejeita composições incompletas ou cores que injetem CSS", () => {
    const demo = generateLeadDemo(createLead(input).id);
    for (const version of [1, 2] as const) {
      const legacy = { ...demo, version, design: undefined };
      const document = parseDemoDocument(new URL(demoPreviewUrl(legacy, "https://sellora.example")).hash);
      expect(document?.version).toBe(version);
      expect(document?.design).toBeUndefined();
    }
    const fragment = (design: unknown) => "#" + btoa(JSON.stringify({ version: 3, business: { ...demo.business, name: "Cafe Teste" }, design }));
    // v3 sem `design` = direção por tipo de negócio (kinds.ts), criada pelo ramo paralelo; continua abrindo.
    const byKind = parseDemoDocument(new URL(demoPreviewUrl({ ...demo, version: 3, design: undefined, conceptId: undefined, creation: undefined }, "https://sellora.example")).hash);
    expect(byKind?.version).toBe(3);
    expect(byKind?.design).toBeUndefined();
    expect(parseDemoDocument(fragment({ ...demo.design, paper: "red;background:url(https://external.example)" }))).toBeNull();
  });
  it("só registra envio após aprovação e confirmação explícita; repetir não duplica contato", () => {
    const lead = createLead({ ...input, phone: "(19) 99999-1234" });
    generateLeadDemo(lead.id);
    expect(() => markDemoManuallySent(lead.id, "https://sellora.example")).toThrow(/aprova/i);
    approveLeadDemo(lead.id);
    expect(getDb().leads[0].lastContactAt).toBeNull();
    markDemoManuallySent(lead.id, "https://sellora.example");
    markDemoManuallySent(lead.id, "https://sellora.example");
    expect(getDb().activities.filter((a) => a.type === "whatsapp")).toHaveLength(1);
    expect(getDb().leads[0].stage).toBe("contatado");
    expect(getDb().leads[0].lastContactAt).toBeTruthy();
    expect(getDb().leads[0].demo?.lastManualSend?.text).toContain("/demo#");
    expect(leadFromRow(leadToRow(getDb().leads[0])).demo).toEqual(getDb().leads[0].demo);
    expect(leadRowSchema.parse(getDb().leads[0]).demo?.lastManualSend).toEqual(getDb().leads[0].demo?.lastManualSend);
    saveDemoMessage(lead.id, "Uma nova versão da abordagem para aprovação.");
    expect(getDb().leads[0].demo?.lastManualSend).toBeTruthy();
    expect(() => markDemoManuallySent(lead.id, "https://sellora.example")).toThrow(/aprova/i);
  });
  it("atualizar o visual de uma demo antiga exige nova aprovação e mantém o histórico", () => {
    const lead = createLead(input);
    generateLeadDemo(lead.id);
    const current = getDb();
    replaceDatabase({ ...current, leads: current.leads.map((l) => ({ ...l, demo: { ...l.demo!, version: 1 } })) });
    approveLeadDemo(lead.id);
    upgradeLeadDemoDesign(lead.id);
    expect(getDb().leads[0].demo?.version).toBe(3);
    expect(getDb().leads[0].demo?.status).toBe("pending");
    expect(getDb().leads[0].demo?.id).toBe(current.leads[0].demo?.id);
  });
  it("gera uma única demo por lead e não registra contato nem muda a etapa", () => {
    const lead = createLead(input);
    const first = generateLeadDemo(lead.id);
    expect(generateLeadDemo(lead.id)).toEqual(first);
    expect(first.status).toBe("pending");
    expect(() => demoMessageForCopy(first, "http://localhost:3100")).toThrow(/aprova/i);
    expect(getDb().leads[0].lastContactAt).toBeNull();
    expect(getDb().leads[0].stage).toBe("novo");
  });
  it("aprova a versão salva e revoga aprovação quando o texto muda", () => {
    const lead = createLead(input);
    generateLeadDemo(lead.id);
    approveLeadDemo(lead.id);
    const approved = getDb().leads[0].demo!;
    expect(approved.approvedAt).toBeTruthy();
    expect(approved.approvedBy).toBeTruthy();
    expect(demoMessageForCopy(approved, "http://localhost:3100")).toContain("/demo#");
    saveDemoMessage(lead.id, "Olá! Preparei esta demonstração para vocês.");
    expect(getDb().leads[0].demo?.status).toBe("pending");
    expect(getDb().leads[0].demo?.approvedAt).toBeNull();
    expect(() => saveDemoMessage(lead.id, " ")).toThrow();
  });
  it("prepara apenas HOT/WARM, ignora descartados e reaproveita duplicados sem sobrescrever o CRM", () => {
    const lead = createLead(input);
    const report = importProspects([prospect("1"), { ...prospect("2", "WARM"), name: "Studio Teste", segment: "beleza" }, { ...prospect("3", "LOW"), name: "Loja LOW" }, { ...prospect("4", "SKIP"), name: "Loja SKIP" }, { ...prospect("5"), name: "Descartado", discarded: true }], { generateDemos: true });
    expect(report.demos).toHaveLength(2);
    expect(getDb().leads).toHaveLength(2);
    expect(getDb().leads.find((l) => l.id === lead.id)?.notes).toBe(input.notes);
    saveDemoMessage(lead.id, "Mensagem exclusiva para Café São João, com proposta de uma página gastronômica.");
    approveLeadDemo(lead.id);
    const again = importProspects([prospect("1")], { generateDemos: true });
    expect(again.demos[0].reused).toBe(true);
    expect(getDb().leads.find((l) => l.id === lead.id)?.demo?.status).toBe("approved");
  });
  it("link independente contém só os dados públicos permitidos, preserva acentos e rejeita payload inválido", () => {
    const demo = generateLeadDemo(createLead(input).id);
    const url = demoPreviewUrl(demo, "https://sellora.example");
    const business = parseDemoFragment(new URL(url).hash);
    expect(business?.name).toBe(input.name);
    expect(JSON.stringify(business)).not.toContain(input.notes);
    expect(parseDemoFragment("#%broken")).toBeNull();
    expect(parseDemoFragment("#" + "x".repeat(10001))).toBeNull();
    expect(() => demoPreviewUrl(demo, "javascript:alert(1)")).toThrow();
  });
  it("recusar afeta só a demo escolhida, bloqueia aprovação/envio e preserva lead e histórico", () => {
    const lead = createLead({ ...input, phone: "(19) 99999-1234" });
    // Mesmo negócio em outro cadastro: a revisão criativa não acusa repetição entre eles.
    const other = createLead({ ...input, phone: "(19) 98888-1234" });
    generateLeadDemo(lead.id);
    generateLeadDemo(other.id);
    approveLeadDemo(lead.id);
    approveLeadDemo(other.id);
    const otherBefore = getDb().leads.find((l) => l.id === other.id)!.demo;
    const activitiesBefore = getDb().activities.length;

    rejectLeadDemo(lead.id);
    rejectLeadDemo(lead.id); // repetir não duplica registro
    const rejected = getDb().leads.find((l) => l.id === lead.id)!;
    expect(rejected.demo?.status).toBe("rejected");
    expect(rejected.demo?.approvedAt).toBeNull();
    expect(rejected.demo?.rejectedAt).toBeTruthy();
    expect(rejected.demo?.rejectedBy).toBeTruthy();
    expect(rejected.demo?.message).toBe(getDb().leads.find((l) => l.id === lead.id)!.demo?.message);
    expect(rejected.stage).toBe("novo");
    expect(rejected.notes).toBe(input.notes);
    expect(getDb().leads).toHaveLength(2);
    expect(getDb().activities).toHaveLength(activitiesBefore + 1);
    expect(getDb().activities[0].description).toMatch(/Demo recusada/);
    expect(getDb().leads.find((l) => l.id === other.id)!.demo).toEqual(otherBefore);
    expect(demoReviewStage(rejected.demo!, rejected.phone)).toBe("rejected");

    expect(() => approveLeadDemo(lead.id)).toThrow(/recusada/i);
    expect(() => saveDemoMessage(lead.id, "Outra mensagem qualquer para teste.")).toThrow(/recusada/i);
    expect(() => upgradeLeadDemoDesign(lead.id)).toThrow(/recusada/i);
    expect(() => revokeDemoApproval(lead.id)).toThrow(/recusada/i);
    expect(() => demoMessageForCopy(rejected.demo!, "https://sellora.example")).toThrow(/recusada/i);
    expect(() => whatsappDraftUrl(rejected.demo!, rejected.phone, "https://sellora.example")).toThrow(/recusada/i);
    expect(() => markDemoManuallySent(lead.id, "https://sellora.example")).toThrow(/recusada/i);
    expect(getDb().activities.filter((a) => a.type === "whatsapp")).toHaveLength(0);

    // Persistência: mapeamento do Supabase e validação do servidor mantêm a recusa.
    expect(leadFromRow(leadToRow(rejected)).demo).toEqual(rejected.demo);
    expect(leadRowSchema.parse(rejected).demo?.status).toBe("rejected");
    expect(leadRowSchema.safeParse({ ...rejected, demo: { ...rejected.demo, rejectedAt: null } }).success).toBe(false);

    restoreLeadDemo(lead.id);
    const restored = getDb().leads.find((l) => l.id === lead.id)!.demo!;
    expect(restored.status).toBe("pending");
    expect(restored.rejectedAt).toBeNull();
    expect(restored.approvedAt).toBeNull();
    expect(getDb().activities[0].description).toMatch(/restaurada/);
    approveLeadDemo(lead.id);
    expect(getDb().leads.find((l) => l.id === lead.id)!.demo?.status).toBe("approved");
  });

  it("reimportar um lead com demo recusada não desfaz a recusa", () => {
    const lead = createLead(input);
    generateLeadDemo(lead.id);
    rejectLeadDemo(lead.id);
    const report = importProspects([prospect("1")], { generateDemos: true });
    expect(report.demos[0].reused).toBe(true);
    expect(getDb().leads.find((l) => l.id === lead.id)?.demo?.status).toBe("rejected");
  });

  it("preserva demo e aprovação no mapeamento e na validação do servidor", () => {
    const lead = createLead(input);
    generateLeadDemo(lead.id);
    approveLeadDemo(lead.id);
    const saved = getDb().leads[0];
    expect(leadFromRow(leadToRow(saved)).demo).toEqual(saved.demo);
    expect(leadRowSchema.parse(saved).demo).toEqual(saved.demo);
    expect(leadRowSchema.safeParse({ ...saved, demo: { ...saved.demo, approvedAt: null } }).success).toBe(false);
    expect(leadFromRow(leadToRow(lead)).demo).toBeNull();
  });
});
