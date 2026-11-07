"use client";

import { MotionConfig, motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/overlay";
import { ToastProvider } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { ErrorState, PageSkeleton } from "@/components/ui/states";
import { reloadFromServer, useStore } from "@/lib/data/store";
import { motionTokens, useMotionEnabled } from "@/lib/motion";
import { GlobalSearch } from "./global-search";
import { MobileNav, NotificationsButton, SearchButton, SettingsShortcut, UserMenu } from "./header-actions";
import { Logo } from "./logo";
import { SyncStatus } from "./sync-status";
import { TopNavigation } from "./top-navigation";

function MotionSync() {
  const { db } = useStore();
  const pref = db?.settings.appearance.motion ?? "system";
  const density = db?.settings.appearance.density ?? "confortavel";
  useEffect(() => {
    const html = document.documentElement;
    if (pref === "system") delete html.dataset.motion;
    else html.dataset.motion = pref;
    html.dataset.density = density;
  }, [pref, density]);
  return null;
}

/** Páginas sem navegação nem dados (login). Não toca no store. */
const BARE_ROUTES = ["/entrar"];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (BARE_ROUTES.includes(pathname)) {
    return (
      <TooltipProvider>
        <ToastProvider>
          <main id="conteudo" className="mx-auto w-full max-w-[1600px] px-3 pt-3 pb-6 sm:px-5 sm:pt-5">
            {children}
          </main>
        </ToastProvider>
      </TooltipProvider>
    );
  }
  return <PanelShell>{children}</PanelShell>;
}

function PanelShell({ children }: { children: ReactNode }) {
  const { db, storageError, status, loadError, mode } = useStore();
  const pathname = usePathname();
  const enabled = useMotionEnabled();
  const [searchOpen, setSearchOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const first = useRef(true);
  const pref = db?.settings.appearance.motion ?? "system";

  // Leva o foco ao conteúdo ao trocar de página (leitores de tela e teclado).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname]);

  const footer =
    mode === "supabase"
      ? "Dados gravados no banco Supabase, protegidos por login e RLS. Nenhuma outra integração conectada."
      : db?.demo
        ? "Modo demonstração: registros fictícios gravados apenas neste navegador. Sem login, sem integrações conectadas."
        : "Dados digitados gravados apenas neste navegador. Sem login, sem integrações conectadas.";

  return (
    <MotionConfig reducedMotion={pref === "reduced" ? "always" : pref === "full" ? "never" : "user"}>
      <TooltipProvider>
        <ToastProvider>
          <MotionSync />
          <a href="#conteudo" className="sr-only z-[100] rounded-full bg-violet px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
            Pular para o conteúdo
          </a>
          <div className="mx-auto flex min-h-dvh w-full max-w-[1600px] flex-col px-3 pt-3 pb-6 sm:px-5 sm:pt-5">
            <motion.header
              initial={enabled ? { opacity: 0, y: -8 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: motionTokens.ease }}
              className="relative z-40 flex items-center gap-2.5 sm:gap-3"
            >
              <Logo />
              <TopNavigation />
              <div className="flex-1 md:hidden" />
              <SearchButton onOpen={() => setSearchOpen(true)} />
              <div className="pill-group flex items-center gap-0.5 p-0.5">
                <NotificationsButton />
                <span className="hidden sm:contents">
                  <SettingsShortcut />
                </span>
              </div>
              <UserMenu />
              <MobileNav />
            </motion.header>

            {db?.demo && (
              <p className="mt-3 text-[12px] text-ink-faint xl:hidden">
                Dados fictícios, salvos só neste navegador.
              </p>
            )}
            {storageError && (
              <p role="alert" className="mt-3 rounded-2xl border border-[rgba(217,103,123,0.4)] bg-[rgba(217,103,123,0.08)] px-4 py-2.5 text-[13px] text-ink">
                {storageError}
              </p>
            )}
            <SyncStatus />

            <main ref={mainRef} id="conteudo" tabIndex={-1} className="mt-4 flex-1 outline-none sm:mt-5">
              {mode === "supabase" && status === "loading" && !db ? (
                <PageSkeleton />
              ) : status === "error" ? (
                <div className="facade">
                  <ErrorState
                    title="Não foi possível carregar os dados"
                    description={`${loadError ?? "Erro desconhecido."} Nada foi alterado no banco.`}
                    action={
                      <Button variant="primary" onClick={reloadFromServer}>
                        Tentar novamente
                      </Button>
                    }
                  />
                </div>
              ) : (
                <motion.div
                  key={pathname}
                  initial={enabled ? { opacity: 0, y: 6 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: motionTokens.ui, ease: motionTokens.ease }}
                >
                  {children}
                </motion.div>
              )}
            </main>

            <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-seam pt-4 text-[12px] text-ink-faint">
              <span>Sellora v0.1 · painel interno</span>
              <span>{footer}</span>
            </footer>
          </div>
          <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </ToastProvider>
      </TooltipProvider>
    </MotionConfig>
  );
}
