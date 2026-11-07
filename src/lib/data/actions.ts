"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "../types";
import { createSupabaseServerClient } from "../supabase/server";
import { isSupabaseConfigured } from "../supabase/config";
import { checkImportFile, remapIds } from "./import";
import {
  activityFromRow,
  changeSetToPayload,
  clientFromRow,
  itemFromRow,
  leadFromRow,
  paymentFromRow,
  projectFromRow,
  proposalFromRow,
  taskFromRow,
  transactionFromRow,
} from "./mappers";
import { changeSetSchema, settingsSchema } from "./row-schemas";
import { DB_VERSION, defaultSettings } from "./seed";
import { assembleDatabase, databaseToChangeSet, isEmptyChangeSet, type ChangeSet } from "./sync";

/**
 * Server actions do modo Supabase. Toda chamada:
 * 1. confere a sessão no servidor (o proxy não é a única barreira);
 * 2. valida a entrada com Zod;
 * 3. consulta/grava com o cliente do usuário → RLS decide o que é visível.
 * Erros do banco são registrados no servidor e devolvidos com mensagem genérica.
 */

export type ActionFailure = { ok: false; code: "auth" | "validation" | "server" | "config"; message: string };
export type ActionResult<T> = { ok: true; data: T } | ActionFailure;

const fail = (code: ActionFailure["code"], message: string): ActionFailure => ({ ok: false, code, message });

const AUTH_MESSAGE = "Sua sessão expirou. Entre novamente para continuar.";
const SAVE_MESSAGE = "Não foi possível salvar agora. Verifique a conexão e tente novamente.";

async function requireUser(): Promise<{ supabase: SupabaseClient; email: string } | ActionFailure> {
  if (!isSupabaseConfigured()) return fail("config", "Banco não configurado: o app está em modo demonstração.");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return fail("auth", AUTH_MESSAGE);
  return { supabase, email: typeof claims.email === "string" ? claims.email : "" };
}

function dbFailure(context: string, error: { code?: string; message?: string }): ActionFailure {
  console.error(`[sellora:${context}]`, error.code ?? "", error.message ?? "");
  switch (error.code) {
    case "28000":
    case "PGRST301":
    case "PGRST303":
      return fail("auth", AUTH_MESSAGE);
    case "42501":
      return fail("server", "Sem permissão para alterar este registro. Recarregue os dados.");
    case "23503":
      return fail("server", "Um registro relacionado não existe mais. Recarregue os dados e tente de novo.");
    case "23514":
    case "22P02":
    case "23502":
      return fail("validation", "Algum dado está fora do formato aceito pelo banco.");
    default:
      return fail("server", context === "load" ? "Não foi possível carregar os dados do banco." : SAVE_MESSAGE);
  }
}

const PAGE = 1000;

async function fetchAll(supabase: SupabaseClient, table: string, newestFirst: boolean) {
  const out: Record<string, unknown>[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at", { ascending: !newestFirst })
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) return out;
  }
}

export async function loadDatabase(): Promise<ActionResult<{ db: Database; email: string }>> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const { supabase, email } = auth;
  try {
    const [leads, clients, activities, projects, tasks, proposals, items, transactions, payments, settingsRes] = await Promise.all([
      fetchAll(supabase, "leads", true),
      fetchAll(supabase, "clients", true),
      fetchAll(supabase, "activities", true),
      fetchAll(supabase, "projects", true),
      fetchAll(supabase, "project_tasks", false),
      fetchAll(supabase, "proposals", true),
      fetchAll(supabase, "proposal_items", false),
      fetchAll(supabase, "transactions", true),
      fetchAll(supabase, "payments", false),
      supabase.from("settings").select("data, created_at").maybeSingle(),
    ]);
    if (settingsRes.error) throw settingsRes.error;

    const parsedSettings = settingsSchema.safeParse(settingsRes.data?.data);
    const settings = parsedSettings.success
      ? parsedSettings.data
      : { ...structuredClone(defaultSettings), profile: { ...defaultSettings.profile, name: "Administrador", email } };

    const db = assembleDatabase(
      {
        leads: leads.map(leadFromRow),
        clients: clients.map(clientFromRow),
        activities: activities.map(activityFromRow),
        projects: projects.map(projectFromRow),
        tasks: tasks.map(taskFromRow),
        proposals: proposals.map(proposalFromRow),
        items: items.map(itemFromRow),
        transactions: transactions.map(transactionFromRow),
        payments: payments.map(paymentFromRow),
      },
      settings,
      { version: DB_VERSION, seededAt: settingsRes.data?.created_at ? new Date(settingsRes.data.created_at).toISOString() : new Date().toISOString() },
    );
    return { ok: true, data: { db, email } };
  } catch (e) {
    return dbFailure("load", e as { code?: string; message?: string });
  }
}

async function apply(supabase: SupabaseClient, changes: ChangeSet, context: string): Promise<ActionResult<null>> {
  if (isEmptyChangeSet(changes)) return { ok: true, data: null };
  const { error } = await supabase.rpc("apply_changes", { payload: changeSetToPayload(changes) });
  if (error) return dbFailure(context, error);
  return { ok: true, data: null };
}

function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `Dados inválidos: ${issue.message}` : "Dados inválidos.";
}

/** Grava um conjunto de mudanças (inserções, alterações e exclusões) numa transação. */
export async function applyChanges(input: unknown): Promise<ActionResult<null>> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const parsed = changeSetSchema.safeParse(input);
  if (!parsed.success) {
    console.error("[sellora:apply] validação", parsed.error.issues.slice(0, 3));
    return fail("validation", firstIssue(parsed.error));
  }
  return apply(auth.supabase, parsed.data as ChangeSet, "apply");
}

/** Teste de conexão: sessão válida + consulta real ao banco. */
export async function checkConnection(): Promise<ActionResult<{ email: string }>> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const { error } = await auth.supabase.from("settings").select("owner_id", { head: true, count: "exact" });
  if (error) return dbFailure("check", error);
  return { ok: true, data: { email: auth.email } };
}

/** Importa o JSON exportado do modo local (somente dados reais, nunca demonstração). */
export async function importLocalData(input: unknown): Promise<ActionResult<{ counts: Record<string, number> }>> {
  const auth = await requireUser();
  if ("ok" in auth) return auth;
  const checked = checkImportFile(input);
  if (!checked.ok) return fail("validation", checked.message);
  const parsed = changeSetSchema.safeParse(databaseToChangeSet(remapIds(checked.db)));
  if (!parsed.success) {
    console.error("[sellora:import] validação", parsed.error.issues.slice(0, 3));
    const issue = parsed.error.issues[0];
    return fail("validation", `O arquivo tem registros fora do formato (${issue?.path.slice(0, 2).join(" › ") ?? "?"}): ${issue?.message ?? ""}`);
  }
  const res = await apply(auth.supabase, parsed.data as ChangeSet, "import");
  return res.ok ? { ok: true, data: { counts: checked.counts } } : res;
}
