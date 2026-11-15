import { beforeEach, expect, it, vi } from "vitest";
import { preparationLeadInput, preparationResult } from "./send-preparation-fixtures";
import type { PublicationView } from "../publishing/types";

let client: typeof import("./generation-client");
let repository: typeof import("../data/repository");
let store: typeof import("../data/store");
let mem: Map<string, string>;
let leadId: string;
let generated: ReturnType<typeof preparationResult>;
let configured: boolean;
let publication: PublicationView | null;
let generations: number;
let publishes: number;
let beforePublish: (() => Promise<void>) | undefined;
const queue = () => JSON.parse(mem.get("sellora-demo-generator-v1") || "[]") as { leadId: string; status: string; preparationStatus?: string }[];
const saved = () => store.getDb().leads.find((lead) => lead.id === leadId)!;
const completed = () => expect.poll(() => queue().find((item) => item.leadId === leadId)?.status).toBe("completed");

function published(): PublicationView {
  const at = new Date().toISOString();
  return { version: 1, id: crypto.randomUUID(), leadId, business: { name: preparationLeadInput.name, city: "Campinas", uf: "SP" }, slug: "cafe-sao-joao", status: "published", health: "ok", siteId: generated.site!.id, publishedSiteId: generated.site!.id, url: "https://cafe.example.com/", domain: "cafe.example.com", coolifyAppUuid: "app123", coolifyAppName: "demo-cafe", github: { repo: "test/demos", branch: "main", path: "sites/cafe", commitSha: null }, createdAt: at, updatedAt: at, lastDeployAt: at, lastCheckedAt: at, lastError: null, operations: [], active: false };
}

beforeEach(async () => {
  vi.resetModules();
  mem = new Map();
  configured = true; publication = null; generations = 0; publishes = 0; beforePublish = undefined;
  vi.stubGlobal("window", { localStorage: { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v), removeItem: (k: string) => mem.delete(k) } });
  store = await import("../data/store");
  repository = await import("../data/repository");
  const { createEmptyDatabase } = await import("../data/seed");
  store.replaceDatabase(createEmptyDatabase());
  leadId = repository.createLead(preparationLeadInput).id;
  generated = preparationResult();
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith("/generator")) return Response.json({ claude: { available: true } });
    if (url === "/api/publications") return Response.json({ status: { configured } });
    if (url.startsWith("/api/publications/")) {
      if (init?.method === "POST") { publishes++; await beforePublish?.(); publication = published(); }
      return Response.json({ publication });
    }
    if (url === "/api/demos/jobs" && init?.method === "POST") {
      generations++;
      return Response.json({ job: { id: JSON.parse(init.body as string).id, status: "completed", phase: "Pronto", result: generated } });
    }
    throw new Error(`Requisição inesperada: ${url}`);
  }));
  client = await import("./generation-client");
});

it("modo manual preserva aprovação humana e não consulta nem publica no Coolify", async () => {
  client.enqueueDemoGeneration([leadId]);
  await completed();
  expect(saved().demo?.status).toBe("pending");
  expect(publishes).toBe(0);
  expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes("publications"))).toBe(false);
});

it("modo opcional gera, revisa, publica esta versão e prepara mensagem sem registrar envio", async () => {
  client.enqueueDemoGeneration([leadId], { prepareForSend: true });
  client.enqueueDemoGeneration([leadId], { prepareForSend: true });
  await completed();
  expect(generations).toBe(1);
  expect(publishes).toBe(1);
  expect(saved().demo?.status).toBe("approved");
  expect(saved().demo?.approvedBy).toContain("automática");
  expect(saved().demo?.publication?.publishedSiteId).toBe(generated.site!.id);
  expect(queue()[0].preparationStatus).toBe("ready");
  expect(saved().lastContactAt).toBeNull();
  expect(saved().demo?.lastManualSend).toBeUndefined();
  expect(store.getDb().activities.every((a) => a.type === "nota")).toBe(true);
});

it("sem configuração, guarda a demo e retenta só a preparação sem consumir outra geração", async () => {
  configured = false;
  client.enqueueDemoGeneration([leadId], { prepareForSend: true });
  await completed();
  expect(saved().demo?.status).toBe("pending");
  expect(queue()[0].preparationStatus).toBe("awaiting_publication");
  expect(publishes).toBe(0);
  configured = true;
  client.retryDemoPreparation(leadId);
  await completed();
  expect(generations).toBe(1);
  expect(publishes).toBe(1);
  expect(saved().demo?.status).toBe("approved");
});

it("QA pendente bloqueia publicação e aprovação automática", async () => {
  generated.site!.qa.visual!.status = "visual_review_unavailable";
  client.enqueueDemoGeneration([leadId], { prepareForSend: true });
  await completed();
  expect(queue()[0].preparationStatus).toBe("needs_review");
  expect(saved().demo?.status).toBe("pending");
  expect(publishes).toBe(0);
});

it("edição manual durante publicação é preservada e impede liberação automática", async () => {
  beforePublish = async () => repository.saveDemoMessage(leadId, "Mensagem revisada por mim durante a publicação da demo.");
  client.enqueueDemoGeneration([leadId], { prepareForSend: true });
  await completed();
  expect(saved().demo?.status).toBe("pending");
  expect(saved().demo?.message).toContain("revisada por mim");
  expect(queue()[0].preparationStatus).not.toBe("ready");
  expect(saved().lastContactAt).toBeNull();
});

it("alterar o cadastro durante publicação interrompe a preparação da versão antiga", async () => {
  beforePublish = async () => { repository.updateLead(leadId, { ...preparationLeadInput, name: "Nome corrigido pelo operador" }); };
  client.enqueueDemoGeneration([leadId], { prepareForSend: true });
  await completed();
  expect(saved().name).toBe("Nome corrigido pelo operador");
  expect(saved().demo?.status).toBe("pending");
  expect(queue()[0].preparationStatus).not.toBe("ready");
});

it("cancelar a preparação preserva demo e outro lead sem marcar envio nem cancelar Coolify", async () => {
  const other = repository.createLead({ ...preparationLeadInput, name: "Outro negócio" }).id;
  client.enqueueDemoGeneration([other], { start: false });
  let release!: () => void;
  beforePublish = () => new Promise<void>((resolve) => { release = resolve; });
  client.enqueueDemoGeneration([leadId], { prepareForSend: true });
  await expect.poll(() => publishes).toBe(1);
  const cancellation = client.cancelDemoGeneration([leadId]);
  release();
  await cancellation;
  expect(queue().find((item) => item.leadId === leadId)?.status).toBe("cancelled");
  expect(queue().find((item) => item.leadId === other)?.status).toBe("paused");
  expect(saved().demo?.site?.id).toBe(generated.site!.id);
  expect(saved().demo?.status).toBe("pending");
  expect(saved().lastContactAt).toBeNull();
  expect(vi.mocked(fetch).mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);
});

it("resposta de publicação de outra versão nunca libera o link antigo", async () => {
  publication = { ...published(), siteId: crypto.randomUUID(), active: true };
  client.enqueueDemoGeneration([leadId], { prepareForSend: true });
  await completed();
  expect(saved().demo?.status).toBe("pending");
  expect(publishes).toBe(0);
  expect(queue()[0].preparationStatus).toBe("awaiting_publication");
});

it("retomar após pausa na publicação reutiliza demo e publicação concluída", async () => {
  let release!: () => void;
  beforePublish = () => new Promise<void>((resolve) => { release = resolve; });
  client.enqueueDemoGeneration([leadId], { prepareForSend: true });
  await expect.poll(() => publishes).toBe(1);
  const pausing = client.pauseDemoGeneration([leadId]);
  release();
  await pausing;
  expect(saved().demo?.status).toBe("pending");
  client.resumeDemoGeneration([leadId]);
  await completed();
  expect(generations).toBe(1);
  expect(publishes).toBe(1);
  expect(saved().demo?.status).toBe("approved");
});

it("falha HTTP da publicação preserva demo e mensagem, sem aprovação", async () => {
  const original = vi.mocked(fetch).getMockImplementation()!;
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => url.startsWith("/api/publications/") && init?.method === "POST" ? Response.json({ error: "Coolify indisponível" }, { status: 503 }) : original(url, init)));
  client.enqueueDemoGeneration([leadId], { prepareForSend: true });
  await completed();
  expect(saved().demo?.site?.id).toBe(generated.site!.id);
  expect(saved().demo?.message).toBe(generated.message);
  expect(saved().demo?.status).toBe("pending");
  expect(queue()[0].preparationStatus).toBe("awaiting_publication");
});
