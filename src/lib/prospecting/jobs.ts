import { JOB_LIMITS, type ExecutorId } from "./config";
import { runOsmProspecting, type Progress } from "./executor";
import { SourceError } from "./osm";
import type { JobView, ProspectParams } from "./types";
import { uid } from "../utils";
import { recordProspectRun } from "./run-log";

/**
 * Fila de jobs em memória do processo do servidor (globalThis sobrevive ao
 * HMR e é compartilhado entre rotas). Os resultados ficam aqui até 1 hora
 * depois de concluir; o navegador guarda o histórico definitivo.
 * Limites: 1 job ativo por usuário, 2 no servidor, 10 por hora por usuário,
 * 5 minutos por job.
 */

interface Job {
  owner: string;
  view: JobView;
  controller: AbortController;
}

interface Registry {
  jobs: Map<string, Job>;
  starts: Map<string, number[]>;
}

const g = globalThis as typeof globalThis & { __selloraProspectJobs?: Registry };
const registry: Registry = (g.__selloraProspectJobs ??= { jobs: new Map(), starts: new Map() });

export class JobLimitError extends Error {}

const isActive = (j: Job) => j.view.status === "queued" || j.view.status === "running";

function sweep(now = Date.now()) {
  for (const [id, job] of registry.jobs) {
    const started = Date.parse(job.view.startedAt);
    if (isActive(job) && now - started > JOB_LIMITS.timeoutMs) {
      job.controller.abort();
      finish(job, "failed", "A pesquisa passou de 5 minutos e foi interrompida. Reduza o raio ou a quantidade.");
    }
    const ended = job.view.finishedAt ? Date.parse(job.view.finishedAt) : null;
    if (ended && now - ended > JOB_LIMITS.keepMs) registry.jobs.delete(id);
  }
}

function finish(job: Job, status: JobView["status"], error: string | null) {
  if (!isActive(job)) return;
  job.view = { ...job.view, status, phase: "done", error, finishedAt: new Date().toISOString(), message: error ?? job.view.message };
  recordProspectRun(job.view);
}

export function startJob(owner: string, params: ProspectParams, executor: ExecutorId): JobView {
  params = { ...params, maxResults: 10 };
  sweep();
  const now = Date.now();
  const all = [...registry.jobs.values()];
  if (all.some((j) => j.owner === owner && isActive(j))) throw new JobLimitError("Já existe uma pesquisa em andamento. Aguarde terminar ou cancele.");
  if (all.filter(isActive).length >= JOB_LIMITS.activeGlobal) throw new JobLimitError("O servidor já está executando o máximo de pesquisas simultâneas. Tente em instantes.");
  const recent = (registry.starts.get(owner) ?? []).filter((t) => now - t < 3600_000);
  if (recent.length >= JOB_LIMITS.jobsPerHour) throw new JobLimitError(`Limite de ${JOB_LIMITS.jobsPerHour} pesquisas por hora atingido. Tente mais tarde.`);
  registry.starts.set(owner, [...recent, now]);

  const job: Job = {
    owner,
    controller: new AbortController(),
    view: {
      id: uid(),
      executor,
      params,
      status: "queued",
      phase: "geocoding",
      message: "Na fila…",
      candidates: 0,
      analyzed: 0,
      planned: 0,
      found: 0,
      warnings: [],
      error: null,
      startedAt: new Date(now).toISOString(),
      finishedAt: null,
      results: null,
      attribution: "",
    },
  };
  registry.jobs.set(job.view.id, job);
  recordProspectRun(job.view);

  const report = (p: Progress) => {
    if (!isActive(job)) return;
    const { warning, ...rest } = p;
    job.view = { ...job.view, ...rest, status: "running", warnings: warning ? [...job.view.warnings, warning] : job.view.warnings };
    recordProspectRun(job.view);
  };

  void (async () => {
    try {
      job.view = { ...job.view, status: "running" };
      const out = await runOsmProspecting(params, job.controller.signal, report);
      if (!isActive(job)) return;
      job.view = { ...job.view, results: out.results, attribution: out.attribution, found: out.results.filter((r) => r.classification !== "SKIP").length };
      finish(job, "completed", null);
      job.view = { ...job.view, message: out.results.length ? `Pesquisa concluída: ${job.view.found} oportunidade(s) classificadas.` : "Pesquisa concluída sem resultados para esse filtro." };
      recordProspectRun(job.view);
    } catch (e) {
      if (job.controller.signal.aborted && job.view.status !== "failed") {
        finish(job, "cancelled", "Pesquisa cancelada.");
        return;
      }
      const message = e instanceof SourceError ? e.message : "Falha inesperada na pesquisa. Tente novamente.";
      if (!(e instanceof SourceError)) console.error("[sellora:prospeccao]", e);
      finish(job, "failed", message);
    }
  })();

  return publicView(job);
}

function publicView(job: Job): JobView {
  return job.view;
}

export function getJob(id: string, owner: string): JobView | null {
  sweep();
  const job = registry.jobs.get(id);
  return job && job.owner === owner ? publicView(job) : null;
}

export function cancelJob(id: string, owner: string): JobView | null {
  const job = registry.jobs.get(id);
  if (!job || job.owner !== owner) return null;
  if (isActive(job)) {
    job.controller.abort();
    finish(job, "cancelled", "Pesquisa cancelada.");
  }
  return publicView(job);
}

/** Ids das pesquisas ativas neste processo (observabilidade: Cloud 3D). */
export function liveProspectJobIds(): Set<string> {
  return new Set([...(g.__selloraProspectJobs ?? registry).jobs.values()].filter(isActive).map((job) => job.view.id));
}
