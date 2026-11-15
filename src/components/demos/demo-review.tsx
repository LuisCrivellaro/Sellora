"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useStore } from "@/lib/data/store";
import { requestDemoChanges } from "@/lib/data/repository";
import { useToast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/overlay";
import { segmentMeta } from "@/lib/constants";
import type { Lead } from "@/lib/types";
import { DemoCanvas } from "./demo-canvas";
import { LeadDemoPanel } from "./lead-demo-panel";
import { canGenerateDemos, enqueueDemoGeneration, useDemoGenerator } from "@/lib/demos/generation-client";

export function DemoReview({ lead, onClose, onOpenLead }: { lead: Lead | null; onClose: () => void; onOpenLead: (id: string) => void }) {
  const generator = useDemoGenerator();
  return <Modal open={!!lead} onOpenChange={(o) => !o && onClose()} variant="workspace" title={lead ? `Revisar ${lead.name}` : "Revisar demo"} description={lead ? `${segmentMeta[lead.segment].label} · ${lead.city}/${lead.uf} · confira a demo e prepare o contato` : undefined}>
    {lead?.demo && <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <DemoCanvas demo={lead.demo} onEscape={onClose} onGenerate={lead.demo.status === "rejected" ? undefined : () => enqueueDemoGeneration([lead.id])} generateDisabled={!canGenerateDemos(generator) || generator.items.some((item) => item.leadId === lead.id && (item.status === "queued" || item.status === "running"))} />
      <div className="min-w-0">
        <DemoChangeRequest key={lead.id} lead={lead} />
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
  return <form className="mb-4 rounded-2xl border border-seam p-4" onSubmit={(event) => {
    event.preventDefault();
    try {
      requestDemoChanges(lead.id, feedback);
      setFeedback("");
      notify({ kind: "success", title: "Pedido de ajuste registrado", description: "A demo voltou para revisão. Nenhuma execução de IA foi iniciada." });
    } catch (error) { notify({ kind: "error", title: error instanceof Error ? error.message : "Não foi possível salvar." }); }
  }}>
    <label htmlFor="demo-feedback" className="text-sm font-semibold text-ink">Pedir ajustes</label>
    <textarea id="demo-feedback" className="mt-2 w-full rounded-lg border border-seam bg-transparent p-3 text-sm text-ink" rows={3} maxLength={480} value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Ex.: aumentar o título no celular" />
    <p className="mb-3 text-xs text-ink-faint">Salva o pedido no CRM para execução posterior. Não corrige automaticamente.</p>
    <Button type="submit" size="sm" disabled={blocked || feedback.trim().length < 3 || lead.demo?.status === "rejected"}>Registrar pedido de ajuste</Button>
    {latest && <p className="mt-3 text-xs text-ink-soft">Último pedido: {latest.description.slice("Ajuste da demo:".length)}</p>}
  </form>;
}
