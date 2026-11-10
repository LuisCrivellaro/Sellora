"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearActiveJob, failSearch, finishSearch, startSearch, useProspects } from "@/lib/prospecting/store";
import type { ExecutorStatus, JobView, ProspectParams } from "@/lib/prospecting/types";

/**
 * Conversa com as rotas /api/prospeccao: estado do executor, início do job,
 * acompanhamento (polling a cada 1,2 s) e cancelamento. Retoma o job ativo se
 * a página for recarregada enquanto ele roda. Nada é simulado no cliente.
 */

type StatusState = { state: "loading" } | { state: "ready"; status: ExecutorStatus } | { state: "error"; message: string };

const POLL_MS = 1200;

async function readJson(res: Response): Promise<Record<string, unknown>> {
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorMessage(res: Response, body: Record<string, unknown>, fallback: string) {
  if (typeof body.error === "string") return body.error;
  if (res.status === 401) return "Sua sessão expirou. Entre novamente para continuar.";
  return fallback;
}

async function requestStatus(): Promise<StatusState> {
  try {
    const res = await fetch("/api/prospeccao/status", { cache: "no-store" });
    const body = await readJson(res);
    if (!res.ok) return { state: "error", message: errorMessage(res, body, "Não foi possível consultar a integração.") };
    return { state: "ready", status: body as unknown as ExecutorStatus };
  } catch {
    return { state: "error", message: "Sem resposta do servidor. Verifique se o app está rodando." };
  }
}

export function useProspectJob() {
  const { activeJobId, ready } = useProspects();
  const [status, setStatus] = useState<StatusState>({ state: "loading" });
  const [job, setJob] = useState<JobView | null>(null);
  const [starting, setStarting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  /** Geração do polling: um laço antigo com requisição em voo não reagenda. */
  const generation = useRef(0);
  const pollingId = useRef<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    requestStatus().then((s) => alive && setStatus(s));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const loadStatus = useCallback(() => {
    setStatus({ state: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const stopPolling = () => {
    generation.current++;
    pollingId.current = null;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const poll = useCallback((id: string) => {
    stopPolling();
    const gen = generation.current;
    pollingId.current = id;
    const tick = async () => {
      if (gen !== generation.current) return;
      try {
        const res = await fetch(`/api/prospeccao/jobs/${id}`, { cache: "no-store" });
        const body = await readJson(res);
        if (gen !== generation.current) return;
        if (!res.ok) {
          pollingId.current = null;
          setRequestError(errorMessage(res, body, "Não foi possível acompanhar a pesquisa."));
          if (res.status === 404) failSearch(id, errorMessage(res, body, "Pesquisa perdida."));
          else clearActiveJob();
          setJob((j) => (j && j.id === id && (j.status === "running" || j.status === "queued") ? { ...j, status: "failed", error: errorMessage(res, body, "Pesquisa perdida.") } : j));
          return;
        }
        const view = body.job as JobView;
        setJob(view);
        if (view.status === "running" || view.status === "queued") timer.current = window.setTimeout(tick, POLL_MS);
        else {
          pollingId.current = null;
          finishSearch(view);
        }
      } catch {
        // Falha de rede momentânea: tenta de novo com intervalo maior.
        if (gen === generation.current) timer.current = window.setTimeout(tick, POLL_MS * 3);
      }
    };
    void tick();
  }, []);

  // Retoma o job ativo salvo (recarga da página durante a execução).
  useEffect(() => {
    if (ready && activeJobId && pollingId.current !== activeJobId) poll(activeJobId);
  }, [ready, activeJobId, poll]);

  useEffect(() => stopPolling, []);

  const start = useCallback(
    async (params: ProspectParams) => {
      setStarting(true);
      setRequestError(null);
      try {
        const res = await fetch("/api/prospeccao/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) });
        const body = await readJson(res);
        if (!res.ok) {
          setRequestError(errorMessage(res, body, "Não foi possível iniciar a pesquisa."));
          if (res.status === 503) void loadStatus();
          return false;
        }
        const view = body.job as JobView;
        setJob(view);
        startSearch(view);
        poll(view.id);
        return true;
      } catch {
        setRequestError("Sem resposta do servidor. Verifique a conexão e tente de novo.");
        return false;
      } finally {
        setStarting(false);
      }
    },
    [poll, loadStatus],
  );

  const cancel = useCallback(async () => {
    if (!job) return;
    try {
      const res = await fetch(`/api/prospeccao/jobs/${job.id}`, { method: "DELETE" });
      const body = await readJson(res);
      if (!res.ok) {
        setRequestError(errorMessage(res, body, "Não foi possível cancelar."));
        return;
      }
      stopPolling();
      const view = body.job as JobView;
      setJob(view);
      finishSearch(view);
    } catch {
      setRequestError("Sem resposta do servidor ao cancelar.");
    }
  }, [job]);

  const dismiss = useCallback(() => {
    setJob(null);
    setRequestError(null);
  }, []);

  const running = !!job && (job.status === "running" || job.status === "queued");
  return { status, reloadStatus: loadStatus, job, running, starting, requestError, start, cancel, dismiss };
}
