"use client";

import { ArchiveRestore, Ban, Download, ExternalLink, Eye, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/overlay";
import { segmentMeta } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { formatDate } from "@/lib/dates";
import { presenceLabel } from "@/lib/prospecting/classify";
import type { StoredProspect } from "@/lib/prospecting/store";
import { findCrmDuplicate, suggestProduct } from "@/lib/prospecting/to-lead";
import { formatBRL } from "@/lib/utils";
import { ClassBadge, confidenceLabel, evidenceMeta } from "./prospect-ui";

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11.5px] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 text-[13.5px] break-words text-ink">{children || <span className="text-ink-faint">Não encontrado</span>}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-seam p-4">
      <h3 className="mb-3 text-[13px] font-semibold text-ink">{title}</h3>
      {children}
    </section>
  );
}

const ext = (url: string, label?: string) => (
  <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-full items-center gap-1 text-interactive hover:text-ink">
    <span className="truncate">{label ?? url.replace(/^https?:\/\/(www\.)?/, "")}</span>
    <ExternalLink className="size-3 shrink-0" aria-hidden />
  </a>
);

export function ProspectDetail({
  item,
  open,
  onOpenChange,
  onImport,
  onDiscard,
  onExport,
  onOpenLead,
}: {
  item: StoredProspect | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImport: (item: StoredProspect) => void;
  onDiscard: (item: StoredProspect, discarded: boolean) => void;
  onExport: (item: StoredProspect) => void;
  onOpenLead: (leadId: string) => void;
}) {
  const { db } = useStore();
  if (!item || !db) return null;
  const imported = item.importedLeadId ? db.leads.find((l) => l.id === item.importedLeadId) : null;
  const duplicate = imported ? null : findCrmDuplicate(item, db.leads);
  const suggestion = suggestProduct(item, db.settings.packages);
  const siteUrl = item.website ? (item.siteCheck?.finalUrl ?? (/^https?:\/\//.test(item.website) ? item.website : `https://${item.website}`)) : null;
  const ig = item.instagram ? `https://www.instagram.com/${item.instagram.replace(/^@/, "")}/` : null;

  return (
    <Modal open={open} onOpenChange={onOpenChange} variant="sheet" title={item.name} description={`${item.category} · ${segmentMeta[item.segment].label} · ${item.city}/${item.uf}`}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <ClassBadge value={item.classification} />
          <span className="tnum rounded-full border border-seam-strong px-2.5 py-0.5 text-[12px] font-semibold text-ink">Score {item.score}/100</span>
          <span className="rounded-full border border-seam-strong px-2.5 py-0.5 text-[12px] text-ink-soft">{confidenceLabel[item.confidence]}</span>
          {item.discarded && <span className="rounded-full border border-seam-strong px-2.5 py-0.5 text-[12px] text-ink-faint">Descartado</span>}
        </div>

        <div className="flex flex-wrap gap-2">
          {imported ? (
            <Button size="sm" variant="secondary" onClick={() => onOpenLead(imported.id)}>
              <Eye aria-hidden /> Ver no CRM
            </Button>
          ) : duplicate ? (
            <Button size="sm" variant="secondary" onClick={() => onOpenLead(duplicate.leadId)}>
              <Eye aria-hidden /> Já no CRM: ver lead
            </Button>
          ) : (
            <Button size="sm" variant="primary" disabled={item.classification === "SKIP" || item.discarded} onClick={() => onImport(item)}>
              <UserPlus aria-hidden /> Adicionar ao CRM
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => onDiscard(item, !item.discarded)}>
            {item.discarded ? <ArchiveRestore aria-hidden /> : <Ban aria-hidden />} {item.discarded ? "Restaurar" : "Marcar como descartado"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => onExport(item)}>
            <Download aria-hidden /> Exportar dados
          </Button>
          {siteUrl && (
            <Button size="sm" variant="ghost" asChild>
              <a href={siteUrl} target="_blank" rel="noopener noreferrer nofollow">
                <ExternalLink aria-hidden /> Abrir site
              </a>
            </Button>
          )}
        </div>
        {duplicate && <p className="text-[12.5px] text-ink-soft">Já existe no CRM como &ldquo;{duplicate.leadName}&rdquo; ({duplicate.reason}). Nada será sobrescrito.</p>}
        {item.classification === "SKIP" && <p className="text-[12.5px] text-ink-faint">Leads SKIP não são importados.</p>}

        <Section title="Informações comerciais">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Info label="Telefone comercial">{item.phone && <a href={`tel:${item.phone.replace(/[^\d+]/g, "")}`} className="text-interactive hover:text-ink">{item.phone}</a>}</Info>
            <Info label="E-mail comercial">{item.email}</Info>
            <Info label="Endereço">{item.address}</Info>
            <Info label="Distância do centro">{item.distanceKm !== null ? `${item.distanceKm.toLocaleString("pt-BR")} km` : ""}</Info>
            <Info label="Horário publicado">{item.openingHours}</Info>
            <Info label="Categoria na fonte">{item.category}</Info>
          </dl>
        </Section>

        <Section title="Presença digital">
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Info label="Situação">{presenceLabel[item.presence]}</Info>
            <Info label="Site próprio">{siteUrl && ext(siteUrl)}</Info>
            <Info label="Instagram">{ig && ext(ig, item.instagram)}</Info>
            <Info label="Outras redes públicas">{item.otherSocials.length > 0 && <span className="flex flex-col gap-1">{item.otherSocials.map((s) => <span key={s}>{ext(s)}</span>)}</span>}</Info>
          </dl>
          {item.siteCheck && (
            <p className="mt-3 text-[12px] text-ink-faint">
              Conferência HTTP em {formatDate(item.siteCheck.checkedAt)}: {item.siteCheck.reachable ? `HTTP ${item.siteCheck.httpStatus}${item.siteCheck.https ? " · HTTPS" : " · sem HTTPS"}` : item.siteCheck.error ?? "sem resposta"}
              {item.siteCheck.title ? ` · título "${item.siteCheck.title}"` : ""}
            </p>
          )}
        </Section>

        <Section title="Diagnóstico">
          <p className="text-[13.5px] text-ink">{item.diagnosis}</p>
          {item.problems.length > 0 && (
            <>
              <h4 className="mt-3 mb-1.5 text-[12px] font-semibold text-ink-faint">Problemas verificados</h4>
              <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] text-ink-soft">
                {item.problems.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </>
          )}
          <h4 className="mt-3 mb-1.5 text-[12px] font-semibold text-ink-faint">Justificativa</h4>
          <p className="text-[13px] text-ink-soft">{item.justification}</p>
          <h4 className="mt-3 mb-1.5 text-[12px] font-semibold text-ink-faint">Composição do score</h4>
          <ul className="flex flex-col gap-1 text-[12.5px]">
            {item.scoreParts.map((s) => (
              <li key={s.label} className="flex justify-between gap-3 text-ink-soft">
                <span>{s.label}</span>
                <span className="tnum font-semibold text-ink">+{s.points}</span>
              </li>
            ))}
            <li className="flex justify-between gap-3 border-t border-seam pt-1.5 font-semibold text-ink">
              <span>Total</span>
              <span className="tnum">{item.score}/100</span>
            </li>
          </ul>
        </Section>

        <Section title="Evidências e fontes">
          <ul className="flex flex-col gap-2">
            {item.evidence.map((e, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[12.5px]">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full" style={{ background: evidenceMeta[e.status].color }} aria-hidden />
                <span className="min-w-0">
                  <span className="text-ink">{e.claim}</span>
                  <span className="block text-[11.5px] text-ink-faint">
                    {evidenceMeta[e.status].label} · {e.source}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <h4 className="mt-3 mb-1.5 text-[12px] font-semibold text-ink-faint">Fontes consultadas</h4>
          <ul className="flex flex-col gap-1 text-[12.5px]">
            {item.sources.map((s) => (
              <li key={s.url} className="min-w-0">
                <span className="text-ink-faint">{s.label}: </span>
                {ext(s.url)}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] text-ink-faint">Verificado em {new Date(item.checkedAt).toLocaleString("pt-BR")}. Dados © colaboradores do OpenStreetMap (ODbL).</p>
        </Section>

        <Section title="Sugestão de produto Sellora">
          {suggestion ? (
            <p className="text-[13px] text-ink-soft">
              <span className="font-semibold text-ink">{suggestion.name}</span> · preço de referência {formatBRL(suggestion.price)}. {suggestion.reason}
            </p>
          ) : (
            <p className="text-[13px] text-ink-faint">Sem sugestão: {item.classification === "LOW" ? "presença adequada; abordar só se houver demanda específica." : "lead fora do perfil."}</p>
          )}
          <p className="mt-2 text-[11.5px] text-ink-faint">Sugestão, não proposta. Preço final só depois de diagnóstico e revisão humana.</p>
        </Section>
      </div>
    </Modal>
  );
}
