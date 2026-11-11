import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../supabase/server";
import { isSupabaseConfigured } from "../supabase/config";

/**
 * Quem pode usar as rotas da Prospecção IA:
 * - modo Supabase: só usuário autenticado (sessão conferida no servidor);
 * - modo demonstração (sem login): só requisições a localhost, para que um
 *   deploy sem Supabase não exponha o executor a qualquer visitante.
 * Escritas exigem mesma origem (proteção contra CSRF).
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.headers.get("sec-fetch-site") !== "cross-site";
  try {
    const url = new URL(request.url);
    // O Next.js pode normalizar a URL interna para localhost no servidor desktop.
    // Host preserva o endereço que a janela realmente acessou.
    const host = request.headers.get("host") ?? url.host;
    const expected = new URL(`${url.protocol}//${host}`);
    return new URL(origin).origin === expected.origin;
  } catch {
    return false;
  }
}

export async function requireAccess(request: Request, opts: { write?: boolean } = {}): Promise<{ owner: string } | NextResponse> {
  if (opts.write && !sameOrigin(request)) return json({ error: "Origem não permitida." }, 403);
  if (isSupabaseConfigured()) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    const sub = data?.claims?.sub;
    if (error || !sub) return json({ error: "Sua sessão expirou. Entre novamente para continuar.", code: "auth" }, 401);
    return { owner: `user:${sub}` };
  }
  // request.url pode refletir o endereço de bind; os cabeçalhos refletem o que o visitante acessou.
  const hostnameOf = (h: string) => h.trim().replace(/:\d+$/, "").toLowerCase();
  const hosts = [new URL(request.url).hostname, request.headers.get("host") ?? "", ...(request.headers.get("x-forwarded-host") ?? "").split(",")].filter(Boolean).map(hostnameOf);
  if (!hosts.length || hosts.some((h) => !LOCAL_HOSTS.has(h))) return json({ error: "No modo demonstração a Prospecção IA só funciona em localhost. Configure o Supabase para usar com login.", code: "forbidden" }, 403);
  return { owner: "demo:local" };
}
