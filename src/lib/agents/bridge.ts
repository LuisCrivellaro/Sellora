import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { APP_PACKAGE_VERSION } from "../version";
import { z } from "zod";
import { demoDataRoot } from "../demos/codex-server";
import { CLAUDE_DEMO_MODEL } from "../demos/claude-server";
import { ALL_SEGMENTS_ID, PROSPECT_SEGMENTS } from "../prospecting/catalog";
import { liveProspectJobIds } from "../prospecting/jobs";
import { readProspectRuns } from "../prospecting/run-log";

/**
 * Sellora Agent Bridge (lado Sellora). Lê só execuções reais e descreve o que está acontecendo, sem agentes fictícios:
 * - Gerador de Demos: jobs gravados em <dados>/jobs/*.json (um por vez; etapas internas não são agentes separados);
 * - Prospecção: pesquisas OpenStreetMap + verificação HTTP + regras (sem IA generativa), resumidas em
 *   <dados>/prospect-runs/*.json e na fila em memória do servidor.
 */
export type AgentStatus = "paused" | "queued" | "running" | "waiting_approval" | "completed" | "failed" | "cancelled" | "offline" | "idle";

const jobSchema = z.object({
  id: z.uuid(), businessKey: z.string(), status: z.enum(["running", "paused", "cancelled", "completed", "failed"]), phase: z.string(),
  error: z.string().nullable().optional(), textProvider: z.enum(["claude", "codex"]).optional(), imageProvider: z.string().optional(),
  generator: z.enum(["v5", "v6"]).optional(), leadId: z.string().optional(), startedAt: z.string().optional(), finishedAt: z.string().optional(),
  events: z.array(z.object({ at: z.string(), phase: z.string() })).optional(),
  result: z.object({ site: z.object({ id: z.string() }).loose().optional() }).loose().nullable().optional(),
}).loose();
export type BridgeJob = z.infer<typeof jobSchema>;

export type AgentId = "gerador-de-demos" | "prospeccao";

export interface AgentRun {
  agentId: AgentId; runId: string; status: AgentStatus; task: string; business: string; runtime: string; generator: string;
  startedAt: string | null; updatedAt: string | null; finishedAt: string | null; error: string | null;
  events: { at: string; phase: string }[]; siteId: string | null; leadId: string | null;
}
export interface AgentRecord {
  id: AgentId; name: string; type: "worker"; role: string; runtime: string; status: AgentStatus;
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
        agentId: "gerador-de-demos", runId: job.id,
        status: running ? (liveIds.has(job.id) ? "running" : "cancelled") : job.status === "completed" ? "waiting_approval" : job.status === "paused" ? "paused" : job.status === "cancelled" ? "cancelled" : "failed",
        task: running && !liveIds.has(job.id) ? "Interrompido (o aplicativo foi fechado durante a geração)" : job.phase,
        business: businessName(job.businessKey), runtime: job.textProvider === "codex" ? "codex-app-server" : "claude-code",
        generator: job.generator ?? "v5", startedAt: job.startedAt ?? events[0]?.at ?? null, updatedAt: events.at(-1)?.at ?? job.finishedAt ?? null,
        finishedAt: job.finishedAt ?? null, error: job.error ?? null, events, siteId: job.result?.site?.id ?? null, leadId: job.leadId ?? null,
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

const segmentLabel = (id: string) => id === ALL_SEGMENTS_ID ? "todos os segmentos" : PROSPECT_SEGMENTS.find((segment) => segment.id === id)?.label ?? id;

/** Pesquisas da Prospecção como execuções do agente "prospeccao". Pesquisa "em andamento" de um processo encerrado aparece interrompida. */
export async function readProspectAgentRuns(limit = 40, liveIds: Set<string> = new Set()): Promise<AgentRun[]> {
  return (await readProspectRuns(limit)).map((run) => {
    const active = run.status === "running" || run.status === "queued";
    const live = active && liveIds.has(run.id);
    const status: AgentStatus = active ? (live ? "running" : "cancelled") : run.status === "completed" ? "completed" : run.status === "cancelled" ? "cancelled" : "failed";
    return {
      agentId: "prospeccao" as const, runId: run.id, status,
      task: active && !live ? "Interrompida (o aplicativo foi fechado durante a pesquisa)" : run.error ?? run.message,
      business: `${run.city}/${run.uf} · ${segmentLabel(run.segment)} · ${run.radiusKm} km`, runtime: "openstreetmap", generator: "osm",
      startedAt: run.startedAt, updatedAt: run.events.at(-1)?.at ?? run.finishedAt ?? run.startedAt, finishedAt: run.finishedAt,
      error: run.error, events: run.events.slice(-20), siteId: null, leadId: null,
    };
  });
}

/** Todas as execuções reais (gerador + prospecção), da mais recente à mais antiga. */
export async function readAllRuns(limit = 40): Promise<AgentRun[]> {
  const [demos, prospects] = await Promise.all([readJobs(limit, liveJobIds()), readProspectAgentRuns(limit, liveProspectJobIds())]);
  return [...demos, ...prospects].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")).slice(0, limit * 2);
}

const AGENTS: { id: AgentId; name: string; role: string; runtime: string }[] = [
  { id: "gerador-de-demos", name: "Gerador de Demos", role: "Cria sites demonstrativos V6: briefing, código, imagens, verificação e gravação para revisão humana", runtime: "claude-code" },
  { id: "prospeccao", name: "Prospecção", role: "Encontra estabelecimentos no OpenStreetMap, verifica sites por HTTP e classifica por regras (Local Client Prospector), sem IA generativa", runtime: "openstreetmap" },
];

export async function agentRegistry(): Promise<AgentRecord[]> {
  const runs = await readAllRuns(40);
  return AGENTS.map((agent) => {
    const own = runs.filter((run) => run.agentId === agent.id);
    const current = own.find((run) => run.status === "running") ?? null;
    const last = own.find((run) => run.status !== "running") ?? null;
    return {
      id: agent.id, name: agent.name, type: "worker" as const, role: agent.role,
      runtime: current?.runtime ?? last?.runtime ?? agent.runtime,
      status: current ? "running" as const : "idle" as const, currentRun: current, lastRun: last, recent: own.slice(0, 10),
    };
  });
}

/** Formato consumido pelo runtime `custom` do Claw3D (`GET /state`): agentes em `active`, identidade e runtime. */
export async function claw3dState() {
  const agents = await agentRegistry();
  return {
    runtime: { name: "Sellora Agent Bridge", version: APP_PACKAGE_VERSION, vendor: "Sellora", status: "ok", active_model: CLAUDE_DEMO_MODEL },
    profile: "sellora",
    active: Object.fromEntries(agents.map((agent) => [agent.id, agent.runtime === "codex-app-server" ? "codex" : agent.runtime === "openstreetmap" ? "openstreetmap" : CLAUDE_DEMO_MODEL])),
    identity: null,
    sellora: { agents },
  };
}

export function claw3dRegistry() {
  return { models: { [CLAUDE_DEMO_MODEL]: { provider: "claude-code", use: "textos e código das demos" }, codex: { provider: "codex-app-server", use: "imagens das demos" } } };
}

/** Diferença entre dois retratos: vira eventos de ciclo de vida no formato `agent` do Claw3D (start, etapa, fim, erro). */
export function lifecycleEvents(previous: Map<string, AgentRun>, runs: AgentRun[]) {
  const events: { agentId: AgentId; runId: string; phase: "start" | "progress" | "end" | "error"; text: string; at: string; business: string; siteId: string | null; leadId: string | null; generator: string }[] = [];
  for (const run of runs) {
    const before = previous.get(run.runId);
    const base = { agentId: run.agentId, runId: run.runId, at: run.updatedAt ?? new Date().toISOString(), business: run.business, siteId: run.siteId, leadId: run.leadId, generator: run.generator };
    if (run.status === "running" && !before) events.push({ ...base, phase: "start", text: run.task });
    else if (run.status === "running" && before && before.task !== run.task) events.push({ ...base, phase: "progress", text: run.task });
    else if (before?.status === "running" && run.status !== "running") events.push({ ...base, phase: run.status === "failed" || run.status === "cancelled" ? "error" : "end", text: run.error ?? run.task });
  }
  return events;
}

/** Endereço local do escritório 3D (Claw3D + Sellora Gateway Adapter, ver integrations/claw3d). */
export const claw3dBaseUrl = () => (process.env.SELLORA_CLAW3D_URL || "http://127.0.0.1:3190").replace(/\/$/, "");
const adapterHealthUrl = () => (process.env.SELLORA_CLAW3D_ADAPTER_HEALTH || "http://127.0.0.1:18790/health");

export interface Claw3dSceneStatus {
  available: boolean; url: string | null; bridge: "connected" | "disconnected" | "unknown"; message: string;
}

/** Confere se o escritório 3D local está no ar. Só localhost; nada de credenciais na resposta. */
export async function claw3dScene(fetcher: typeof fetch = fetch): Promise<Claw3dSceneStatus> {
  const base = claw3dBaseUrl();
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(base)) {
    return { available: false, url: null, bridge: "unknown", message: "SELLORA_CLAW3D_URL precisa apontar para 127.0.0.1 ou localhost." };
  }
  const probe = async (url: string) => {
    try { const response = await fetcher(url, { cache: "no-store", signal: AbortSignal.timeout(1500) }); return response.ok ? await response.json().catch(() => ({})) : null; } catch { return null; }
  };
  const [studio, adapter] = await Promise.all([probe(`${base}/api/health`), probe(adapterHealthUrl())]);
  if (!studio) {
    return { available: false, url: null, bridge: "unknown", message: "Escritório 3D desligado. No aplicativo Windows ele inicia junto com a Sellora quando o Claw3D está preparado; no desenvolvimento rode `node integrations/claw3d/setup.mjs` uma vez e depois `node integrations/claw3d/launcher.mjs`." };
  }
  const bridge = adapter?.bridge === "connected" ? "connected" : adapter ? "disconnected" : "unknown";
  return {
    available: true, url: `${base}/__sellora/office`, bridge,
    message: bridge === "connected" ? "Escritório 3D conectado aos eventos reais da Sellora." : "Escritório 3D no ar, mas o adaptador ainda não recebe eventos da Sellora (reconectando).",
  };
}
