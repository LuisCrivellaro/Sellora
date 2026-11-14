"use client";

import { Button } from "@/components/ui/button";
import { canGenerateDemos, cancelDemoGeneration, enqueueDemoGeneration, pauseDemoGeneration, resumeDemoGeneration, refreshDemoGenerator, useDemoGenerator } from "@/lib/demos/generation-client";
import type { DemoTextProvider, StoredImageProvider } from "@/lib/demos/creation";

export const textProviderLabel: Record<DemoTextProvider, string> = { codex: "Codex", claude: "Claude" };
/** "gemini" só aparece em demos antigas (integração removida em 2026-11-12). */
export const imageProviderLabel: Record<StoredImageProvider, string> = { codex: "Codex", gemini: "Gemini (removido)" };

export function DemoGeneratorStatus({ leadId }: { leadId?: string }) {
  const generator = useDemoGenerator();
  const ready = canGenerateDemos(generator);
  const items = generator.items.filter((item) => !leadId || item.leadId === leadId);
  const active = items.filter((item) => item.status === "queued" || item.status === "running");
  const running = active.find((item) => item.status === "running");
  const failed = items.filter((item) => item.status === "failed");
  const paused = items.filter((item) => item.status === "paused");
  const connection = generator.connection;
  const pausing = items.some((item) => generator.pausingIds.includes(item.id));
  const scope = leadId ? [leadId] : undefined;
  const status = pausing ? "Pausando após a etapa atual" : active.length ? "Gerando" : paused.length ? "Pausado" : items.some((item) => item.status === "completed") ? "Concluído" : items.some((item) => item.status === "cancelled") ? "Cancelado" : null;
  // V6: Claude (conta das demos) escreve textos, design e código; Codex só gera a imagem (sem ele, composição SVG gratuita).
  const messages = connection ? [
    connection.claude ?? { available: false, message: "Conta Claude das demos não verificada." },
    { available: connection.available, message: connection.available ? connection.message : `Imagens: ${connection.message} Sem o Codex, a demo sai com composição gráfica e fica pendente de revisão.` },
  ] : [];
  const profile = connection?.claude?.profile === "dedicated" ? "conta dedicada às demos" : connection?.claude?.profile === "default" ? "perfil padrão do Claude Code" : null;
  return <div className="mb-3 space-y-2 rounded-xl border border-seam p-3 text-[12px] leading-relaxed text-ink-soft">
    {status && <p role="status" className="font-semibold">{status}</p>}
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span><span className="font-semibold">Textos, design e código</span> · Claude{profile ? ` (${profile})` : ""}</span>
      <span><span className="font-semibold">Imagens</span> · Codex da sua conta ChatGPT; sem ele, composição gráfica gratuita</span>
    </div>
    {!connection && <p>Verificando conexões do gerador…</p>}
    {messages.map((item) => <p key={item.message} className={item.available ? undefined : "text-warn"}>{item.message}</p>)}
    {connection?.claude?.setup && <p className="rounded-lg border border-seam p-2 font-mono text-[11px] leading-relaxed break-words">{connection.claude.setup}</p>}
    {connection && !ready && <Button size="sm" variant="secondary" onClick={() => void refreshDemoGenerator()}>Verificar conexão</Button>}
    {active.length > 0 && <p role="status">{running?.phase ?? "Na fila de geração"}{running ? " · textos e código: Claude · imagem: Codex" : ""} · {active.length} pendente(s)</p>}
    {(active.length > 0 || pausing || paused.some((item) => item.error)) && <Button size="sm" variant="secondary" disabled={pausing} onClick={() => void pauseDemoGeneration(scope)}>{pausing ? "Pausando…" : "Pausar geração"}</Button>}
    {paused.length > 0 && <Button size="sm" variant="secondary" disabled={!ready || pausing || paused.some((item) => !!item.error)} onClick={() => resumeDemoGeneration(scope)}>Retomar geração</Button>}
    {(active.length > 0 || paused.length > 0) && <Button size="sm" variant="ghost" disabled={pausing} onClick={() => void cancelDemoGeneration(scope)}>Cancelar geração</Button>}
    {paused.some((item) => item.error) && <p role="alert" className="text-warn">{paused.find((item) => item.error)?.error}</p>}
    {paused.length > 0 && !pausing && <p>{paused.length} geração(ões) pausada(s). Use Retomar geração para continuar.</p>}
    {failed.length > 0 && <div role="status"><p className="text-warn">{failed.length} geração(ões) pendente(s). {failed[0].error}{failed.some((item) => item.recoverable) ? " Tentar novamente retoma das etapas salvas, sem refazer o que já foi feito." : ""}</p><Button size="sm" className="mt-2" variant="secondary" disabled={!ready} onClick={() => enqueueDemoGeneration(failed.map((item) => item.leadId))}>Tentar novamente</Button></div>}
  </div>;
}
