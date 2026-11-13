import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { agentRegistry, claw3dState, lifecycleEvents, readJobs } from "./bridge";

const job = (overrides: Record<string, unknown>) => ({ id: randomUUID(), businessKey: JSON.stringify({ name: "Barbearia Teste Sellora", city: "Campinas", uf: "SP", segment: "beleza" }), status: "running", phase: "Etapa 4: escrevendo o código", error: null, textProvider: "claude", generator: "v6", leadId: "lead-1", startedAt: "2026-11-12T20:00:00.000Z", events: [{ at: "2026-11-12T20:00:00.000Z", phase: "Preparando a geração" }, { at: "2026-11-12T20:01:00.000Z", phase: "Etapa 4: escrevendo o código" }], result: null, ...overrides });

beforeEach(() => { process.env.SELLORA_DATA_DIR = path.join(process.cwd(), "test-results", "bridge", randomUUID()); });
afterEach(() => { delete process.env.SELLORA_DATA_DIR; delete (globalThis as { selloraDemoJobs?: unknown }).selloraDemoJobs; });

async function save(...jobs: Record<string, unknown>[]) {
  const dir = path.join(process.env.SELLORA_DATA_DIR!, "jobs");
  await mkdir(dir, { recursive: true });
  for (const item of jobs) await writeFile(path.join(dir, `${item.id}.json`), JSON.stringify(item));
}

it("sem execuções, os dois agentes reais aparecem parados (nada simulado)", async () => {
  const agents = await agentRegistry();
  expect(agents.map((agent) => agent.id)).toEqual(["gerador-de-demos", "prospeccao"]);
  for (const agent of agents) expect(agent).toMatchObject({ status: "idle", currentRun: null, lastRun: null, recent: [] });
  expect(agents[1].role).toContain("sem IA generativa");
  expect(Object.keys((await claw3dState()).active)).toEqual(["gerador-de-demos", "prospeccao"]);
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
