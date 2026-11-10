"use client";

import { useSyncExternalStore } from "react";
import type { Database } from "../types";
import { dataMode, type DataMode } from "../supabase/config";
import { applyChanges, loadDatabase } from "./actions";
import { createSeed, DB_VERSION, normalizeDatabase } from "./seed";
import { diffDatabases, isEmptyChangeSet, type ChangeSet } from "./sync";

/**
 * Estado dos dados no navegador, com duas origens intercambiáveis:
 *
 * - **local** (sem variáveis do Supabase): modo demonstração em localStorage
 *   DESTE navegador — não sincroniza, não é backup. Comportamento original.
 * - **supabase**: os dados vêm do Postgres (RLS) depois do login. Cada operação
 *   do repositório atualiza a tela na hora e entra numa fila que envia ao
 *   servidor só o que mudou (diff), em ordem, uma transação por operação.
 *   Se uma gravação falha, a fila para e o usuário escolhe tentar de novo ou
 *   descartar (volta ao último estado confirmado pelo banco). Nada se perde
 *   em silêncio.
 *
 * Os componentes continuam lendo `useStore().db` e chamando o repositório.
 */

const STORAGE_KEY = "sellora.db.v1";

type Status = "loading" | "ready" | "error";

export interface SyncState {
  /** Operações aguardando confirmação do banco. */
  pending: number;
  /** Mensagem da última falha de gravação (fila parada até decidir). */
  error: string | null;
  /** A falha foi sessão expirada. */
  authExpired: boolean;
}

export interface StoreState {
  status: Status;
  mode: DataMode;
  db: Database | null;
  /** Falha de gravação local (cota cheia, modo privado). Dados seguem em memória. */
  storageError: string | null;
  /** Falha ao carregar do banco (modo supabase). */
  loadError: string | null;
  /** Conta autenticada (modo supabase). */
  account: { email: string } | null;
  sync: SyncState;
}

const idleSync: SyncState = { pending: 0, error: null, authExpired: false };

let state: StoreState = { status: "loading", mode: dataMode, db: null, storageError: null, loadError: null, account: null, sync: idleSync };
const listeners = new Set<() => void>();
const serverState: StoreState = { ...state };

function emit() {
  for (const l of listeners) l();
}

function set(patch: Partial<StoreState>) {
  state = { ...state, ...patch };
  emit();
}

/* ───────────────────────────── Modo local ───────────────────────────── */

function isDatabase(value: unknown): value is Database {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<Database>;
  return v.version === DB_VERSION && Array.isArray(v.leads) && Array.isArray(v.projects) && !!v.settings;
}

function loadLocal() {
  if (typeof window === "undefined" || state.status === "ready") return;
  let db: Database | null = null;
  let storageError: string | null = null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isDatabase(parsed)) db = normalizeDatabase(parsed);
    }
  } catch {
    storageError = "Não foi possível ler os dados salvos neste navegador. Iniciamos uma nova demonstração em memória.";
  }
  if (!db) {
    db = createSeed();
    storageError = persistLocal(db) ?? storageError;
  }
  state = { ...state, status: "ready", db, storageError };
}

function persistLocal(db: Database): string | null {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return null;
  } catch {
    return "Não foi possível salvar neste navegador (armazenamento cheio ou bloqueado). As alterações valem só até recarregar a página.";
  }
}

/* ───────────────────────────── Modo Supabase ───────────────────────────── */

interface QueueEntry {
  changes: ChangeSet;
  /** Estado completo depois desta operação (vira o "confirmado" quando gravar). */
  after: Database;
}

let queue: QueueEntry[] = [];
let confirmed: Database | null = null;
let sending = false;
let loadingRemote = false;

async function loadRemote() {
  if (loadingRemote) return;
  loadingRemote = true;
  if (state.status !== "loading") set({ status: "loading", loadError: null });
  try {
    const res = await loadDatabase();
    if (res.ok) {
      confirmed = res.data.db;
      queue = [];
      set({ status: "ready", db: res.data.db, account: { email: res.data.email }, loadError: null, sync: idleSync });
    } else if (res.code === "auth") {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa proposital ao perder a sessão
      window.location.assign(`/entrar?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    } else {
      set({ status: "error", loadError: res.message });
    }
  } catch {
    set({ status: "error", loadError: "Sem resposta do servidor. Verifique a conexão." });
  } finally {
    loadingRemote = false;
  }
}

async function pump() {
  if (sending || state.sync.error) return;
  sending = true;
  try {
    while (queue.length) {
      const entry = queue[0];
      let failure: { message: string; auth: boolean } | null = null;
      try {
        const res = await applyChanges(entry.changes);
        if (!res.ok) failure = { message: res.message, auth: res.code === "auth" };
      } catch {
        failure = { message: "Sem resposta do servidor. Verifique a conexão e tente de novo.", auth: false };
      }
      if (failure) {
        set({ sync: { pending: queue.length, error: failure.message, authExpired: failure.auth } });
        return;
      }
      confirmed = entry.after;
      queue.shift();
      set({ sync: { ...state.sync, pending: queue.length } });
    }
  } finally {
    sending = false;
  }
}

function onBeforeUnload(e: BeforeUnloadEvent) {
  if (state.mode === "supabase" && state.sync.pending > 0) e.preventDefault();
}

/* ───────────────────────────── API pública ───────────────────────────── */

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Carrega na primeira assinatura (cliente), depois da hidratação.
  if (state.status === "loading" && !state.db) queueMicrotask(() => void ensureLoaded());
  // Sincroniza alterações feitas em outra aba (somente modo local).
  const onStorage = (e: StorageEvent) => {
    if (state.mode !== "local" || e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed: unknown = JSON.parse(e.newValue);
      if (isDatabase(parsed)) set({ db: normalizeDatabase(parsed) });
    } catch {
      /* ignora valor inválido de outra aba */
    }
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("beforeunload", onBeforeUnload);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("beforeunload", onBeforeUnload);
  };
}

/** Carrega os dados da origem ativa (idempotente). */
export async function ensureLoaded(): Promise<void> {
  if (state.db) return;
  if (state.mode === "supabase") return loadRemote();
  loadLocal();
  emit();
}

/** Leitura fora do React (testes e utilitários). */
export function getStoreState(): StoreState {
  return state;
}

export function useStore(): StoreState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

export function getDb(): Database {
  if (!state.db && state.mode === "local") loadLocal();
  if (!state.db) throw new Error(state.mode === "local" ? "Banco local indisponível." : "Os dados ainda estão carregando. Aguarde um instante.");
  return state.db;
}

export function getMode(): DataMode {
  return state.mode;
}

/** Aplica uma alteração imutável, persiste (local) ou enfileira para o banco (supabase) e notifica. */
export function commit(mutator: (db: Database) => Database) {
  const prev = getDb();
  const next = mutator(prev);
  if (next === prev) return;
  if (state.mode === "local") {
    const storageError = persistLocal(next);
    set({ status: "ready", db: next, storageError });
    return;
  }
  const changes = diffDatabases(prev, next);
  if (isEmptyChangeSet(changes)) {
    set({ db: next });
    return;
  }
  queue.push({ changes, after: next });
  set({ db: next, sync: { ...state.sync, pending: queue.length } });
  void pump();
}

export function replaceDatabase(db: Database) {
  commit(() => db);
}

/** Reenvia a fila parada por erro. */
export function retrySync() {
  set({ sync: { ...state.sync, error: null, authExpired: false } });
  void pump();
}

/** Descarta as alterações não gravadas e volta ao último estado confirmado pelo banco. */
export function discardPending() {
  queue = [];
  set({ db: confirmed, sync: idleSync });
}

/** Recarrega tudo do banco (após erro de carregamento ou importação). */
export function reloadFromServer() {
  if (state.mode !== "supabase" || queue.length) return;
  void loadRemote();
}
