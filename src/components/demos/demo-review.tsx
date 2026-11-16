"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useStore } from "@/lib/data/store";
import { removeDemoAdjustment, requestDemoChanges } from "@/lib/data/repository";
import { X } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/overlay";
import { segmentMeta } from "@/lib/constants";
import type { Lead } from "@/lib/types";
import { DemoCanvas } from "./demo-canvas";
import { LeadDemoPanel } from "./lead-demo-panel";
import { OutreachPanel } from "@/components/outreach/outreach-panel";
import { canGenerateDemos, enqueueDemoGeneration, useDemoGenerator } from "@/lib/demos/generation-client";

export function DemoReview({ lead, onClose, onOpenLead }: { lead: Lead | null; onClose: () => void; onOpenLead: (id: string) => void }) {
  const generator = useDemoGenerator();
  return <Modal open={!!lead} onOpenChange={(o) => !o && onClose()} variant="workspace" title={lead ? `Revisar ${lead.name}` : "Revisar demo"} description={lead ? `${segmentMeta[lead.segment].label} · ${lead.city}/${lead.uf} · confira a demo e prepare o contato` : undefined}>
    {lead?.demo && <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <DemoCanvas demo={lead.demo} onEscape={onClose} onGenerate={lead.demo.status === "rejected" ? undefined : () => enqueueDemoGeneration([lead.id])} generateDisabled={!canGenerateDemos(generator) || generator.items.some((item) => item.leadId === lead.id && (item.status === "queued" || item.status === "running"))} />
      <div className="min-w-0">
        <DemoChangeRequest key={lead.id} lead={lead} />
        {lead.stage !== "ganho" && <div className="mb-3"><OutreachPanel key={lead.id} lead={lead} /></div>}
        <LeadDemoPanel key={`${lead.id}:${lead.demo.updatedAt}`} lead={lead} embedded />
        <Button size="sm" variant="ghost" className="mt-3" onClick={() => { onClose(); onOpenLead(lead.id); }}>Ver ficha completa no CRM</Button>
      </div>
    </div>}
  </Modal>;
}

function DemoChangeRequest({ lead }: { lead: Lead }) {
  const [feedback, setFeedback] = useState("");
  const { notify } = useToast();
  const { mode, sync, storageError, db } = useStore();
  const blocked = mode === "supabase" ? sync.pending > 0 || !!sync.error : !!storageError;
  const latest = db?.activities.find((item) => item.leadId === lead.id && item.description.startsWith("Ajuste da demo:"));
  const pending = lead.demo?.adjustments ?? [];
  const applied = lead.demo?.appliedAdjustments ?? [];
  return <form className="mb-4 rounded-2xl border border-seam p-4" onSubmit={(event) => {
    event.preventDefault();
    try {
      requestDemoChanges(lead.id, feedback);
      setFeedback("");
      notify({ kind: "success", title: "Pedido de ajuste registrado", description: "Será aplicado quando você gerar a nova versão. Nenhuma execução de IA foi iniciada agora." });
    } catch (error) { notify({ kind: "error", title: error instanceof Error ? error.message : "Não foi possível salvar." }); }
  }}>
    <label htmlFor="demo-feedback" className="text-sm font-semibold text-ink">Pedir ajustes</label>
    <textarea id="demo-feedback" className="mt-2 w-full rounded-lg border border-seam bg-transparent p-3 text-sm text-ink" rows={3} maxLength={480} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Ex.: aumentar o título no celular" />
    <p className="mb-3 text-xs text-ink-faint">O gerador lê os pedidos pendentes antes de criar a próxima versão e os aplica como prioridade. Registrar não inicia a IA: depois, clique em gerar a nova versão.</p>
    <Button type="submit" size="sm" disabled={blocked || feedback.trim().length < 3 || lead.demo?.status === "rejected"}>Registrar pedido de ajuste</Button>
    {pending.length > 0 && <div className="mt-3 text-xs" role="status">
      <p className="font-semibold text-warn">{pending.length === 1 ? "1 ajuste pendente para a próxima versão" : `${pending.length} ajustes pendentes para a próxima versão`}</p>
      <ul className="mt-1 flex flex-col gap-1">{pending.map((item) => <li key={item.id} className="flex items-start gap-2 text-ink-soft">
        <span className="min-w-0 flex-1 break-words">• {item.text}</span>
        <button type="button" className="shrink-0 rounded p-0.5 text-ink-faint hover:text-ink focus-visible:outline-2" disabled={blocked} aria-label={`Remover pedido: ${item.text}`} onClick={() => { try { removeDemoAdjustment(lead.id, item.id); } catch (error) { notify({ kind: "error", title: error instanceof Error ? error.message : "Não foi possível remover." }); } }}><X aria-hidden className="size-3.5" /></button>
      </li>)}</ul>
    </div>}
    {!pending.length && applied.length > 0 && <div className="mt-3 text-xs text-ink-soft">
      <p className="font-semibold text-mint">Esta versão foi gerada com {applied.length === 1 ? "o ajuste" : `os ${applied.length} ajustes`}:</p>
      <ul className="mt-1 flex flex-col gap-1">{applied.map((item) => <li key={item.id} className="break-words">• {item.text}</li>)}</ul>
    </div>}
    {!pending.length && !applied.length && latest && <p className="mt-3 text-xs text-ink-soft">Último pedido: {latest.description.slice("Ajuste da demo:".length)}</p>}
  </form>;
}
