"use client";

import { ChevronDown, ExternalLink, Maximize2, Minimize2, RefreshCw, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AgentRecord, AgentRun, Claw3dSceneStatus } from "@/lib/agents/bridge";

const statusLabel: Record<string, { text: string; tone: string; dot: string }> = {
  running: { text: "Executando", tone: "text-mint", dot: "bg-mint" },
  idle: { text: "Disponível", tone: "text-ink-soft", dot: "bg-ink-faint" },
  waiting_approval: { text: "Concluída · aguardando sua aprovação", tone: "text-mint", dot: "bg-mint" },
  completed: { text: "Concluída", tone: "text-mint", dot: "bg-mint" },
  failed: { text: "Falhou", tone: "text-[#e3a1a1]", dot: "bg-[#e3a1a1]" },
  cancelled: { text: "Interrompida", tone: "text-warn", dot: "bg-warn" },
  queued: { text: "Na fila", tone: "text-ink-soft", dot: "bg-ink-faint" },
  offline: { text: "Desconectado", tone: "text-warn", dot: "bg-warn" },
};
const time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
const dateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";

/**
 * Aba Cloud 3D: o escritório do Claw3D ocupa a área toda (com tela cheia) e mostra os agentes reais pelo
 * Sellora Agent Bridge (/api/agents/*). Status e atalhos ficam numa faixa compacta; detalhes e histórico,
 * recolhidos abaixo. Somente observação: nada aqui inicia ou interrompe execuções.
 */
export function Cloud3dView() {
  const [agents, setAgents] = useState<AgentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [scene, setScene] = useState<Claw3dSceneStatus | null>(null);
  const [frameKey, setFrameKey] = useState(0);
  const loadScene = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/scene", { cache: "no-store" });
      if (response.ok) setScene(await response.json());
    } catch { setScene({ available: false, url: null, bridge: "unknown", message: "Não foi possível consultar o escritório 3D." }); }
  }, []);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/agents", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Ponte de agentes indisponível.");
      setAgents(body.agents); setError(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Ponte de agentes indisponível."); }
  }, []);
  useEffect(() => {
    const first = setTimeout(() => { void load(); void loadScene(); }, 0);
    const sceneTimer = setInterval(() => void loadScene(), 15_000);
    const source = new EventSource("/api/agents/events");
    source.addEventListener("open", () => setLive(true));
    source.addEventListener("error", () => setLive(false));
    source.addEventListener("agent", () => void load());
    return () => { clearTimeout(first); clearInterval(sceneTimer); source.close(); };
  }, [load, loadScene]);

  const reload = () => { void load(); void loadScene(); setFrameKey((key) => key + 1); };
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
    {error && <p role="alert" className="text-[13px] text-warn">{error}</p>}
    {agents?.map((agent) => <AgentStrip key={agent.id} agent={agent} />)}
    {!agents && !error && <p role="status" className="text-[13px] text-ink-soft">Carregando agentes…</p>}
    <OfficeScene scene={scene} frameKey={frameKey} />
    {agents?.map((agent) => <AgentDetails key={agent.id} agent={agent} />)}
  </div>;
}

function StatusPill({ ok, label, title }: { ok: boolean; label: string; title?: string }) {
  return <span title={title} className="inline-flex items-center gap-1.5 rounded-full border border-seam px-2.5 py-1 text-ink-soft">
    <span aria-hidden className={`size-1.5 rounded-full ${ok ? "bg-mint" : "bg-warn"}`} />{label}
  </span>;
}

/** Faixa compacta do agente: status, tarefa atual/última e atalhos. */
function AgentStrip({ agent }: { agent: AgentRecord }) {
  const run = agent.currentRun ?? agent.lastRun;
  const status = statusLabel[run?.status ?? agent.status] ?? statusLabel.idle;
  return <section aria-label={`${agent.name}: ${status.text}`} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-seam px-3.5 py-2.5 text-[12.5px]">
    <span className="inline-flex items-center gap-2 font-semibold text-ink">
      <span aria-hidden className={`size-2 rounded-full ${agent.currentRun ? "bg-mint animate-pulse motion-reduce:animate-none" : status.dot}`} />{agent.name}
    </span>
    <span role="status" className={`font-semibold ${status.tone}`}>{agent.currentRun ? "Executando" : status.text}</span>
    {run && <span className="min-w-0 flex-1 truncate text-ink-soft" title={`${run.business} · ${run.task}`}>
      <span className="text-ink">{run.business}</span> · {run.task}{run.updatedAt ? ` · ${time(run.updatedAt)}` : ""}
    </span>}
    {!run && <span className="flex-1 text-ink-soft">Nenhuma execução registrada neste computador.</span>}
    <span className="flex shrink-0 gap-1.5">
      {run?.siteId && <Button size="sm" variant="secondary" asChild><a href={`/sites/${run.siteId}/index.html`} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> Abrir demo</a></Button>}
      {run?.leadId && <Button size="sm" variant="ghost" asChild><Link href={`/leads?id=${run.leadId}`}><UserRound aria-hidden /> Abrir lead</Link></Button>}
      {agent.id === "prospeccao" && <Button size="sm" variant="secondary" asChild><Link href="/leads?aba=prospeccao"><Search aria-hidden /> Abrir Prospecção</Link></Button>}
    </span>
  </section>;
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
    return <div role="status" className="grid min-h-[26rem] place-items-center rounded-xl border border-dashed border-seam-strong p-6 text-center text-[13px] text-ink-soft">
      <p className="max-w-md">{scene ? scene.message : "Verificando o escritório 3D…"}</p>
    </div>;
  }
  return <div ref={frameRef} className="group relative overflow-hidden rounded-xl border border-seam-strong bg-black [&:fullscreen]:rounded-none [&:fullscreen]:border-0">
    <iframe key={frameKey} src={scene.url} title="Escritório 3D da Sellora (Claw3D) com os agentes reais" allow="fullscreen" allowFullScreen referrerPolicy="no-referrer"
      className="block h-[calc(100dvh-15rem)] min-h-[26rem] w-full [:fullscreen_&]:h-dvh" />
    <Button size="sm" variant="secondary" onClick={toggle} aria-pressed={fullscreen}
      // Centro inferior: os cantos já têm controles do Claw3D (Chat, console de eventos).
      className="absolute bottom-3 left-1/2 -translate-x-1/2 shadow-lg opacity-90 hover:opacity-100 focus-visible:opacity-100">
      {fullscreen ? <><Minimize2 aria-hidden /> Sair da tela cheia</> : <><Maximize2 aria-hidden /> Tela cheia</>}
    </Button>
  </div>;
}

/** Detalhes do agente e histórico, recolhidos por padrão para o escritório ter o espaço todo. */
function AgentDetails({ agent }: { agent: AgentRecord }) {
  const run = agent.currentRun ?? agent.lastRun;
  return <details className="group rounded-xl border border-seam text-[12.5px]">
    <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 font-semibold text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
      <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      Detalhes e histórico · {agent.name}
      <span className="font-normal text-ink-faint">({agent.recent.length} execuções recentes)</span>
    </summary>
    <div className="grid gap-5 border-t border-seam p-3.5 lg:grid-cols-2">
      <div>
        <p className="mb-2 text-ink-faint">{agent.role} · runtime: {agent.runtime}</p>
        {run ? <RunDetails run={run} current={!!agent.currentRun} /> : <p className="text-ink-soft">Nenhuma execução registrada neste computador.</p>}
      </div>
      <div>
        <p className="mb-2 font-semibold text-ink-soft">Histórico</p>
        <ul className="max-h-64 space-y-1.5 overflow-auto">
          {agent.recent.map((item) => {
            const status = statusLabel[item.status] ?? statusLabel.idle;
            return <li key={item.runId} className="flex gap-2">
              <span className="tnum shrink-0 text-ink-faint">{dateTime(item.updatedAt)}</span>
              <span className="min-w-0"><span className="text-ink">{item.business}</span> · <span className={status.tone}>{status.text}</span>{item.error ? ` · ${item.error}` : ""}</span>
            </li>;
          })}
        </ul>
      </div>
    </div>
  </details>;
}

function RunDetails({ run, current }: { run: AgentRun; current: boolean }) {
  const status = statusLabel[run.status] ?? statusLabel.idle;
  return <div className="grid gap-3">
    <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-y-1">
      <dt className="text-ink-faint">{current ? "Tarefa atual" : "Última tarefa"}</dt><dd className="text-ink">{run.task}</dd>
      <dt className="text-ink-faint">Estabelecimento</dt><dd className="text-ink">{run.business}</dd>
      <dt className="text-ink-faint">Status</dt><dd className={status.tone}>{status.text}</dd>
      <dt className="text-ink-faint">Início</dt><dd>{dateTime(run.startedAt)}</dd>
      <dt className="text-ink-faint">Última atualização</dt><dd>{dateTime(run.updatedAt)}</dd>
      <dt className="text-ink-faint">Execução</dt><dd className="font-mono text-[11.5px] break-all">{run.runId}</dd>
      {run.error && <><dt className="text-ink-faint">Erro</dt><dd className="text-[#e3a1a1]">{run.error}</dd></>}
    </dl>
    {run.events.length > 0 && <div>
      <p className="mb-1 font-semibold text-ink-soft">Etapas registradas</p>
      <ol className="max-h-48 space-y-1 overflow-auto text-ink-soft">{run.events.map((event) => <li key={event.at + event.phase}><span className="tnum text-ink-faint">{time(event.at)}</span> {event.phase}</li>)}</ol>
    </div>}
  </div>;
}
