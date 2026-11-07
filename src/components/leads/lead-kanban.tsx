"use client";

import { ArrowRightLeft, CalendarClock } from "lucide-react";
import { useState } from "react";
import { SourceIcon } from "@/components/shared/source-icon";
import { TonePill } from "@/components/ui/badge";
import { Menu } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { LEAD_STAGES, leadStageMeta, priorityMeta, tone } from "@/lib/constants";
import { moveLeadStage } from "@/lib/data/repository";
import { formatRelative } from "@/lib/dates";
import type { Lead, LeadStage } from "@/lib/types";
import { cn, formatBRLCompact } from "@/lib/utils";

/**
 * Pipeline Kanban. Arrastar e soltar com mouse/toque; alternativa acessível
 * pelo menu "Mover para…" em cada cartão (teclado e leitor de tela).
 */
export function LeadKanban({ leads, onOpen }: { leads: Lead[]; onOpen: (l: Lead) => void }) {
  const { notify } = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<LeadStage | null>(null);

  const move = (lead: Lead, stage: LeadStage) => {
    if (lead.stage === stage) return;
    moveLeadStage(lead.id, stage);
    notify({ kind: "success", title: `${lead.name}`, description: `Movido para ${leadStageMeta[stage].label}` });
  };

  return (
    <div className="-mx-1 overflow-x-auto pb-2" role="region" aria-label="Pipeline em colunas por etapa" tabIndex={0}>
      <div className="flex min-w-max snap-x gap-3 px-1">
        {LEAD_STAGES.map((stage) => {
          const meta = leadStageMeta[stage];
          const items = leads.filter((l) => l.stage === stage);
          const total = items.reduce((s, l) => s + l.potentialValue, 0);
          return (
            <section
              key={stage}
              aria-label={`${meta.label}: ${items.length} leads`}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(stage);
              }}
              onDragLeave={() => setOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                const lead = leads.find((l) => l.id === (dragId ?? e.dataTransfer.getData("text/plain")));
                if (lead) move(lead, stage);
                setDragId(null);
                setOver(null);
              }}
              className={cn(
                "flex w-[256px] shrink-0 snap-start flex-col rounded-2xl border bg-white/[0.015] transition-colors",
                over === stage ? "border-seam-lit bg-violet/[0.06]" : "border-seam",
              )}
            >
              <header className="flex items-center justify-between gap-2 border-b border-seam px-3.5 py-3">
                <span className="flex items-center gap-2 text-[13px] font-semibold text-ink">
                  <span className="size-2 rounded-full" style={{ background: tone[meta.tone], boxShadow: `0 0 8px ${tone[meta.tone]}` }} aria-hidden />
                  {meta.label}
                  <span className="tnum rounded-full bg-white/[0.06] px-1.5 text-[11.5px] text-ink-soft">{items.length}</span>
                </span>
                <span className="tnum text-[11.5px] text-ink-faint">{formatBRLCompact(total)}</span>
              </header>
              <ul className="flex max-h-[560px] min-h-[120px] flex-col gap-2 overflow-y-auto p-2">
                {items.length === 0 && <li className="px-2 py-6 text-center text-[12px] text-ink-faint">Solte um lead aqui</li>}
                {items.map((lead) => (
                  <li
                    key={lead.id}
                    draggable
                    onDragStart={(e) => {
                      setDragId(lead.id);
                      e.dataTransfer.setData("text/plain", lead.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setOver(null);
                    }}
                    className={cn(
                      "group rounded-xl border border-seam bg-facade-raised/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[opacity,border-color,transform] duration-150 hover:border-seam-strong",
                      dragId === lead.id && "scale-[0.98] opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => onOpen(lead)} className="min-w-0 text-left" aria-label={`Abrir detalhes de ${lead.name}`}>
                        <span className="block truncate text-[13.5px] font-semibold text-ink group-hover:text-white">{lead.name}</span>
                        <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
                          <SourceIcon source={lead.source} className="size-3.5" />
                          {lead.city}
                        </span>
                      </button>
                      <Menu
                        label={`Mover ${lead.name}`}
                        trigger={
                          <button type="button" className="grid size-7 shrink-0 place-items-center rounded-full text-ink-faint hover:bg-white/[0.06] hover:text-ink" aria-label={`Mover ${lead.name} para outra etapa`}>
                            <ArrowRightLeft className="size-3.5" aria-hidden />
                          </button>
                        }
                        items={[{ heading: "Mover para…" }, ...LEAD_STAGES.filter((s) => s !== stage).map((s) => ({ label: leadStageMeta[s].label, onSelect: () => move(lead, s) }))]}
                      />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <TonePill tone={priorityMeta[lead.priority].tone}>{priorityMeta[lead.priority].label}</TonePill>
                      <span className="tnum text-[12px] font-semibold text-ink-soft">{formatBRLCompact(lead.potentialValue)}</span>
                    </div>
                    {lead.nextActionAt && (
                      <p className={cn("mt-2 flex items-center gap-1 text-[11.5px]", new Date(lead.nextActionAt) < new Date(new Date().toDateString()) ? "text-danger" : "text-ink-faint")}>
                        <CalendarClock className="size-3.5" aria-hidden />
                        {lead.nextAction ? `${lead.nextAction} · ` : ""}
                        {formatRelative(lead.nextActionAt)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
