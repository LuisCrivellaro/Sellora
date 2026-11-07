"use client";

import { ExternalLink, FolderPlus, Pencil } from "lucide-react";
import Link from "next/link";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { ActivityPanel } from "@/components/shared/activity-panel";
import { StatusBadge, TonePill } from "@/components/ui/dashboard-badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { clientStatusMeta, projectStageMeta, segmentMeta } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { formatDate } from "@/lib/dates";
import { openAmount, paidAmount } from "@/lib/metrics/finance";
import { projectProgress } from "@/lib/metrics/projects";
import type { Client } from "@/lib/types";
import { sum } from "@/lib/utils";
import { Money } from "@/components/ui/money";
import { dashboardProgressColor, dashboardProjectStageColors } from "@/lib/visualization";

export function ClientDetail({ client, open, onOpenChange, onEdit }: { client: Client | null; open: boolean; onOpenChange: (o: boolean) => void; onEdit: (c: Client) => void }) {
  const { db } = useStore();
  if (!client || !db) return null;
  const projects = db.projects.filter((p) => p.clientId === client.id);
  const txs = db.transactions.filter((t) => t.clientId === client.id && t.kind === "receita" && !t.cancelled);
  const contracted = sum(projects.map((p) => p.contractValue));
  const received = sum(txs.map(paidAmount));
  const open_ = sum(txs.map(openAmount));
  const activities = db.activities.filter((a) => a.clientId === client.id || (client.leadId && a.leadId === client.leadId));
  const lead = client.leadId ? db.leads.find((l) => l.id === client.leadId) : null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} variant="sheet" title={client.name} description={`${segmentMeta[client.segment].label} · ${client.city}/${client.uf}`}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <TonePill tone={clientStatusMeta[client.status].tone}>{clientStatusMeta[client.status].label}</TonePill>
          <span className="text-[12px] text-ink-faint">Cliente desde {formatDate(client.createdAt)}</span>
          {lead && (
            <Link href={`/leads?id=${lead.id}`} className="text-[12px] font-semibold text-interactive hover:text-ink">
              Ver lead de origem
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(client)}>
            <Pencil aria-hidden /> Editar
          </Button>
          <Button size="sm" variant="primary" asChild>
            <Link href={`/projetos?novo=1&cliente=${client.id}`}>
              <FolderPlus aria-hidden /> Criar projeto
            </Link>
          </Button>
        </div>

        <dl className="grid grid-cols-3 gap-3">
          {([
            ["Contratado", contracted],
            ["Recebido", received],
            ["Em aberto", open_],
          ] as const).map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-seam p-3">
              <dt className="text-[11.5px] text-ink-faint">{k}</dt>
              <dd className="tnum mt-1 text-[15px] font-bold"><Money value={v} /></dd>
            </div>
          ))}
        </dl>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-seam p-4">
          {[
            ["Contato", client.contactName],
            ["Telefone", client.phone],
            ["E-mail", client.email],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-[11.5px] text-ink-faint">{k}</dt>
              <dd className="mt-0.5 truncate text-[13.5px] text-ink">{v || <span className="text-ink-faint">—</span>}</dd>
            </div>
          ))}
          <div>
            <dt className="text-[11.5px] text-ink-faint">Site</dt>
            <dd className="mt-0.5 text-[13.5px]">
              {client.siteUrl ? (
                <a href={client.siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-interactive hover:text-ink">
                  {client.siteUrl.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : (
                <span className="text-ink-faint">Ainda não publicado</span>
              )}
            </dd>
          </div>
        </dl>

        <section>
          <p className="mb-2 text-[12.5px] font-semibold text-ink-faint">Projetos vinculados</p>
          {projects.length === 0 ? (
            <p className="text-[13px] text-ink-faint">Nenhum projeto ainda. Crie o projeto para acompanhar a produção do site.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {projects.map((p) => {
                const prog = projectProgress(p);
                return (
                  <li key={p.id}>
                    <Link href={`/projetos?id=${p.id}`} className="block rounded-2xl border border-seam p-3 hover:border-seam-strong">
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[13.5px] font-semibold text-ink">{p.title}</span>
                        <StatusBadge size="sm" tone={projectStageMeta[p.stage].tone} color={dashboardProjectStageColors[p.stage]} label={projectStageMeta[p.stage].label} />
                      </span>
                      <span className="mt-2 flex items-center gap-3">
                        <SegmentedBar size="sm" value={prog / 100} color={dashboardProgressColor(prog)} label={`Progresso de ${p.title}`} />
                        <span className="tnum text-[12px] font-bold text-ink">{prog}%</span>
                      </span>
                      {(p.previewUrl || p.publishedUrl) && (
                        <span className="mt-1.5 block text-[11.5px] text-ink-faint">
                          {p.publishedUrl ? `Publicado: ${p.publishedUrl.replace(/^https?:\/\//, "")}` : `Preview: ${p.previewUrl.replace(/^https?:\/\//, "")}`}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {client.notes && <p className="rounded-2xl border border-seam p-4 text-[13px] whitespace-pre-wrap text-ink-soft">{client.notes}</p>}

        <ActivityPanel target={{ clientId: client.id, leadId: client.leadId }} activities={activities} />
      </div>
    </Modal>
  );
}
