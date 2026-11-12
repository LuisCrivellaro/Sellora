import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/lib/supabase/config";

/**
 * Proxy (Next 16, antigo middleware):
 * - sem Supabase configurado → modo demonstração, nada é bloqueado e /entrar volta ao painel;
 * - com Supabase → renova a sessão nos cookies e exige login em todas as páginas,
 *   exceto /entrar. É uma checagem otimista: as server actions conferem a sessão de novo.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isLogin = pathname === "/entrar";

  // Apenas o renderizador da prévia é público. Não consulta o CRM nem sessões;
  // recebe um snapshot comercial validado no fragmento (nunca no servidor).
  if (pathname === "/demo") return NextResponse.next();
  // Sites V6 publicados: arquivos estáticos da demo, servidos com CSP sandbox (src/lib/demos/v6/serve.ts).
  if (pathname.startsWith("/sites/")) return NextResponse.next();

  if (!isSupabaseConfigured()) {
    return isLogin ? NextResponse.redirect(new URL("/dashboard", request.url)) : NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list, headers) {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Não colocar lógica entre a criação do cliente e esta chamada (renovação de sessão).
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const redirectTo = (url: URL) => {
    const res = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  };

  if (!signedIn && !isLogin) {
    const url = new URL("/entrar", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return redirectTo(url);
  }
  if (signedIn && isLogin) return redirectTo(new URL("/dashboard", request.url));
  return response;
}

export const config = {
  // Tudo, exceto arquivos estáticos e imagens.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
