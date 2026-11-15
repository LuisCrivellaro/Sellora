"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DemoReview } from "@/components/demos/demo-review";
import { useStore } from "@/lib/data/store";
import type { AgentRecord } from "@/lib/agents/bridge";

const statusLabel: Record<string, string> = { idle: "Disponível", running: "Trabalhando", queued: "Na fila", paused: "Pausado", waiting_approval: "Aguardando revisão", completed: "Concluído", failed: "Falhou", cancelled: "Cancelado", offline: "Desconectado" };
const agentAreas = {
  prospeccao: { href: "/leads?aba=prospeccao", label: "Abrir Prospecção" },
  "gerador-de-demos": { href: "/leads?aba=demos", label: "Abrir Geração de Demos" },
  "coolify-deploy": { href: "/leads?aba=demos", label: "Abrir Publicação de Demos" },
  "revisor-de-demos": { href: "/leads?aba=demos", label: "Abrir Revisão de Demos" },
};

/** A cena permanece intacta; a revisão usa os dados e controles reais do CRM. */
export function OfficeDeliveries() {
  const { db } = useStore();
  const router = useRouter();
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const leads = db?.leads.filter((lead) => lead.demo).sort((a, b) => (b.demo?.updatedAt ?? "").localeCompare(a.demo?.updatedAt ?? "")) ?? [];
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/agents/agents", { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) { setAgents(data.agents); setError(false); }
      } catch { if (!controller.signal.aborted) setError(true); }
    }
    void load();
    const timer = setInterval(() => void load(), 10_000);
    return () => { controller.abort(); clearInterval(timer); };
  }, []);
  return <section aria-label="Entregas dos agentes" className="rounded-xl border border-seam p-4">
    <h2 className="font-semibold text-ink">Ver, testar e aprovar</h2>
    <p className="mt-1 text-xs text-ink-faint">Acompanhe os agentes e abra uma entrega para testar em computador ou celular.</p>
    {error && <p role="status" className="mt-2 text-xs text-warn">Não foi possível atualizar os agentes. Tentaremos novamente; as demos continuam disponíveis abaixo.</p>}
    <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{agents.map((agent) => {
      const run = agent.currentRun ?? agent.lastRun;
      const lead = leads.find((item) => item.id === run?.leadId);
      const area = agentAreas[agent.id];
      return <article key={agent.id} aria-label={agent.name} className="min-w-0 rounded-lg border border-seam p-3 break-words">
        <h3 className="text-sm font-semibold text-ink">{agent.name}</h3>
        <p className="mt-1 text-xs text-ink-faint">{agent.role}</p>
        <p className={`mt-2 text-xs ${agent.status === "failed" || agent.status === "offline" ? "text-warn" : "text-mint"}`}>{statusLabel[agent.status] ?? agent.status}</p>
        <p className="my-2 text-xs text-ink-soft">{run ? `${run.business} · ${run.task}` : "Sem execução registrada."}</p>
        {run?.review && run.review.issues.length > 0 && <ul aria-label="Pendências de QA" className="mb-3 list-disc pl-4 text-xs text-warn">{run.review.issues.slice(0, 4).map((issue, index) => <li key={index}>{issue}</li>)}</ul>}
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => router.push(area.href)}>{area.label}</Button>
          {lead && <Button size="sm" variant="ghost" onClick={() => setSelected(lead.id)}>Ver entrega</Button>}
        </div>
      </article>;
    })}</div>
    <div className="mt-4 flex flex-wrap gap-2">{leads.map((lead) => <Button key={lead.id} size="sm" variant="secondary" onClick={() => setSelected(lead.id)}>{lead.name} · {lead.demo?.status === "approved" ? "Aprovada" : lead.demo?.status === "rejected" ? "Recusada" : "Revisar"}</Button>)}</div>
    {!leads.length && <p className="mt-3 text-sm text-ink-soft">Nenhuma demo disponível. Gere uma em Leads → Demos; ela aparecerá aqui para revisão.</p>}
    <DemoReview lead={leads.find((lead) => lead.id === selected) ?? null} onClose={() => setSelected(null)} onOpenLead={(id) => router.push(`/leads?id=${encodeURIComponent(id)}`)} />
  </section>;
}
