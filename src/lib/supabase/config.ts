/**
 * Configuração pública do Supabase. Só URL e chave anônima/publicável — nunca a
 * service_role. Sem as duas variáveis, o app roda em modo demonstração local.
 * (Acesso literal a process.env.NEXT_PUBLIC_* para o Next embutir no bundle.)
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export function isSupabaseConfigured(url: string = supabaseUrl, key: string = supabaseAnonKey): boolean {
  return /^https?:\/\/\S+$/.test(url.trim()) && key.trim().length > 20;
}

export type DataMode = "local" | "supabase";

export const dataMode: DataMode = isSupabaseConfigured() ? "supabase" : "local";

/** Destino seguro depois do login: só caminhos internos (evita redirecionamento aberto). */
export function safeNextPath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  // Navegadores removem tab/CR/LF da URL ("/\t/evil.com" vira "//evil.com"): recusa controles e barra invertida.
  if (/[\x00-\x1F\x7F\\]/.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, "http://interno.invalid");
  } catch {
    return fallback;
  }
  if (url.origin !== "http://interno.invalid" || url.pathname.startsWith("/entrar")) return fallback;
  return url.pathname + url.search + url.hash;
}
