import { beforeAll, expect, it, vi } from "vitest";
import { createLead } from "../data/repository";
import { getDb, replaceDatabase } from "../data/store";
import { createEmptyDatabase } from "../data/seed";
import { enqueueDemoGeneration } from "./generation-client";
import { generatedFixture } from "./generation-fixtures";

beforeAll(() => {
  const memory = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) } });
});

it("executa o lote em sequência, inclui a criação anterior no histórico e não duplica o mesmo lead", async () => {
  replaceDatabase(createEmptyDatabase());
  const input = { city: "Campinas", uf: "SP", segment: "beleza" as const, source: "manual" as const, website: "", websiteSituation: "sem_site" as const, stage: "novo" as const, priority: "alta" as const, phone: "", email: "", instagram: "", potentialValue: 590, nextAction: "", nextActionAt: null, notes: "NOTA PRIVADA" };
  const leads = ["Studio Aurora", "Studio Brisa"].map((name) => createLead({ ...input, name }));
  const requests: Array<{ business: object; history: unknown[] }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/generator")) return Response.json({ available: true, connected: true, imageGeneration: true, message: "Conectado" });
    const body = JSON.parse(options!.body as string);
    requests.push(body);
    const index = requests.length;
    const hash = String(index).repeat(64);
    const creation = { ...generatedFixture, id: crypto.randomUUID(), layout: index === 1 ? "offset" : "poster", headline: `Direção autoral ${index} para um novo olhar`, intro: `Introdução própria do conceito ${index} com uma proposta específica.`, cta: `Conheça a proposta ${index}`, sections: generatedFixture.sections.map((section) => ({ title: `${section.title} ${index}`, body: `${section.body} ${index}` })), image: { ...generatedFixture.image, src: `/api/demos/media/${hash}`, sourceHash: hash } };
    return Response.json({ job: { id: body.id, status: "completed", phase: "Pronto", error: null, result: { creation, message: `Abordagem própria do conceito ${index} para avaliação do negócio.` } } }, { status: 202 });
  }));
  enqueueDemoGeneration(leads.map((lead) => lead.id));
  enqueueDemoGeneration(leads.map((lead) => lead.id));
  await expect.poll(() => getDb().leads.filter((lead) => lead.demo?.version === 5).length).toBe(2);
  expect(requests).toHaveLength(2);
  expect(requests[0].history).toHaveLength(0);
  expect(requests[1].history).toHaveLength(1);
  expect(JSON.stringify(requests)).not.toContain("NOTA PRIVADA");
  expect(requests[0].business).not.toHaveProperty("phone");
  expect(getDb().leads.every((lead) => lead.demo?.status === "pending" && lead.lastContactAt === null)).toBe(true);
});
