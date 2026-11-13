"use client";

import { Maximize2, Minimize2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Claw3dSceneStatus } from "@/lib/agents/bridge";

/**
 * Aba Cloud 3D: só o escritório do Claw3D, com título, estado da conexão e Recarregar. Os agentes, suas
 * etapas e o Kanban aparecem dentro do próprio escritório (eventos reais do Sellora Agent Bridge).
 * Somente observação: nada aqui inicia ou interrompe execuções.
 */
export function Cloud3dView() {
  const [live, setLive] = useState(false);
  const [scene, setScene] = useState<Claw3dSceneStatus | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const loadScene = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/scene", { cache: "no-store" });
      if (response.ok) setScene(await response.json());
    } catch { setScene({ available: false, url: null, bridge: "unknown", message: "Não foi possível consultar o escritório 3D." }); }
  }, []);
  useEffect(() => {
    const first = setTimeout(() => void loadScene(), 0);
    const sceneTimer = setInterval(() => void loadScene(), 15_000);
    // Só para o indicador "Eventos ao vivo": o escritório recebe os eventos pelo adaptador do Claw3D.
    const source = new EventSource("/api/agents/events");
    source.addEventListener("open", () => setLive(true));
    source.addEventListener("error", () => setLive(false));
    return () => { clearTimeout(first); clearInterval(sceneTimer); source.close(); };
  }, [loadScene]);

  const reload = () => { void loadScene(); setFrameKey((key) => key + 1); };
  const sceneOk = !!scene?.available && scene.bridge === "connected";

  return <div className="flex min-w-0 flex-col gap-3">
    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-[19px] font-semibold tracking-tight text-ink">Cloud 3D</h1>
        <p className="text-[12.5px] text-ink-faint">Agentes reais da Sellora no escritório 3D. Somente observação.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[12px]">
        <StatusPill ok={sceneOk} label={!scene ? "Escritório: verificando" : sceneOk ? "Escritório conectado" : scene.available ? "Escritório reconectando" : "Escritório desligado"} title={scene?.message} />
        <StatusPill ok={live} label={live ? "Eventos ao vivo" : "Eventos desconectados"} />
        <Button size="sm" variant="secondary" onClick={reload}><RefreshCw aria-hidden /> Recarregar</Button>
      </div>
    </header>
    <OfficeScene scene={scene} frameKey={frameKey} />
  </div>;
}

function StatusPill({ ok, label, title }: { ok: boolean; label: string; title?: string }) {
  return <span title={title} className="inline-flex items-center gap-1.5 rounded-full border border-seam px-2.5 py-1 text-ink-soft">
    <span aria-hidden className={`size-1.5 rounded-full ${ok ? "bg-mint" : "bg-warn"}`} />{label}
  </span>;
}

/** Escritório do Claw3D em iframe (origem local separada), com tela cheia. Sem cena, mostra o motivo real. */
function OfficeScene({ scene, frameKey }: { scene: Claw3dSceneStatus | null; frameKey: number }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === frameRef.current);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggle = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void frameRef.current?.requestFullscreen?.().catch(() => {});
  };
  if (!scene?.available || !scene.url) {
    return <div role="status" className="grid min-h-[calc(100dvh-12rem)] place-items-center rounded-xl border border-dashed border-seam-strong p-6 text-center text-[13px] text-ink-soft">
      <p className="max-w-md">{scene ? scene.message : "Verificando o escritório 3D…"}</p>
    </div>;
  }
  return <div ref={frameRef} className="group relative overflow-hidden rounded-xl border border-seam-strong bg-black [&:fullscreen]:rounded-none [&:fullscreen]:border-0">
    <iframe key={frameKey} src={scene.url} title="Escritório 3D da Sellora (Claw3D) com os agentes reais" allow="fullscreen" allowFullScreen referrerPolicy="no-referrer"
      className="block h-[calc(100dvh-12rem)] min-h-[26rem] w-full [:fullscreen_&]:h-dvh" />
    <Button size="sm" variant="secondary" onClick={toggle} aria-pressed={fullscreen}
      // Centro inferior: os cantos já têm controles do Claw3D (Chat, console de eventos).
      className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lg opacity-90 hover:opacity-100 focus-visible:opacity-100">
      {fullscreen ? <><Minimize2 aria-hidden /> Sair da tela cheia</> : <><Maximize2 aria-hidden /> Tela cheia</>}
    </Button>
  </div>;
}
