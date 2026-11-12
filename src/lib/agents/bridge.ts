import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { demoDataRoot } from "../demos/codex-server";
import { CLAUDE_DEMO_MODEL } from "../demos/claude-server";

/**
 * Sellora Agent Bridge (lado Sellora). Lê só os jobs reais gravados pelo gerador de demos
 * (<dados>/jobs/*.json, atualizados a cada etapa) e descreve o que está acontecendo, sem agentes fictícios.
 * Hoje existe um agente real: o gerador de demos (um job por vez; etapas internas não são agentes separados).
 */
export type AgentStatus = "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled" | "offline" | "idle";

const jobSchema = z.object({
  id: z.uuid(), businessKey: z.string(), status: z.enum(["running", "completed", "failed"]), phase: z.string(),
  error: z.string().nullable().optional(), textProvider: z.enum(["claude", "codex"]).optional(), imageProvider: z.string().optional(),
  generator: z.enum(["v5", "v6"]).optional(), startedAt: z.string().optional(), finishedAt: z.string().optional(),
  events: z.array(z.object({ at: z.string(), phase: z.string() })).optional(),
  result: z.object({ site: z.object({ id: z.string() }).loose().optional() }).loose().nullable().optional(),
}).loose();
export type BridgeJob = z.infer<typeof jobSchema>;

export interface AgentRun {
  runId: string; status: AgentStatus; task: string; business: string; runtime: string; generator: string;
  startedAt: string | null; updatedAt: string | null; finishedAt: string | null; error: string | null;
  events: { at: string; phase: string }[]; siteId: string | null;
}
export interface AgentRecord {
  id: "gerador-de-demos"; name: string; type: "worker"; role: string; runtime: string; status: AgentStatus;
  currentRun: AgentRun | null; lastRun: AgentRun | null; recent: AgentRun[];
}

const businessName = (key: string) => { try { return String(JSON.parse(key).name ?? "Estabelecimento"); } catch { return "Estabelecimento"; } };

/** Jobs gravados, do mais recente ao mais antigo. Um job "running" de um processo que já morreu não aparece como ativo. */
export async function readJobs(limit = 40, liveIds: Set<string> = new Set()): Promise<AgentRun[]> {
  const dir = path.join(demoDataRoot(), "jobs");
  const runs: AgentRun[] = [];
  for (const file of await readdir(dir).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    try {
      const job = jobSchema.parse(JSON.parse(await readFile(path.join(dir, file), "utf8")));
      const events = (job.events ?? []).slice(-20);
      const running = job.status === "running";
      runs.push({
        runId: job.id,
        status: running ? (liveIds.has(job.id) ? "running" : "cancelled") : job.status === "completed" ? "waiting_approval" : "failed",
        task: running && !liveIds.has(job.id) ? "Interrompido (o aplicativo foi fechado durante a geração)" : job.phase,
        business: businessName(job.businessKey), runtime: job.textProvider === "codex" ? "codex-app-server" : "claude-code",
        generator: job.generator ?? "v5", startedAt: job.startedAt ?? events[0]?.at ?? null, updatedAt: events.at(-1)?.at ?? job.finishedAt ?? null,
        finishedAt: job.finishedAt ?? null, error: job.error ?? null, events, siteId: job.result?.site?.id ?? null,
      });
    } catch { /* arquivo de outra versão: não é evidência de execução */ }
  }
  return runs.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, limit);
}

/** Ids dos jobs ativos neste processo (o mapa em memória do gerador). */
export function liveJobIds(): Set<string> {
  const jobs = (globalThis as typeof globalThis & { selloraDemoJobs?: Map<string, { status: string }> }).selloraDemoJobs;
  return new Set([...(jobs?.entries() ?? [])].filter(([, job]) => job.status === "running").map(([id]) => id));
}

export async function agentRegistry(): Promise<AgentRecord[]> {
  const runs = await readJobs(40, liveJobIds());
  const current = runs.find((run) => run.status === "running") ?? null;
  const last = runs.find((run) => run.status !== "running") ?? null;
  return [{
    id: "gerador-de-demos", name: "Gerador de Demos", type: "worker",
    role: "Cria sites demonstrativos V6: briefing, código, imagens, verificação e gravação para revisão humana",
    runtime: current?.runtime ?? last?.runtime ?? "claude-code",
    status: current ? "running" : "idle", currentRun: current, lastRun: last, recent: runs.slice(0, 10),
  }];
}

/** Formato consumido pelo runtime `custom` do Claw3D (`GET /state`): agentes em `active`, identidade e runtime. */
export async function claw3dState() {
  const [agent] = await agentRegistry();
  return {
    runtime: { name: "Sellora Agent Bridge", version: "0.1.0", vendor: "Sellora", status: "ok", active_model: CLAUDE_DEMO_MODEL },
    profile: "sellora",
    active: { [agent.id]: agent.runtime === "codex-app-server" ? "codex" : CLAUDE_DEMO_MODEL },
    identity: null,
    sellora: { agents: [agent] },
  };
}

export function claw3dRegistry() {
  return { models: { [CLAUDE_DEMO_MODEL]: { provider: "claude-code", use: "textos e código das demos" }, codex: { provider: "codex-app-server", use: "imagens das demos" } } };
}

/** Diferença entre dois retratos: vira eventos de ciclo de vida no formato `agent` do Claw3D (start, etapa, fim, erro). */
export function lifecycleEvents(previous: Map<string, AgentRun>, runs: AgentRun[]) {
  const events: { agentId: string; runId: string; phase: "start" | "progress" | "end" | "error"; text: string; at: string; business: string; siteId: string | null }[] = [];
  for (const run of runs) {
    const before = previous.get(run.runId);
    const base = { agentId: "gerador-de-demos", runId: run.runId, at: run.updatedAt ?? new Date().toISOString(), business: run.business, siteId: run.siteId };
    if (run.status === "running" && !before) events.push({ ...base, phase: "start", text: run.task });
    else if (run.status === "running" && before && before.task !== run.task) events.push({ ...base, phase: "progress", text: run.task });
    else if (before?.status === "running" && run.status !== "running") events.push({ ...base, phase: run.status === "failed" || run.status === "cancelled" ? "error" : "end", text: run.error ?? run.task });
  }
  return events;
}
