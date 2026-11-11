import { describe, expect, it } from "vitest";
import { normalizeWhatsappPhone, whatsappDraftUrl, manualDemoContactsOnDay } from "./whatsapp";
import { createLeadDemo } from "./model";
import { createSeed } from "../data/seed";

describe("WhatsApp manual", () => {
  it("a meta diária conta leads distintos no fuso de São Paulo, apenas envios declarados", () => {
    const activity = (leadId: string, completedAt: string, description = "Envio manual da mensagem com demo declarado pelo operador. Entrega não verificada pelo Sellora.") => ({ id: crypto.randomUUID(), leadId, clientId: null, projectId: null, type: "whatsapp" as const, description, dueAt: null, completedAt, createdAt: completedAt });
    const items = [activity("lead1", "2026-11-11T14:00:00Z"), activity("lead1", "2026-11-11T15:00:00Z"), activity("lead2", "2026-11-12T02:30:00Z"), activity("lead3", "2026-11-12T03:30:00Z"), activity("lead4", "2026-11-11T15:00:00Z", "Outra atividade")];
    expect(manualDemoContactsOnDay(items, "2026-11-11T20:00:00Z")).toBe(2);
  });
  it.each([["(19) 99999-1234", "5519999991234"], ["+55 (19) 3333-1234", "551933331234"], ["5519999991234", "5519999991234"], ["+351 912 345 678", "351912345678"], ["", null], ["123", null], ["19 99999-1234 ramal 2", null], ["javascript:alert(1)", null]])("normaliza %s sem escolher outro destinatário", (input, result) => {
    expect(normalizeWhatsappPhone(input)).toBe(result);
  });
  it("exige aprovação e preserva mensagem, acentos e link no texto pré-preenchido", () => {
    const demo = createLeadDemo(createSeed().leads[0]);
    expect(() => whatsappDraftUrl(demo, "(19) 99999-1234", "https://sellora.example")).toThrow(/aprova/i);
    const approved = { ...demo, status: "approved" as const, approvedAt: new Date().toISOString(), approvedBy: "Revisor" };
    const url = new URL(whatsappDraftUrl(approved, "(19) 99999-1234", "https://sellora.example"));
    expect(url.origin).toBe("https://wa.me");
    expect(url.pathname).toBe("/5519999991234");
    expect(url.searchParams.get("text")).toContain(demo.message);
    expect(url.searchParams.get("text")).toContain("https://sellora.example/demo#");
    expect(() => whatsappDraftUrl(approved, "", "https://sellora.example")).toThrow(/telefone/i);
  });
});
