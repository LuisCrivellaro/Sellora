import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createEmptyDatabase } from "./seed";
import { getDb, replaceDatabase } from "./store";
import { approveLeadDemo, createLead, generateLeadDemo, importProspects, rejectLeadDemo, restoreLeadDemo, revokeDemoApproval, saveDemoMessage, markDemoManuallySent, upgradeLeadDemoDesign } from "./repository";
import { demoMessageForCopy, demoPreviewUrl, parseDemoFragment } from "../demos/model";
import { demoReviewStage, whatsappDraftUrl } from "../demos/whatsapp";
import { leadFromRow, leadToRow } from "./mappers";
import { leadRowSchema } from "./row-schemas";
import type { ProspectResult } from "../prospecting/types";

beforeAll(() => {
  const mem = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) } });
});
beforeEach(() => replaceDatabase(createEmptyDatabase()));

const input = { name: "Café São João", city: "Campinas", uf: "SP", segment: "restaurantes" as const, source: "manual" as const, website: "", websiteSituation: "sem_site" as const, stage: "novo" as const, priority: "alta" as const, phone: "", email: "", instagram: "", potentialValue: 590, nextAction: "", nextActionAt: null, notes: "INFORMAÇÃO INTERNA" };
const prospect = (id: string, classification = "HOT"): ProspectResult => ({ id, ...input, category: "Café", address: "", distanceKm: null, otherSocials: [], openingHours: "", presence: "sem_site", classification, score: 80, scoreParts: [], confidence: "baixa", diagnosis: "Sem site na fonte", problems: [], justification: "Fonte OSM", evidence: [], sources: [], siteCheck: null, checkedAt: new Date().toISOString() }) as ProspectResult;

describe("demos e aprovação humana", () => {
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
    const other = createLead({ ...input, name: "Outro Café", phone: "(19) 98888-1234" });
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
