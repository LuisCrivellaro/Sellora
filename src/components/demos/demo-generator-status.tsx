"use client";

import { Button } from "@/components/ui/button";
import { enqueueDemoGeneration, refreshDemoGenerator, useDemoGenerator } from "@/lib/demos/generation-client";

export function DemoGeneratorStatus({ leadId }: { leadId?: string }) {
  const generator = useDemoGenerator();
  const items = generator.items.filter((item) => !leadId || item.leadId === leadId);
  const active = items.filter((item) => item.status === "queued" || item.status === "running");
  const failed = items.filter((item) => item.status === "failed");
  const paused = items.filter((item) => item.status === "paused");
  return <div className="mb-3 space-y-2 rounded-xl border border-seam p-3 text-[12px] leading-relaxed text-ink-soft">
    <p>{generator.connection?.message ?? "Verificando conexão com o Codex local…"}</p>
    {generator.connection && !generator.connection.available && <Button size="sm" variant="secondary" onClick={() => void refreshDemoGenerator()}>Verificar conexão</Button>}
    {active.length > 0 && <p role="status">{active.find((item) => item.status === "running")?.phase ?? "Na fila de geração"} · {active.length} pendente(s)</p>}
    {paused.length > 0 && <p role="status">{paused.length} geração(ões) anterior(es) pausada(s). Revise os leads e use o botão de geração para os que deseja continuar.</p>}
    {failed.length > 0 && <div role="status"><p className="text-warn">{failed.length} geração(ões) pendente(s). {failed[0].error}</p><Button size="sm" className="mt-2" variant="secondary" disabled={!generator.connection?.available} onClick={() => enqueueDemoGeneration(failed.map((item) => item.leadId))}>Tentar novamente</Button></div>}
  </div>;
}
