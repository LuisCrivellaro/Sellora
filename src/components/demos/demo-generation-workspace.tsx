"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/data/store";
import { canGenerateDemos, cancelDemoGeneration, enqueueDemoGeneration, pauseDemoGeneration, retryDemoPreparation, useDemoGenerator } from "@/lib/demos/generation-client";
import { sendPreparationState } from "@/lib/demos/send-preparation";
import { matchesQuery } from "@/lib/utils";
import { DemoGeneratorStatus } from "./demo-generator-status";

const labels = { queued: "Na fila", running: "Gerando", paused: "Aguardando / pausada", cancelled: "Cancelada", failed: "Falhou", completed: "Concluída" };

export function DemoGenerationWorkspace({ onReview }: { onReview: (id: string) => void }) {
  const { db, mode, sync, storageError } = useStore();
  const { notify } = useToast();
  const generator = useDemoGenerator();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const blocked = mode === "supabase" ? sync.pending > 0 || !!sync.error : !!storageError;
  const leads = db?.leads.filter((lead) => !["ganho", "perdido"].includes(lead.stage) && lead.demo?.status !== "rejected" && matchesQuery(query, lead.name, lead.city)) ?? [];
  const selectedIds = selected.filter((id) => leads.some((lead) => lead.id === id));
  return <DashboardCard index={0} className="col-span-12" title="Agente Gerador de Demos" description="Fila própria de sites personalizados. A Prospecção pode continuar em paralelo.">
    <DemoGeneratorStatus />
    <details className="mb-4 rounded-xl border border-seam p-3" open={!generator.items.length}>
      <summary className="cursor-pointer text-sm font-semibold text-ink">Selecionar leads do CRM</summary>
      <div className="my-3 flex flex-wrap items-center gap-3">
        <SearchInput label="Buscar leads para demos" value={query} onChange={setQuery} placeholder="Nome ou cidade" className="w-full sm:w-72" />
        <Button size="sm" disabled={blocked || !selectedIds.length} onClick={() => {
          enqueueDemoGeneration(selectedIds, { start: false });
          setSelected([]);
          notify({ kind: "success", title: "Leads na fila de demos", description: "Use Iniciar para começar. Nenhuma demo existente foi apagada." });
        }}>Adicionar à fila ({selectedIds.length})</Button>
        <Button size="sm" variant="secondary" disabled={blocked || !selectedIds.length || !canGenerateDemos(generator)} onClick={() => {
          enqueueDemoGeneration(selectedIds, { prepareForSend: true });
          setSelected([]);
          notify({ kind: "success", title: "Preparação automática iniciada", description: "Gerar → revisar → publicar no Coolify configurado → preparar mensagem. O envio é manual." });
        }}>Gerar e preparar envio ({selectedIds.length})</Button>
      </div>
      <ul aria-label="Leads disponíveis para demos" className="grid max-h-60 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">{leads.map((lead) => <li key={lead.id}><label className="flex items-start gap-2 rounded-lg border border-seam p-2 text-xs text-ink-soft"><input type="checkbox" checked={selected.includes(lead.id)} onChange={(event) => setSelected((ids) => event.target.checked ? [...ids, lead.id] : ids.filter((id) => id !== lead.id))} /><span>{lead.name}<span className="block text-ink-faint">{lead.city} · {lead.demo ? "Já tem demo; será preservada até concluir a nova" : "Sem demo"}</span></span></label></li>)}</ul>
      {!leads.length && <p className="text-sm text-ink-faint">Nenhum lead disponível neste filtro.</p>}
      <p className="mt-3 text-xs text-ink-faint">Padrão manual: adicionar não inicia IA. Os sites passam pelos critérios de diversidade e revisão do gerador V6.</p>
      <p className="mt-2 text-xs text-ink-faint">Opcional: “Gerar e preparar envio” usa IA, revisa e publica após passar no QA, se o Coolify estiver configurado. Nenhuma mensagem é enviada. Mantenha o Sellora aberto; ao reabrir, use Retomar. Pausar ou cancelar preserva a demo; uma publicação já iniciada no Coolify pode terminar.</p>
    </details>
    <ul aria-label="Fila de geração de demos" className="space-y-2">{generator.items.map((item) => {
      const lead = db?.leads.find((lead) => lead.id === item.leadId);
      const pausing = generator.pausingIds.includes(item.id);
      return <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-seam p-3">
        <div className="min-w-0 basis-full sm:basis-0 sm:flex-1"><h3 className="text-sm font-semibold text-ink">{lead?.name ?? "Lead removido"}</h3><p className="text-xs text-ink-soft">{labels[item.status]} · {item.phase}</p>{item.prepareForSend && <p className="mt-1 text-xs text-ink-soft">Preparação automática{item.status === "completed" && lead?.demo ? ` · ${sendPreparationState(lead.demo, lead.phone)}` : " · envio manual"}</p>}{item.error && <p role="alert" className="text-xs text-warn">{item.error}</p>}</div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto">
          {["paused", "failed", "cancelled"].includes(item.status) && !item.preparationRevision && <Button size="sm" variant="secondary" disabled={blocked || !lead || pausing || !canGenerateDemos(generator)} onClick={() => enqueueDemoGeneration([item.leadId])}>{item.status === "paused" ? "Iniciar / retomar" : "Tentar novamente"}</Button>}
          {item.preparationRevision && item.status === "paused" && <Button size="sm" variant="secondary" disabled={blocked || pausing} onClick={() => enqueueDemoGeneration([item.leadId])}>Retomar preparação</Button>}
          {item.preparationRevision && ["completed", "failed", "cancelled"].includes(item.status) && item.preparationStatus !== "ready" && <Button size="sm" variant="secondary" disabled={blocked || pausing || !lead} onClick={() => retryDemoPreparation(item.leadId)}>Tentar preparar envio</Button>}
          {lead?.demo && <Button size="sm" variant="ghost" onClick={() => onReview(lead.id)}>Abrir demo e mensagem</Button>}
          {["running", "queued"].includes(item.status) && <Button size="sm" variant="secondary" disabled={pausing} onClick={() => void pauseDemoGeneration([item.leadId])}>Pausar</Button>}
          {["running", "queued", "paused"].includes(item.status) && <Button size="sm" variant="ghost" disabled={pausing} onClick={() => void cancelDemoGeneration([item.leadId])}>Cancelar esta demo</Button>}
        </div>
      </li>;
    })}</ul>
    {!generator.items.length && <p className="text-sm text-ink-faint">Fila vazia. Selecione leads acima ou envie os resultados da Prospecção.</p>}
  </DashboardCard>;
}
