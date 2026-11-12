"use client";

import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { canGenerateDemos, enqueueDemoGeneration, refreshDemoGenerator, setDemoImageProvider, setDemoTextProvider, useDemoGenerator } from "@/lib/demos/generation-client";
import type { DemoImageProvider, DemoTextProvider } from "@/lib/demos/creation";

export const textProviderLabel: Record<DemoTextProvider, string> = { codex: "Codex", claude: "Claude" };
export const imageProviderLabel: Record<DemoImageProvider, string> = { codex: "Codex", gemini: "Gemini" };

export function DemoGeneratorStatus({ leadId }: { leadId?: string }) {
  const generator = useDemoGenerator();
  const ready = canGenerateDemos(generator);
  const items = generator.items.filter((item) => !leadId || item.leadId === leadId);
  const active = items.filter((item) => item.status === "queued" || item.status === "running");
  const running = active.find((item) => item.status === "running");
  const failed = items.filter((item) => item.status === "failed");
  const paused = items.filter((item) => item.status === "paused");
  const connection = generator.connection;
  const usesCodex = generator.textProvider === "codex" || generator.imageProvider === "codex";
  const messages = connection ? [
    generator.textProvider === "claude" && connection.claude,
    generator.imageProvider === "gemini" && connection.gemini,
    usesCodex && { available: connection.available, message: connection.message },
  ].filter((item): item is { available: boolean; message: string } => !!item) : [];
  return <div className="mb-3 space-y-2 rounded-xl border border-seam p-3 text-[12px] leading-relaxed text-ink-soft">
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="inline-flex items-center gap-2"><span className="font-semibold">Textos</span>
        <Segmented<DemoTextProvider> label="Quem escreve os textos da demo" value={generator.textProvider} onChange={setDemoTextProvider}
          options={[{ value: "claude", label: "Claude" }, { value: "codex", label: "Codex" }]} /></span>
      <span className="inline-flex items-center gap-2"><span className="font-semibold">Imagem</span>
        <Segmented<DemoImageProvider> label="Quem gera a imagem da demo" value={generator.imageProvider} onChange={setDemoImageProvider}
          options={[{ value: "gemini", label: "Gemini" }, { value: "codex", label: "Codex" }]} /></span>
    </div>
    {!connection && <p>Verificando conexões do gerador…</p>}
    {messages.map((item) => <p key={item.message} className={item.available ? undefined : "text-warn"}>{item.message}</p>)}
    {connection && !ready && <Button size="sm" variant="secondary" onClick={() => void refreshDemoGenerator()}>Verificar conexão</Button>}
    {active.length > 0 && <p role="status">{running?.phase ?? "Na fila de geração"}{running ? ` · textos: ${textProviderLabel[running.textProvider ?? "claude"]} · imagem: ${imageProviderLabel[running.imageProvider ?? "gemini"]}` : ""} · {active.length} pendente(s)</p>}
    {paused.length > 0 && <p role="status">{paused.length} geração(ões) anterior(es) pausada(s). Revise os leads e use o botão de geração para os que deseja continuar.</p>}
    {failed.length > 0 && <div role="status"><p className="text-warn">{failed.length} geração(ões) pendente(s). {failed[0].error}</p><Button size="sm" className="mt-2" variant="secondary" disabled={!ready} onClick={() => enqueueDemoGeneration(failed.map((item) => item.leadId))}>Tentar novamente</Button></div>}
  </div>;
}
