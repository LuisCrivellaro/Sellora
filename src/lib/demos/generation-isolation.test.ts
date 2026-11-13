import { beforeEach, expect, it, vi } from "vitest";

let client: typeof import("./generation-client");
let leads: string[];
let memory: Map<string, string>;
let posts: { id: string; leadId: string }[];
const queue = () => JSON.parse(memory.get("sellora-demo-generator-v1") || "[]") as { leadId: string; status: string }[];

beforeEach(async () => {
  vi.resetModules();
  memory = new Map();
  posts = [];
  vi.stubGlobal("window", { localStorage: { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) } });
  const { replaceDatabase } = await import("../data/store");
  const { createEmptyDatabase } = await import("../data/seed");
  const { createLead } = await import("../data/repository");
  replaceDatabase(createEmptyDatabase());
  const fields = { city: "Campinas", uf: "SP", segment: "beleza" as const, source: "manual" as const, website: "", websiteSituation: "sem_site" as const, stage: "novo" as const, priority: "alta" as const, phone: "", email: "", instagram: "", potentialValue: 590, nextAction: "", nextActionAt: null, notes: "" };
  leads = ["Studio Aurora", "Studio Brisa", "Studio Jardim"].map((name) => createLead({ ...fields, name }).id);
  memory.set("sellora-demo-generator-v1", JSON.stringify(leads.map((leadId) => ({ leadId, id: crypto.randomUUID(), status: "paused", resumeStatus: "queued", phase: "Pausado", error: null, expectedRevision: null }))));
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/generator")) return Response.json({ available: true, connected: true, claude: { available: true } });
    if (options?.method === "POST") {
      const body = JSON.parse(options.body as string);
      posts.push(body);
      return Response.json({ job: { id: body.id, status: "failed", error: "Fim controlado do teste", result: null } });
    }
    return Response.json({ job: null });
  }));
  client = await import("./generation-client");
});

it("um clique individual inicia somente o lead escolhido, mantendo os demais pausados", async () => {
  client.enqueueDemoGeneration([leads[0]]);
  client.enqueueDemoGeneration([leads[0]]);
  await expect.poll(() => queue()[0]?.status).not.toBe("running");
  await expect.poll(() => posts.length).toBe(1);
  expect(posts.map((post) => post.leadId)).toEqual([leads[0]]);
  expect(queue().filter((item) => item.status === "paused").map((item) => item.leadId)).toEqual(leads.slice(1));
});

it("retomar pela ficha individual mantém outros estabelecimentos pausados", async () => {
  // initialize() é acionado pela entrada normal da fila.
  client.enqueueDemoGeneration([]);
  client.resumeDemoGeneration([leads[1]]);
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].leadId).toBe(leads[1]);
  expect(queue().filter((item) => item.status === "paused")).toHaveLength(2);
});

it("estabelecimentos diferentes usam seus próprios ids e lote exige a lista explícita", async () => {
  client.enqueueDemoGeneration([leads[0], leads[2]]);
  await expect.poll(() => posts.length).toBe(2);
  expect(posts.map((post) => post.leadId)).toEqual([leads[0], leads[2]]);
  expect(new Set(posts.map((post) => post.id)).size).toBe(2);
  expect(queue().find((item) => item.leadId === leads[1])?.status).toBe("paused");
});

it("cancelar uma geração individual preserva outras gerações pausadas", async () => {
  client.enqueueDemoGeneration([]);
  await client.cancelDemoGeneration([leads[0]]);
  expect(queue().find((item) => item.leadId === leads[0])?.status).toBe("cancelled");
  expect(queue().filter((item) => item.status === "paused")).toHaveLength(2);
  expect(posts).toHaveLength(0);
  client.resumeDemoGeneration();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts.map((post) => post.leadId)).toEqual(leads.slice(1));
});

it("pausar e retomar o mesmo job preserva os outros leads e não envia outro POST", async () => {
  let status = "running";
  let id = "";
  vi.stubGlobal("fetch", vi.fn(async (url: string, options?: RequestInit) => {
    if (url.endsWith("/generator")) return Response.json({ available: true, connected: true });
    if (options?.method === "POST") {
      const body = JSON.parse(options.body as string);
      posts.push(body);
      id = body.id;
    }
    if (options?.method === "DELETE") status = "paused";
    if (options?.method === "PATCH") status = "failed";
    return Response.json({ job: { id, status, phase: "Teste", error: status === "failed" ? "Fim controlado" : null, result: null } });
  }));
  client.enqueueDemoGeneration([leads[0]]);
  await expect.poll(() => posts.length).toBe(1);
  const startedId = posts[0].id;
  await client.pauseDemoGeneration([leads[0]]);
  expect(queue().every((item) => item.status === "paused")).toBe(true);
  client.resumeDemoGeneration([leads[0]]);
  await expect.poll(() => queue().find((item) => item.leadId === leads[0])?.status).toBe("failed");
  expect(posts).toHaveLength(1);
  expect(posts[0].id).toBe(startedId);
  expect(queue().filter((item) => item.status === "paused")).toHaveLength(2);
});
