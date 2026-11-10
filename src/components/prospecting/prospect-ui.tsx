"use client";

import { AlertTriangle, CheckCircle2, CircleSlash, Loader2, X, XCircle } from "lucide-react";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { Button } from "@/components/ui/button";
import { opportunityMeta, segmentOptions } from "@/lib/prospecting/catalog";
import type { Classification, Confidence, EvidenceStatus, JobPhase, JobView } from "@/lib/prospecting/types";
import { cn } from "@/lib/utils";
import { dashboardColors } from "@/lib/visualization";

/** Cores da classificação: vermelho para oportunidade, azul-aço para presença adequada. */
export const classColor: Record<Classification, string> = {
  HOT: dashboardColors.red,
  WARM: dashboardColors.redLight,
  LOW: dashboardColors.steel,
  SKIP: dashboardColors.gray,
};

export function ClassBadge({ value, size = "md" }: { value: Classification; size?: "sm" | "md" }) {
  const color = classColor[value];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full border font-bold tracking-[0.02em] whitespace-nowrap", size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-[12px]")}
      style={{ color: `color-mix(in oklab, ${color} 70%, white)`, borderColor: `color-mix(in oklab, ${color} 45%, transparent)`, background: `color-mix(in oklab, ${color} 13%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden />
      {value}
    </span>
  );
}

export function ScoreMeter({ score, compact = false }: { score: number; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2" aria-label={`Score ${score} de 100`}>
      <span className="tnum min-w-[2ch] text-right font-bold text-ink">{score}</span>
      {!compact && (
        <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden>
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${score}%`, background: score >= 60 ? dashboardColors.red : score >= 30 ? dashboardColors.redLight : dashboardColors.steel }} />
        </span>
      )}
    </span>
  );
}

export const confidenceLabel: Record<Confidence, string> = { alta: "Confiança alta", media: "Confiança média", baixa: "Confiança baixa" };

export const evidenceMeta: Record<EvidenceStatus, { label: string; color: string }> = {
  verificado: { label: "Verificado", color: "var(--neon-mint)" },
  fonte: { label: "Declarado na fonte", color: dashboardColors.steelLight },
  nao_verificado: { label: "Não verificado", color: "var(--signal-warn)" },
};

const phaseLabel: Record<JobPhase, string> = {
  geocoding: "Localizando a cidade",
  discovering: "Buscando estabelecimentos",
  verifying: "Verificando presença digital",
  classifying: "Classificando",
  done: "Finalizado",
};

export const segmentLabel = (id: string) => segmentOptions.find((s) => s.value === id)?.label ?? id;

/** Acompanhamento real do job: fase, contagens, avisos, cancelar e desfecho. */
export function JobPanel({ job, onCancel, onDismiss, onRetry }: { job: JobView; onCancel: () => void; onDismiss: () => void; onRetry: () => void }) {
  const running = job.status === "running" || job.status === "queued";
  const progress = job.planned ? job.analyzed / job.planned : 0;
  const p = job.params;
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="tile grid size-9 shrink-0 place-items-center">
          {running ? (
            <Loader2 className="size-4.5 animate-spin text-ink-soft" aria-hidden />
          ) : job.status === "completed" ? (
            <CheckCircle2 className="size-4.5 text-mint" aria-hidden />
          ) : job.status === "cancelled" ? (
            <CircleSlash className="size-4.5 text-ink-faint" aria-hidden />
          ) : (
            <XCircle className="size-4.5 text-danger" aria-hidden />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold text-ink">
            {running ? phaseLabel[job.phase] : job.status === "completed" ? "Pesquisa concluída" : job.status === "cancelled" ? "Pesquisa cancelada" : "A pesquisa falhou"}
          </p>
          <p className="mt-0.5 text-[12.5px] text-ink-soft" role={job.status === "failed" ? "alert" : undefined}>
            {job.status === "failed" ? job.error : job.message}
          </p>
          <p className="mt-1 text-[11.5px] text-ink-faint">
            {p.city}/{p.uf} · {segmentLabel(p.segment)} · {p.radiusKm} km · até {p.maxResults} · {opportunityMeta[p.opportunity].label}
          </p>
        </div>
        {!running && (
          <Button variant="ghost" size="icon-sm" onClick={onDismiss} aria-label="Fechar acompanhamento">
            <X aria-hidden />
          </Button>
        )}
      </div>

      {(running || job.planned > 0) && (
        <div>
          <SegmentedBar size="sm" value={running ? progress : 1} color={dashboardColors.red} label="Progresso da verificação" valueText={`${job.analyzed} de ${job.planned || "?"} analisados`} />
          <dl className="tnum mt-2 grid grid-cols-3 gap-2 text-[12px]">
            <div>
              <dt className="text-ink-faint">Candidatos</dt>
              <dd className="font-semibold text-ink">{job.candidates}</dd>
            </div>
            <div>
              <dt className="text-ink-faint">Analisados</dt>
              <dd className="font-semibold text-ink">
                {job.analyzed}
                {job.planned ? <span className="font-normal text-ink-faint"> / {job.planned}</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-ink-faint">Oportunidades</dt>
              <dd className="font-semibold text-ink">{job.found}</dd>
            </div>
          </dl>
        </div>
      )}

      {job.warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {job.warnings.map((w, i) => (
            <li key={i} className="flex items-start gap-2 text-[12px] text-ink-soft">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warn" aria-hidden />
              {w}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {running && (
          <Button size="sm" variant="secondary" onClick={onCancel}>
            Cancelar pesquisa
          </Button>
        )}
        {(job.status === "failed" || job.status === "cancelled") && (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  );
}
