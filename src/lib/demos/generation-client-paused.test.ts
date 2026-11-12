import { expect, it, vi } from "vitest";
import { createLead } from "../data/repository";
import { replaceDatabase } from "../data/store";
import { createEmptyDatabase } from "../data/seed";
import { enqueueDemoGeneration } from "./generation-client";

it("pausa a fila persistida ao abrir e só retoma o lead solicitado pelo administrador", async () => {
  const memory = new Map<string, string>();
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value) } });
  replaceDatabase(createEmptyDatabase());
  const lead = createLead({ name: "Studio em revisão", city: "Campinas", uf: "SP", segment: "beleza", source: "manual", website: "", websiteSituation: "sem_site", stage: "novo", priority: "alta", phone: "", email: "", instagram: "", potentialValue: 590, nextAction: "", nextActionAt: null, notes: "" });
  const id = crypto.randomUUID();
  memory.set("sellora-demo-generator-v1", JSON.stringify([{ leadId: lead.id, id, status: "queued", phase: "Fila antiga", error: null, expectedRevision: null }]));
  const posts = vi.fn();
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.endsWith("/generator")) return Response.json({ available: true, connected: true, imageGeneration: true, message: "Conectado" });
    posts();
    return Response.json({ job: { id, status: "failed", phase: "Teste", result: null, error: "Falha controlada de teste" } }, { status: 202 });
  }));
  enqueueDemoGeneration([]);
  await Promise.resolve();
  expect(posts).not.toHaveBeenCalled();
  expect(JSON.parse(memory.get("sellora-demo-generator-v1")!)[0].status).toBe("paused");
  enqueueDemoGeneration([lead.id]);
  await expect.poll(() => posts.mock.calls.length).toBe(1);
});
