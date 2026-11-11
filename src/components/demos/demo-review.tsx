"use client";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { segmentMeta } from "@/lib/constants";
import type { Lead } from "@/lib/types";
import { DemoCanvas } from "./demo-canvas";
import { LeadDemoPanel } from "./lead-demo-panel";

export function DemoReview({ lead, onClose, onOpenLead }: { lead: Lead | null; onClose: () => void; onOpenLead: (id: string) => void }) {
  return <Modal open={!!lead} onOpenChange={(o) => !o && onClose()} variant="workspace" title={lead ? `Revisar ${lead.name}` : "Revisar demo"} description={lead ? `${segmentMeta[lead.segment].label} · ${lead.city}/${lead.uf} · confira a demo e prepare o contato` : undefined}>
    {lead?.demo && <div className="grid min-w-0 grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <DemoCanvas demo={lead.demo} onEscape={onClose} />
      <div className="min-w-0">
        <LeadDemoPanel key={`${lead.id}:${lead.demo.updatedAt}`} lead={lead} embedded />
        <Button size="sm" variant="ghost" className="mt-3" onClick={() => { onClose(); onOpenLead(lead.id); }}>Ver ficha completa no CRM</Button>
      </div>
    </div>}
  </Modal>;
}
