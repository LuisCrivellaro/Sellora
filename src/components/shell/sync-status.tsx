"use client";

import { CloudUpload } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { discardPending, retrySync, useStore } from "@/lib/data/store";

/**
 * Situação das gravações no banco (modo Supabase).
 * - Salvando: aviso discreto e anunciado a leitores de tela.
 * - Falha: faixa com a mensagem e as ações de recuperação. A fila fica parada
 *   até o usuário escolher: nada é perdido nem descartado sem confirmação.
 */
export function SyncStatus() {
  const { mode, sync } = useStore();
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  if (mode !== "supabase") return null;

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {sync.pending > 0 && !sync.error ? "Salvando alterações no banco…" : ""}
      </p>
      {sync.pending > 0 && !sync.error && (
        <span
          aria-hidden
          className="pill-group fixed bottom-4 left-4 z-50 inline-flex items-center gap-2 px-3 py-1.5 text-[12px] font-semibold text-ink-soft"
        >
          <CloudUpload className="size-3.5 animate-pulse" aria-hidden /> Salvando…
        </span>
      )}
      {sync.error && (
        <div
          role="alert"
          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-[rgba(217,103,123,0.4)] bg-[rgba(217,103,123,0.08)] px-4 py-2.5 text-[13px] text-ink"
        >
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">Alterações não salvas ({sync.pending}).</strong> {sync.error}
          </span>
          <span className="flex flex-wrap gap-2">
            {sync.authExpired && (
              <Button asChild size="sm" variant="outline">
                <a href="/entrar" target="_blank" rel="noopener">
                  Entrar em nova aba
                </a>
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={retrySync}>
              Tentar novamente
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmDiscard(true)}>
              Descartar
            </Button>
          </span>
        </div>
      )}
      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Descartar alterações não salvas?"
        description={`${sync.pending} alteração(ões) ainda não chegaram ao banco. A tela volta ao último estado salvo. Não pode ser desfeito.`}
        confirmLabel="Descartar alterações"
        onConfirm={discardPending}
      />
    </>
  );
}
