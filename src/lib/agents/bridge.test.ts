import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { agentRegistry, claw3dState, lifecycleEvents, readJobs, SUCCESS_VISIBLE_MS, visualState } from "./bridge";

const job = (overrides: Record<string, unknown>) => ({ id: randomUUID(), businessKey: JSON.stringify({ name: "Barbearia Teste Sellora", city: "Campinas", uf: "SP", segment: "beleza" }), status: "running", phase: "Etapa 4: escrevendo o código", error: null, textProvider: "claude", generator: "v6", leadId: "lead-1", startedAt: "2026-11-12T20:00:00.000Z", events: [{ at: "2026-11-12T20:00:00.000Z", phase: "Preparando a geração" }, { at: "2026-11-12T20:01:00.000Z", phase: "Etapa 4: escrevendo o código" }], result: null, ...overrides });

beforeEach(() => { process.env.SELLORA_DATA_DIR = path.join(process.cwd(), "test-results", "bridge", randomUUID()); });
afterEach(() => { delete process.env.SELLORA_DATA_DIR; delete (globalThis as { selloraDemoJobs?: unknown }).selloraDemoJobs; });

async function save(...jobs: Record<string, unknown>[]) {
  const dir = path.join(process.env.SELLORA_DATA_DIR!, "jobs");
  await mkdir(dir, { recursive: true });
  for (const item of jobs) await writeFile(path.join(dir, `${item.id}.json`), JSON.stringify(item));
}

it("sem execuções, os três agentes reais aparecem parados (nada simulado)", async () => {
  const agents = await agentRegistry();
  expect(agents.map((agent) => agent.id)).toEqual(["gerador-de-demos", "prospeccao", "coolify-deploy"]);
  for (const agent of agents) expect(agent).toMatchObject({ status: "idle", visual: "idle", currentRun: null, lastRun: null, recent: [] });
  expect(agents[1].role).toContain("sem IA generativa");
  expect(agents[2]).toMatchObject({ name: "Coolify Deploy Agent", runtime: "coolify" });
  expect(Object.keys((await claw3dState()).active)).toEqual(["gerador-de-demos", "prospeccao", "coolify-deploy"]);
});

it("Coolify Deploy Agent: estados vêm só das publicações reais (preparando, publicando, sucesso, erro)", async () => {
  const { writePublication } = await import("../publishing/store");
  const opId = randomUUID();
  const siteId = randomUUID();
  const t = "2026-11-13T10:00:00.000Z";
  const record = (status: "preparing" | "deploying" | "published" | "failed", finishedAt: string | null, error: string | null = null) => ({
    version: 1 as const, id: randomUUID(), leadId: "lead-9", owner: "demo:local", business: { name: "Pet Shop Teste", city: "Campinas", uf: "SP" }, slug: "pet-shop-teste",
    status, health: "unknown" as const, siteId, publishedSiteId: status === "published" ? siteId : null, url: status === "published" ? "https://pet-shop-teste.demos.exemplo.com.br/" : null,
    domain: "pet-shop-teste.demos.exemplo.com.br", coolifyAppUuid: "app1", coolifyAppName: "sellora-demo-pet-shop-teste",
    github: { repo: "sellora/demos", branch: "main", path: "demos/pet-shop-teste", commitSha: null }, createdAt: t, updatedAt: t, lastDeployAt: null, lastCheckedAt: null, lastError: error,
    operations: [{ id: opId, kind: "publish" as const, siteId, status, commitSha: null, coolifyDeploymentUuid: status === "preparing" ? null : "dep1", startedAt: t, finishedAt, error, events: [{ at: finishedAt ?? t, level: "info" as const, message: status === "deploying" ? "Coolify construindo e publicando" : "Enviando 2 arquivo(s)" }] }],
  });
  const holder = globalThis as { selloraPublishing?: { active: Map<string, string>; lastCheck: Map<string, number> } };
  holder.selloraPublishing = { active: new Map([["lead-9", opId]]), lastCheck: new Map() };
  await writePublication(record("preparing", null));
  let agent = (await agentRegistry()).find((item) => item.id === "coolify-deploy")!;
  expect(agent).toMatchObject({ status: "running", visual: "working" });
  await writePublication(record("deploying", null));
  agent = (await agentRegistry()).find((item) => item.id === "coolify-deploy")!;
  expect(agent.visual).toBe("deploying");
  expect(agent.currentRun).toMatchObject({ business: "Pet Shop Teste (Campinas/SP)", task: "Coolify construindo e publicando", leadId: "lead-9", stage: "deploying" });
  holder.selloraPublishing.active.clear();
  await writePublication(record("published", new Date().toISOString()));
  agent = (await agentRegistry()).find((item) => item.id === "coolify-deploy")!;
  expect(agent).toMatchObject({ status: "idle", visual: "success" });
  expect(agent.lastRun?.url).toBe("https://pet-shop-teste.demos.exemplo.com.br/");
  expect(visualState(null, agent.lastRun, Date.now() + SUCCESS_VISIBLE_MS + 1000)).toBe("idle");
  await writePublication(record("failed", new Date().toISOString(), "Deploy falhou no Coolify"));
  agent = (await agentRegistry()).find((item) => item.id === "coolify-deploy")!;
  expect(agent.visual).toBe("error");
  // Operação "em andamento" de um processo encerrado não aparece trabalhando.
  await writePublication(record("deploying", null));
  agent = (await agentRegistry()).find((item) => item.id === "coolify-deploy")!;
  expect(agent.status).toBe("idle");
  expect(agent.lastRun?.status).toBe("cancelled");
  delete holder.selloraPublishing;
});

it("pesquisa da Prospecção vira execução do agente prospeccao: ativa, concluída e interrompida", async () => {
  const { recordProspectRun } = await import("../prospecting/run-log");
  const view = (id: string, status: "running" | "completed" | "failed", extra: Record<string, unknown> = {}) => ({
    id, executor: "osm", params: { city: "Campinas", uf: "SP", segment: "todos", radiusKm: 5, maxResults: 10, opportunity: "sem_site" },
    status, phase: "verifying", message: "Verificando presença digital…", candidates: 40, analyzed: 12, planned: 20, found: 3, warnings: [],
    error: null, startedAt: "2026-11-13T10:00:00.000Z", finishedAt: status === "running" ? null : "2026-11-13T10:02:00.000Z", results: null, attribution: "", ...extra,
  }) as never;
  recordProspectRun(view("p-live", "running"));
  recordProspectRun(view("p-done", "completed", { message: "Pesquisa concluída: 3 oportunidade(s) classificadas.", phase: "done" }));
  recordProspectRun(view("p-orfa", "running"));
  (globalThis as { __selloraProspectJobs?: unknown }).__selloraProspectJobs = { jobs: new Map([["p-live", { owner: "x", view: { id: "p-live", status: "running" }, controller: new AbortController() }]]), starts: new Map() };
  const prospect = (await agentRegistry()).find((agent) => agent.id === "prospeccao")!;
  expect(prospect.status).toBe("running");
  expect(prospect.currentRun).toMatchObject({ runId: "p-live", agentId: "prospeccao", runtime: "openstreetmap", business: "Campinas/SP · todos os segmentos · 5 km" });
  const byId = Object.fromEntries(prospect.recent.map((run) => [run.runId, run]));
  expect(byId["p-done"]).toMatchObject({ status: "completed", task: "Pesquisa concluída: 3 oportunidade(s) classificadas." });
  expect(byId["p-orfa"].status).toBe("cancelled");
  delete (globalThis as { __selloraProspectJobs?: unknown }).__selloraProspectJobs;
});

it("job ativo neste processo aparece em execução com etapa e horário reais; job órfão aparece interrompido", async () => {
  const live = job({});
  const orphan = job({ startedAt: "2026-11-12T19:00:00.000Z", events: [{ at: "2026-11-12T19:00:00.000Z", phase: "Etapa 4" }] });
  await save(live, orphan);
  (globalThis as { selloraDemoJobs?: Map<string, { status: string }> }).selloraDemoJobs = new Map([[live.id as string, { status: "running" }]]);
  const [agent] = await agentRegistry();
  expect(agent.status).toBe("running");
  expect(agent.currentRun).toMatchObject({ runId: live.id, task: "Etapa 4: escrevendo o código", business: "Barbearia Teste Sellora", runtime: "claude-code", startedAt: "2026-11-12T20:00:00.000Z" });
  expect(agent.recent.find((run) => run.runId === orphan.id)?.status).toBe("cancelled");
});

it("gera eventos de ciclo de vida reais: início, etapa, conclusão aguardando aprovação e falha", async () => {
  const running = job({});
  await save(running);
  const live = new Set([running.id as string]);
  const first = await readJobs(40, live);
  expect(lifecycleEvents(new Map(), first).map((e) => e.phase)).toEqual(["start"]);
  const before = new Map(first.map((run) => [run.runId, run]));
  await save({ ...running, phase: "Etapa 6: testando em navegador real", events: [...(running.events as object[]), { at: "2026-11-12T20:02:00.000Z", phase: "Etapa 6: testando em navegador real" }] });
  const second = await readJobs(40, live);
  expect(lifecycleEvents(before, second)[0]).toMatchObject({ phase: "progress", text: "Etapa 6: testando em navegador real" });
  await save({ ...running, status: "completed", phase: "Demo pronta para revisão", finishedAt: "2026-11-12T20:03:00.000Z", result: { site: { id: "s1" } } });
  const done = await readJobs(40, new Set());
  expect(done[0].status).toBe("waiting_approval");
  expect(lifecycleEvents(new Map(second.map((run) => [run.runId, run])), done)[0]).toMatchObject({ phase: "end", siteId: "s1", leadId: "lead-1" });
  await save({ ...running, status: "failed", phase: "Geração interrompida", error: "Limite de uso atingido" });
  const failed = await readJobs(40, new Set());
  expect(lifecycleEvents(new Map(second.map((run) => [run.runId, run])), failed)[0]).toMatchObject({ phase: "error", text: "Limite de uso atingido" });
});
