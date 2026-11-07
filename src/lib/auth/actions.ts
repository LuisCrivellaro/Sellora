"use server";

import { isSupabaseConfigured } from "../supabase/config";
import { createSupabaseServerClient } from "../supabase/server";
import { signInSchema } from "./schema";

export type AuthResult = { ok: true } | { ok: false; message: string; field?: "email" | "password" };

/** Login por e-mail e senha. A sessão fica em cookies httpOnly gerenciados pelo @supabase/ssr. */
export async function signIn(input: unknown): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return { ok: false, message: "Login indisponível: o app está em modo demonstração." };
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, message: issue?.message ?? "Dados inválidos.", field: issue?.path[0] === "password" ? "password" : "email" };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (!error) return { ok: true };
  if (error.code === "invalid_credentials") return { ok: false, message: "E-mail ou senha incorretos." };
  if (error.code === "email_not_confirmed") return { ok: false, message: "Confirme o e-mail desta conta antes de entrar." };
  if (error.status === 429 || error.code === "over_request_rate_limit") return { ok: false, message: "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo." };
  console.error("[sellora:signin]", error.code ?? "", error.status ?? "");
  return { ok: false, message: "Não foi possível entrar agora. Verifique a conexão e tente novamente." };
}

export async function signOut(): Promise<AuthResult> {
  if (!isSupabaseConfigured()) return { ok: true };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("[sellora:signout]", error.code ?? "");
    return { ok: false, message: "Não foi possível sair agora. Tente novamente." };
  }
  return { ok: true };
}
