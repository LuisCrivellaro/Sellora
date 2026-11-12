"use client";

import { ExternalLink, RefreshCw, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/card";
import type { AgentRecord, AgentRun } from "@/lib/agents/bridge";

const statusLabel: Record<string, { text: string; tone: string }> = {
  running: { text: "Executando", tone: "text-mint" }, idle: { text: "Disponível", tone: "text-ink-soft" },
  waiting_approval: { text: "Concluída · aguardando sua aprovação", tone: "text-mint" }, failed: { text: "Falhou", tone: "text-[#e3a1a1]" },
  cancelled: { text: "Interrompida", tone: "text-warn" }, queued: { text: "Na fila", tone: "text-ink-soft" }, offline: { text: "Desconectado", tone: "text-warn" },
};
const time = (iso: string | null) => iso ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "—";

/**
 * Aba Cloud 3D: observação dos agentes reais pelo Sellora Agent Bridge (/api/agents/*).
 * A cena 3D do Claw3D ainda não está conectada (docs/CLAW3D_INTEGRATION.md); nada aqui é simulado.
 */
export function Cloud3dView() {
  const [agents, setAgents] = useState<AgentRecord[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/agents/agents", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Ponte de agentes indisponível.");
      setAgents(body.agents); setError(null);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Ponte de agentes indisponível."); }
  }, []);
  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const source = new EventSource("/api/agents/events");
    source.addEventListener("open", () => setLive(true));
    source.addEventListener("error", () => setLive(false));
    source.addEventListener("agent", (event) => { const data = JSON.parse((event as MessageEvent).data); setLastEvent(`${time(data.at)} · ${data.business}: ${data.text}`); void load(); });
    return () => { clearTimeout(first); source.close(); };
  }, [load]);

  return <div className="grid grid-cols-12 gap-3.5">
    <DashboardCard index={0} className="col-span-12" title="Cloud 3D" description="Acompanhe os agentes de IA da Sellora com estados reais. Somente observação: nada aqui inicia ou interrompe execuções."
      actions={<Button size="sm" variant="secondary" onClick={() => void load()}><RefreshCw aria-hidden /> Atualizar conexão</Button>}>
      <div className="mb-4 rounded-xl border border-seam p-3 text-[12.5px] leading-relaxed text-ink-soft">
        <p><span className="font-semibold text-ink">Escritório 3D (Claw3D):</span> ainda não conectado. A ponte com dados reais já funciona e alimenta este painel; a cena 3D entra quando o provider da Sellora no Claw3D estiver pronto.</p>
        <p className="mt-1">Ponte Sellora: <span className={live ? "text-mint" : "text-warn"}>{live ? "eventos ao vivo conectados" : "eventos ao vivo desconectados"}</span>{lastEvent && <> · último evento: {lastEvent}</>}</p>
      </div>
      {error && <p role="alert" className="text-[13px] text-warn">{error}</p>}
      {!agents && !error && <p role="status" className="text-[13px] text-ink-soft">Carregando agentes…</p>}
      {agents?.map((agent) => <AgentPanel key={agent.id} agent={agent} />)}
    </DashboardCard>
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
  return <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
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
