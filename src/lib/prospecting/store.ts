"use client";

import { useSyncExternalStore } from "react";
import type { JobView, ProspectParams, ProspectResult } from "./types";

/**
 * Histórico da Prospecção IA no navegador: pesquisas feitas e resultados
 * recebidos do executor real. Fica no localStorage DESTE navegador, separado
 * por conta (modo Supabase) ou "local" (modo demonstração). O que vai para o
 * CRM é gravado pelo repositório (localStorage ou Postgres, conforme o modo).
 */

export interface ProspectSearch {
  id: string;
  jobId: string;
  executor: string;
  params: ProspectParams;
  startedAt: string;
  finishedAt: string | null;
  status: JobView["status"];
  found: number;
  analyzed: number;
  error: string | null;
  warnings: string[];
  attribution: string;
}

export interface StoredProspect extends ProspectResult {
  searchId: string;
  discarded: boolean;
  importedLeadId: string | null;
}

export interface ProspectState {
  ready: boolean;
  searches: ProspectSearch[];
  results: StoredProspect[];
  activeJobId: string | null;
  storageError: string | null;
}

const VERSION = 1;
const MAX_RESULTS = 1500;
const MAX_SEARCHES = 200;

let scope = "local";
let state: ProspectState = { ready: false, searches: [], results: [], activeJobId: null, storageError: null };
const server: ProspectState = state;
const listeners = new Set<() => void>();

const keyFor = (s: string) => `sellora.prospeccao.v${VERSION}:${s}`;

function emit() {
  for (const l of listeners) l();
}

function persist() {
  try {
    window.localStorage.setItem(keyFor(scope), JSON.stringify({ searches: state.searches, results: state.results, activeJobId: state.activeJobId }));
    return null;
  } catch {
    return "Não foi possível salvar o histórico da prospecção neste navegador (armazenamento cheio ou bloqueado).";
  }
}

function set(patch: Partial<ProspectState>, save = true) {
  state = { ...state, ...patch };
  if (save && typeof window !== "undefined") state = { ...state, storageError: persist() };
  emit();
}

/** Carrega o histórico do escopo (conta) atual. Idempotente por escopo. */
export function loadProspects(nextScope: string) {
  if (typeof window === "undefined") return;
  if (state.ready && nextScope === scope) return;
  scope = nextScope;
  let searches: ProspectSearch[] = [];
  let results: StoredProspect[] = [];
  let activeJobId: string | null = null;
  let storageError: string | null = null;
  try {
    const raw = window.localStorage.getItem(keyFor(scope));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ProspectState>;
      if (Array.isArray(parsed.searches)) searches = parsed.searches;
      if (Array.isArray(parsed.results)) results = parsed.results;
      if (typeof parsed.activeJobId === "string") activeJobId = parsed.activeJobId;
    }
  } catch {
    storageError = "Não foi possível ler o histórico da prospecção neste navegador.";
  }
  state = { ready: true, searches, results, activeJobId, storageError };
  emit();
}

export function useProspects(): ProspectState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => server,
  );
}

export function startSearch(job: JobView): ProspectSearch {
  const search: ProspectSearch = {
    id: job.id,
    jobId: job.id,
    executor: job.executor,
    params: job.params,
    startedAt: job.startedAt,
    finishedAt: null,
    status: job.status,
    found: 0,
    analyzed: 0,
    error: null,
    warnings: [],
    attribution: "",
  };
  set({ searches: [search, ...state.searches].slice(0, MAX_SEARCHES), activeJobId: job.id });
  return search;
}

/** Registra o fim do job; resultados de pesquisas anteriores com o mesmo id de origem são atualizados, sem perder descarte/importação. */
export function finishSearch(job: JobView) {
  const searches = state.searches.map((s) =>
    s.jobId === job.id ? { ...s, status: job.status, finishedAt: job.finishedAt, found: job.found, analyzed: job.analyzed, error: job.error, warnings: job.warnings, attribution: job.attribution } : s,
  );
  let results = state.results;
  if (job.status === "completed" && job.results) {
    const prev = new Map(results.map((r) => [r.id, r]));
    const incoming: StoredProspect[] = job.results.map((r) => {
      const old = prev.get(r.id);
      return { ...r, searchId: job.id, discarded: old?.discarded ?? false, importedLeadId: old?.importedLeadId ?? null };
    });
    const ids = new Set(incoming.map((r) => r.id));
    results = [...incoming, ...results.filter((r) => !ids.has(r.id))].slice(0, MAX_RESULTS);
  }
  set({ searches, results, activeJobId: state.activeJobId === job.id ? null : state.activeJobId });
}

export function clearActiveJob() {
  set({ activeJobId: null });
}

/** O servidor não conhece mais o job (reiniciado ou expirado): registra a falha no histórico. */
export function failSearch(jobId: string, message: string) {
  set({
    searches: state.searches.map((s) => (s.jobId === jobId && !s.finishedAt ? { ...s, status: "failed", finishedAt: new Date().toISOString(), error: message } : s)),
    activeJobId: state.activeJobId === jobId ? null : state.activeJobId,
  });
}

export function setDiscarded(ids: string[], discarded: boolean) {
  const s = new Set(ids);
  set({ results: state.results.map((r) => (s.has(r.id) ? { ...r, discarded } : r)) });
}

export function markImported(links: { resultId: string; leadId: string }[]) {
  const m = new Map(links.map((l) => [l.resultId, l.leadId]));
  set({ results: state.results.map((r) => (m.has(r.id) ? { ...r, importedLeadId: m.get(r.id)! } : r)) });
}

export function removeSearchHistory() {
  set({ searches: [], results: [], activeJobId: null });
}
