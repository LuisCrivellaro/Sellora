"use client";

import { ExternalLink, RefreshCw, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/card";
import type { AgentRecord, AgentRun, Claw3dSceneStatus } from "@/lib/agents/bridge";

const statusLabel: Record<string, { text: string; tone: string }> = {
  running: { text: "Executando", tone: "text-mint" }, idle: { text: "Disponível", tone: "text-ink-soft" },
  waiting_approval: { text: "Concluída · aguardando sua aprovação", tone: "text-mint" }, failed: { text: "Falhou", tone: "text-[#e3a1a1]" },
  cancelled: { text: "Interrompida", tone: "text-warn" }, queued: { text: "Na fila", tone: "text-ink-soft" }, offline: { text: "Desconectado", tone: "text-warn" },
};
const time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

/**
 * Aba Cloud 3D: observação dos agentes reais pelo Sellora Agent Bridge (/api/agents/*).
 * A cena é o Claw3D local (integrations/claw3d) alimentado pelo mesmo bridge; nada aqui é simulado.
 */
export function Cloud3dView() {
  const [agents, setAgents] = useState<AgentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [scene, setScene] = useState<Claw3dSceneStatus | null>(null);
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
    source.addEventListener("agent", (event) => { const data = JSON.parse((event as MessageEvent).data); setLastEvent(`${time(data.at)} · ${data.business}: ${data.text}`); void load(); });
    return () => { clearTimeout(first); clearInterval(sceneTimer); source.close(); };
  }, [load, loadScene]);

  return <div className="grid grid-cols-12 gap-3.5">
    <DashboardCard index={0} className="col-span-12" title="Cloud 3D" description="Acompanhe os agentes de IA da Sellora com estados reais. Somente observação: nada aqui inicia ou interrompe execuções."
      actions={<Button size="sm" variant="secondary" onClick={() => { void load(); void loadScene(); }}><RefreshCw aria-hidden /> Atualizar conexão</Button>}>
      <div className="mb-4 rounded-xl border border-seam p-3 text-[12.5px] leading-relaxed text-ink-soft">
        <p><span className="font-semibold text-ink">Escritório 3D (Claw3D):</span>{" "}
          {!scene ? "verificando…" : <span className={scene.available && scene.bridge === "connected" ? "text-mint" : "text-warn"}>{scene.message}</span>}</p>
        <p className="mt-1">Ponte Sellora: <span className={live ? "text-mint" : "text-warn"}>{live ? "eventos ao vivo conectados" : "eventos ao vivo desconectados"}</span>{lastEvent && <> · último evento: {lastEvent}</>}</p>
      </div>
      <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <OfficeScene scene={scene} />
        <div className="min-w-0 space-y-3">
          {error && <p role="alert" className="text-[13px] text-warn">{error}</p>}
          {!agents && !error && <p role="status" className="text-[13px] text-ink-soft">Carregando agentes…</p>}
          {agents?.map((agent) => <AgentPanel key={agent.id} agent={agent} />)}
        </div>
      </div>
    </DashboardCard>
  </div>;
}

/** Cena do Claw3D em iframe (origem local separada). Sem cena, mostra o estado real em vez de um substituto. */
function OfficeScene({ scene }: { scene: Claw3dSceneStatus | null }) {
  if (!scene?.available || !scene.url) {
    return <div role="status" className="grid min-h-[22rem] place-items-center rounded-xl border border-dashed border-seam-strong p-6 text-center text-[13px] text-ink-soft">
      <p className="max-w-md">{scene ? scene.message : "Verificando o escritório 3D…"}</p>
    </div>;
  }
  return <div className="overflow-hidden rounded-xl border border-seam-strong bg-black">
    <iframe src={scene.url} title="Escritório 3D da Sellora (Claw3D) com os agentes reais" className="block h-[min(70vh,44rem)] min-h-[22rem] w-full" referrerPolicy="no-referrer" />
  </div>;
}

function AgentPanel({ agent }: { agent: AgentRecord }) {
  const status = statusLabel[agent.status] ?? statusLabel.idle;
  const run = agent.currentRun ?? agent.lastRun;
  return <section aria-label={agent.name} className="rounded-xl border border-seam-strong p-4">
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-[16px] font-semibold text-ink">{agent.name}</h2>
      <span role="status" className={`text-[12.5px] font-semibold ${status.tone}`}>{status.text}</span>
    </div>
    <p className="mt-1 text-[12.5px] text-ink-faint">{agent.role} · runtime: {agent.runtime}</p>
    {run ? <RunDetails run={run} current={!!agent.currentRun} /> : <p className="mt-3 text-[13px] text-ink-soft">Nenhuma execução registrada neste computador.</p>}
    {agent.recent.length > 1 && <details className="mt-3 text-[12.5px] text-ink-soft"><summary className="cursor-pointer font-semibold">Histórico resumido ({agent.recent.length})</summary>
      <ul className="mt-2 space-y-1">{agent.recent.map((item) => <li key={item.runId}>{time(item.updatedAt)} · {item.business} · {(statusLabel[item.status] ?? statusLabel.idle).text}{item.error ? ` · ${item.error}` : ""}</li>)}</ul></details>}
  </section>;
}

function RunDetails({ run, current }: { run: AgentRun; current: boolean }) {
  const status = statusLabel[run.status] ?? statusLabel.idle;
  return <div className="mt-3 grid gap-3">
    <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-y-1 text-[12.5px]">
      <dt className="text-ink-faint">{current ? "Tarefa atual" : "Última tarefa"}</dt><dd className="text-ink">{run.task}</dd>
      <dt className="text-ink-faint">Estabelecimento</dt><dd className="text-ink">{run.business}</dd>
      <dt className="text-ink-faint">Status</dt><dd className={status.tone}>{status.text}</dd>
      <dt className="text-ink-faint">Início</dt><dd>{time(run.startedAt)}</dd>
      <dt className="text-ink-faint">Última atualização</dt><dd>{time(run.updatedAt)}</dd>
      <dt className="text-ink-faint">Execução</dt><dd className="font-mono text-[11.5px] break-all">{run.runId}</dd>
      {run.error && <><dt className="text-ink-faint">Erro</dt><dd className="text-[#e3a1a1]">{run.error}</dd></>}
    </dl>
    <div>
      <p className="mb-1 text-[12px] font-semibold text-ink-soft">Etapas registradas</p>
      <ol className="max-h-56 space-y-1 overflow-auto text-[12px] text-ink-soft">{run.events.map((event) => <li key={event.at + event.phase}><span className="tnum text-ink-faint">{time(event.at)}</span> {event.phase}</li>)}</ol>
      <div className="mt-3 flex flex-wrap gap-2">
        {run.siteId && <Button size="sm" variant="secondary" asChild><a href={`/sites/${run.siteId}/index.html`} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> Abrir demo</a></Button>}
        {run.leadId && <Button size="sm" variant="ghost" asChild><Link href={`/leads?id=${run.leadId}`}><UserRound aria-hidden /> Abrir lead</Link></Button>}
      </div>
    </div>
  </div>;
}
