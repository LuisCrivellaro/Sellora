import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { LogoMark } from "@/components/shell/logo";
import { isSupabaseConfigured, safeNextPath } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Entrar" };

export default async function EntrarPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  // Sem Supabase não existe login: o painel roda em modo demonstração.
  if (!isSupabaseConfigured()) redirect("/dashboard");
  const { next } = await searchParams;
  const target = safeNextPath(Array.isArray(next) ? next[0] : next);

  return (
    <div className="grid min-h-[calc(100dvh-48px)] place-items-center px-1 py-8">
      <section aria-labelledby="entrar-titulo" className="facade w-full max-w-[400px] p-6 sm:p-7">
        <div className="flex items-center gap-2.5">
          <span className="tile grid size-11 place-items-center rounded-2xl">
            <LogoMark />
          </span>
          <span className="text-[17px] font-extrabold tracking-[-0.02em] text-ink">Sellora</span>
        </div>
        <h1 id="entrar-titulo" className="mt-6 text-[22px] font-bold tracking-[-0.01em] text-ink">
          Entrar no painel
        </h1>
        <p className="mt-1 mb-6 text-[13.5px] text-ink-soft">Acesso restrito ao administrador. Os dados ficam no banco protegido por login.</p>
        <LoginForm next={target} />
        <p className="mt-5 text-[12px] text-ink-faint">Não há cadastro público. Contas são criadas pelo administrador no painel do Supabase.</p>
      </section>
    </div>
  );
}
