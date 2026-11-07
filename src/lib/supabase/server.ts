import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabaseAnonKey, supabaseUrl } from "./config";

/**
 * Cliente Supabase do servidor (server actions / componentes de servidor).
 * Usa a sessão do usuário nos cookies → as consultas passam pelo RLS.
 * Criar um por requisição; nunca reaproveitar entre usuários.
 */
export async function createSupabaseServerClient() {
  const store = await cookies();
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Chamado durante renderização de servidor: o proxy renova a sessão.
        }
      },
    },
  });
}
