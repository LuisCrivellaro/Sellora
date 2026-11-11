"use client";

import { ExternalLink, FilePlus2, Pencil, Store, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { ActivityPanel } from "@/components/shared/activity-panel";
import { StatusBadge, TonePill } from "@/components/ui/dashboard-badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { LEAD_STAGES, leadSourceMeta, leadStageMeta, priorityMeta, proposalStatusMeta, segmentMeta, temperatureMeta, websiteSituationMeta } from "@/lib/constants";
import { convertLeadToClient, deleteLead, moveLeadStage } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { formatDate, formatRelative } from "@/lib/dates";
import { leadScore, temperatureOf } from "@/lib/metrics/leads";
import type { Lead } from "@/lib/types";
import { Money } from "@/components/ui/money";
import { dashboardTone as tone } from "@/lib/visualization";
import { LeadDemoPanel } from "@/components/demos/lead-demo-panel";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 truncate text-[13.5px] text-ink">{children || <span className="text-ink-faint">—</span>}</dd>
    </div>
  );
}

export function LeadDetail({ lead, open, onOpenChange, onEdit }: { lead: Lead | null; open: boolean; onOpenChange: (o: boolean) => void; onEdit: (l: Lead) => void }) {
  const { db } = useStore();
  const router = useRouter();
  const { notify } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!lead || !db) return null;

  const activities = db.activities.filter((a) => a.leadId === lead.id);
  const temp = temperatureOf(lead.stage);
  const { score, reasons } = leadScore(lead);
  const client = lead.clientId ? db.clients.find((c) => c.id === lead.clientId) : null;
  const proposals = db.proposals.filter((p) => p.leadId === lead.id);

  const convert = () => {
    const c = convertLeadToClient(lead.id);
    notify({ kind: "success", title: "Lead convertido em cliente", description: `${c.name} está em Clientes. Para abrir projeto e parcelas, use “Fechar venda” na proposta.` });
  };

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange} variant="sheet" title={lead.name} description={`${segmentMeta[lead.segment].label} · ${lead.city}/${lead.uf}`}>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <TonePill tone={leadStageMeta[lead.stage].tone}>{leadStageMeta[lead.stage].label}</TonePill>
            <TonePill tone={priorityMeta[lead.priority].tone}>Prioridade {priorityMeta[lead.priority].label.toLowerCase()}</TonePill>
            {temp && <TonePill tone={temperatureMeta[temp].tone}>{temperatureMeta[temp].label}</TonePill>}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => onEdit(lead)}>
              <Pencil aria-hidden /> Editar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => router.push(`/propostas?novo=1&lead=${lead.id}`)}>
              <FilePlus2 aria-hidden /> Criar proposta
            </Button>
            {client ? (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/clientes?id=${client.id}`}>
                  <Store aria-hidden /> Ver cliente
                </Link>
              </Button>
            ) : (
              lead.stage !== "perdido" && (
                <Button size="sm" variant={lead.stage === "ganho" ? "primary" : "outline"} onClick={convert}>
                  <Store aria-hidden /> Converter em cliente
                </Button>
              )
            )}
            <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden /> Excluir
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_200px]">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-seam p-4">
              <Info label="Origem">{leadSourceMeta[lead.source].label}</Info>
              <Info label="Valor potencial"><Money value={lead.potentialValue} /></Info>
              <Info label="Website">
                {lead.website ? (
                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-interactive hover:text-ink">
                    {lead.website.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : null}
              </Info>
              <Info label="Situação do site">
                <StatusBadge tone={websiteSituationMeta[lead.websiteSituation].tone} label={websiteSituationMeta[lead.websiteSituation].label} size="sm" />
              </Info>
              <Info label="Telefone">{lead.phone}</Info>
              <Info label="E-mail">{lead.email}</Info>
              <Info label="Instagram">{lead.instagram}</Info>
              <Info label="Último contato">{lead.lastContactAt ? `${formatDate(lead.lastContactAt)} (${formatRelative(lead.lastContactAt)})` : "Sem contato"}</Info>
              <Info label="Próxima ação">{lead.nextAction}</Info>
              <Info label="Data da próxima ação">{lead.nextActionAt ? `${formatDate(lead.nextActionAt)} (${formatRelative(lead.nextActionAt)})` : ""}</Info>
            </dl>
            <div className="flex flex-col gap-2 rounded-2xl border border-seam p-4">
              <p className="text-[11.5px] text-ink-faint">Score de oportunidade</p>
              <p className="tnum text-[26px] leading-none font-bold text-ink">
                {score}
                <span className="text-[13px] font-medium text-ink-faint">/100</span>
              </p>
              <SegmentedBar value={score / 100} color={tone.magenta} label="Score de oportunidade" size="sm" />
              <ul className="mt-1 space-y-0.5 text-[11.5px] text-ink-soft">
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-semibold text-ink-soft">Mover para</span>
            <div className="w-[220px]">
              <Select
                aria-label="Mover lead para etapa"
                value={lead.stage}
                onValueChange={(s) => {
                  moveLeadStage(lead.id, s);
                  notify({ kind: "success", title: `Movido para ${leadStageMeta[s].label}`, description: s === "ganho" && !lead.clientId ? "Cliente criado ou vinculado automaticamente, sem duplicar." : undefined });
                }}
                options={LEAD_STAGES.map((s) => ({ value: s, label: leadStageMeta[s].label }))}
              />
            </div>
          </div>

          {lead.notes && <p className="rounded-2xl border border-seam p-4 text-[13px] whitespace-pre-wrap text-ink-soft">{lead.notes}</p>}
          {lead.lostReason && lead.stage === "perdido" && <p className="text-[13px] text-ink-faint">Motivo da perda: {lead.lostReason}</p>}

          {proposals.length > 0 && (
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-ink-faint">Propostas</p>
              <ul className="flex flex-col gap-1.5">
                {proposals.map((p) => (
                  <li key={p.id}>
                    <Link href={`/propostas?id=${p.id}`} className="flex items-center justify-between rounded-xl border border-seam px-3 py-2 text-[13px] text-ink hover:border-seam-strong">
                      <span className="min-w-0 truncate">{p.title}</span>
                      <span className="shrink-0 text-ink-faint">{proposalStatusMeta[p.status].label} · {formatDate(p.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <LeadDemoPanel key={`${lead.id}:${lead.demo?.id ?? "empty"}:${lead.demo?.updatedAt ?? ""}`} lead={lead} />
          <ActivityPanel target={{ leadId: lead.id }} activities={activities} />
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Excluir ${lead.name}?`}
        description="O lead e o histórico de atividades dele serão removidos deste navegador. Clientes e propostas já criados são mantidos. Esta ação não pode ser desfeita."
        confirmLabel="Excluir lead"
        onConfirm={() => {
          deleteLead(lead.id);
          onOpenChange(false);
          notify({ kind: "success", title: "Lead excluído" });
        }}
      />
    </>
  );
}
