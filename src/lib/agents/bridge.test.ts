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

it("sem jobs, há um único agente real e ele está parado (nada simulado)", async () => {
  const [agent] = await agentRegistry();
  expect(agent).toMatchObject({ id: "gerador-de-demos", status: "idle", currentRun: null, lastRun: null });
  expect(Object.keys((await claw3dState()).active)).toEqual(["gerador-de-demos"]);
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
