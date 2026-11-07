"use client";

import { useSyncExternalStore } from "react";
import type { Database } from "../types";
import { createSeed, DB_VERSION } from "./seed";

/**
 * Armazenamento local do modo demonstração.
 * - Persistência: localStorage DESTE navegador (não sincroniza, não é backup).
 * - Interface pequena (load/commit/subscribe) para ser trocada por Supabase.
 */

const STORAGE_KEY = "sellora.db.v1";

type Status = "loading" | "ready";

interface StoreState {
  status: Status;
  db: Database | null;
  /** Falha de gravação (cota cheia, modo privado). Dados seguem em memória. */
  storageError: string | null;
}

let state: StoreState = { status: "loading", db: null, storageError: null };
const listeners = new Set<() => void>();
const serverState: StoreState = { status: "loading", db: null, storageError: null };

function emit() {
  for (const l of listeners) l();
}

function isDatabase(value: unknown): value is Database {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<Database>;
  return v.version === DB_VERSION && Array.isArray(v.leads) && Array.isArray(v.projects) && !!v.settings;
}

function load() {
  if (typeof window === "undefined" || state.status === "ready") return;
  let db: Database | null = null;
  let storageError: string | null = null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isDatabase(parsed)) db = parsed;
    }
  } catch {
    storageError = "Não foi possível ler os dados salvos neste navegador. Iniciamos uma nova demonstração em memória.";
  }
  if (!db) {
    db = createSeed();
    storageError = persist(db) ?? storageError;
  }
  state = { status: "ready", db, storageError };
}

function persist(db: Database): string | null {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return null;
  } catch {
    return "Não foi possível salvar neste navegador (armazenamento cheio ou bloqueado). As alterações valem só até recarregar a página.";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Carrega na primeira assinatura (cliente), depois da hidratação.
  if (state.status === "loading") {
    queueMicrotask(() => {
      load();
      emit();
    });
  }
  // Sincroniza alterações feitas em outra aba.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const parsed: unknown = JSON.parse(e.newValue);
      if (isDatabase(parsed)) {
        state = { ...state, db: parsed };
        emit();
      }
    } catch {
      /* ignora valor inválido de outra aba */
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function useStore(): StoreState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => serverState,
  );
}

export function getDb(): Database {
  if (!state.db) load();
  if (!state.db) throw new Error("Banco local indisponível.");
  return state.db;
}

/** Aplica uma alteração imutável, persiste e notifica. */
export function commit(mutator: (db: Database) => Database) {
  const next = mutator(getDb());
  const storageError = persist(next);
  state = { status: "ready", db: next, storageError };
  emit();
}

export function replaceDatabase(db: Database) {
  commit(() => db);
}
