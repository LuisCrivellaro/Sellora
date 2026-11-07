"use client";

import { AlarmClock, ArrowUpRight, BadgeCheck, CalendarClock, CircleDollarSign, FileText, Handshake, MessageCircle, Percent, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Heatmap } from "@/components/charts/heatmap";
import { NeonLineChart } from "@/components/charts/neon-line-chart";
import { RadarChart } from "@/components/charts/radar";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { SourceIcon } from "@/components/shared/source-icon";
import { DashboardCard, LegendStat } from "@/components/ui/card";
import { IconTile, PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { AnimatedCounter, PageSkeleton } from "@/components/ui/states";
import { leadSourceMeta, leadStageMeta, OPEN_STAGES, tone } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { formatDate, formatShort, RANGE_OPTIONS, type RangeKey } from "@/lib/dates";
import { commercialRadar, commercialSeries, nextActions } from "@/lib/metrics/home";
import { activityHeatmap, funnel, isContactActivity, sourceDistribution } from "@/lib/metrics/leads";
import { formatPercent, sum } from "@/lib/utils";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const ACTION_ICONS = {
  sem_contato: UserPlus,
  follow_ups: AlarmClock,
  propostas: FileText,
  prazos: CalendarClock,
  pagamentos: CircleDollarSign,
} as const;

export function HomeView() {
  const { db } = useStore();
  const [range, setRange] = useState<RangeKey>("90d");

  const data = useMemo(() => {
    if (!db) return null;
    const now = new Date();
    const heat = activityHeatmap(db.activities, 12, now, (a) => isContactActivity(a) || (a.type === "follow_up" && !!a.leadId));
    return {
      series: commercialSeries(db, range, now),
      sources: sourceDistribution(db.leads),
      funnel: funnel(db),
      heat,
      radar: commercialRadar(db, now),
      actions: nextActions(db, now),
      openTotal: db.leads.filter((l) => OPEN_STAGES.includes(l.stage)).length,
      stages: OPEN_STAGES.map((s) => ({ stage: s, count: db.leads.filter((l) => l.stage === s).length })),
    };
  }, [db, range]);

  if (!db || !data) return <PageSkeleton rows={[["col-span-12 xl:col-span-8 h-[360px]", "col-span-12 xl:col-span-4 h-[360px]"], ["col-span-12 lg:col-span-4 h-[340px]", "col-span-12 lg:col-span-4 h-[340px]", "col-span-12 lg:col-span-4 h-[340px]"]]} />;

  const { series } = data;
  const rangeInfo = RANGE_OPTIONS.find((r) => r.value === range)!;
  const funnelIcons = [UsersRound, MessageCircle, FileText, Handshake];

  return (
    <>
      <PageHeader title="Visão geral" description={`Operação comercial e de entrega · ${formatDate(new Date().toISOString())}`} />
      <div className="grid grid-cols-12 gap-3.5">
        {/* Evolução comercial */}
        <DashboardCard
          index={0}
          lit
          className="col-span-12 xl:col-span-8"
          title="Evolução comercial"
          description={rangeInfo.description}
          actions={<Segmented label="Período" value={range} onChange={setRange} options={RANGE_OPTIONS.map((r) => ({ value: r.value, label: r.label, title: r.description }))} />}
        >
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1.5">
            <LegendStat color={tone.magenta} label="Leads captados" value={sum(series.leads)} />
            <LegendStat color={tone.lilac} label="Contatos realizados" value={sum(series.contacts)} />
            <LegendStat color={tone.mint} label="Propostas enviadas" value={sum(series.proposals)} />
          </div>
          <NeonLineChart
            height={250}
            labels={series.buckets.map((b) => b.label)}
            longLabels={series.buckets.map((b) => b.longLabel)}
            series={[
              { key: "leads", label: "Leads captados", color: "#f230d6", values: series.leads },
              { key: "contatos", label: "Contatos", color: "#b48cff", values: series.contacts },
              { key: "propostas", label: "Propostas enviadas", color: "#1de9b6", values: series.proposals },
            ]}
            summary={`Evolução comercial, ${rangeInfo.description}: ${sum(series.leads)} leads captados, ${sum(series.contacts)} contatos e ${sum(series.proposals)} propostas enviadas`}
          />
        </DashboardCard>

        {/* Fontes de leads */}
        <DashboardCard index={1} className="col-span-12 xl:col-span-4" title="Fontes de leads" description={`${db.leads.length} leads cadastrados`}>
          <ul className="flex flex-1 flex-col justify-between gap-3">
            {data.sources.map((s) => {
              const meta = leadSourceMeta[s.source];
              return (
                <li key={s.source} className="flex items-center gap-3">
                  <IconTile>
                    <SourceIcon source={s.source} />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13.5px] text-ink">{meta.label}</span>
                      <span className="tnum shrink-0 text-[13px] text-ink-faint">
                        <span className="font-bold text-ink">{s.count}</span> · {formatPercent(s.share)}
                      </span>
                    </div>
                    <SegmentedBar size="sm" value={(s.share ?? 0) / 100} color={tone[meta.tone]} label={`${meta.label}: participação`} valueText={`${s.count} leads, ${formatPercent(s.share)}`} />
                  </div>
                </li>
              );
            })}
          </ul>
          <Link href="/leads" className="mt-4 inline-flex items-center gap-1 self-start text-[12.5px] font-semibold text-lilac hover:text-ink">
            Ver todos os leads <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </DashboardCard>

        {/* Funil */}
        <DashboardCard index={2} className="col-span-12 md:col-span-6 lg:col-span-4" title="Visão do funil" description="Acumulado de todos os leads">
          <ul className="flex flex-col divide-y divide-[var(--seam)]">
            {data.funnel.steps.map((step, i) => {
              const Icon = funnelIcons[i];
              return (
                <li key={step.key} className="flex items-center gap-3 py-2.5 first:pt-0">
                  <IconTile>
                    <Icon aria-hidden />
                  </IconTile>
                  <span className="flex-1 text-[13.5px] text-ink-soft">{step.label}</span>
                  <AnimatedCounter value={step.value} className="text-[15px] font-bold text-ink" />
                </li>
              );
            })}
            <li className="flex items-center gap-3 pt-2.5">
              <IconTile className="text-mint">
                <Percent aria-hidden />
              </IconTile>
              <span className="flex-1 text-[13.5px] text-ink-soft">
                Taxa de conversão
                <span className="block text-[11.5px] text-ink-faint">Vendas ÷ leads cadastrados</span>
              </span>
              <span className="tnum text-[15px] font-bold text-mint">{formatPercent(data.funnel.conversion, 1)}</span>
            </li>
          </ul>
        </DashboardCard>

        {/* Heatmap */}
        <DashboardCard index={3} className="col-span-12 md:col-span-6 lg:col-span-4" title="Atividades comerciais" description="Contatos e follow-ups concluídos · 12 semanas">
          <Heatmap
            rows={DAYS}
            columns={data.heat.weekStarts.map((d) => formatShort(d))}
            grid={data.heat.grid.map((row) => row.map((c) => ({ count: c.count, future: c.future, label: formatDate(c.date.toISOString()) })))}
            max={data.heat.max}
            unit="atividades"
            columnEvery={3}
            summary={`Atividades comerciais por dia nas últimas 12 semanas. Máximo diário: ${data.heat.max}`}
          />
        </DashboardCard>

        {/* Radar */}
        <DashboardCard index={4} className="col-span-12 lg:col-span-4" title="Performance comercial" description="Índices normalizados 0–100 · 30 dias">
          <RadarChart axes={data.radar} summary={`Performance comercial: ${data.radar.map((a) => `${a.label} ${a.value ?? "sem base"}`).join(", ")}`} />
        </DashboardCard>

        {/* Pipeline */}
        <DashboardCard
          index={5}
          className="col-span-12 lg:col-span-7"
          title="Pipeline comercial"
          description={`${data.openTotal} leads em aberto, por etapa`}
          actions={
            <Link href="/leads?visao=kanban" className="pill-group inline-flex h-8 items-center gap-1 px-3.5 text-[12.5px] font-semibold text-ink-soft hover:text-ink">
              Abrir Kanban <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          }
        >
          <ul className="flex flex-col gap-3">
            {data.stages.map(({ stage, count }) => {
              const meta = leadStageMeta[stage];
              const share = data.openTotal ? count / data.openTotal : 0;
              return (
                <li key={stage}>
                  <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                    <span className="flex items-center gap-2 text-ink">
                      <span className="size-2 rounded-full" style={{ background: tone[meta.tone] }} aria-hidden />
                      {meta.label}
                    </span>
                    <span className="tnum text-ink-faint">
                      <span className="font-bold text-ink">{count}</span> · {formatPercent(share * 100)}
                    </span>
                  </div>
                  <SegmentedBar value={share} color={tone[meta.tone]} label={`Etapa ${meta.label}`} valueText={`${count} leads`} />
                </li>
              );
            })}
          </ul>
        </DashboardCard>

        {/* Próximas ações */}
        <DashboardCard index={6} className="col-span-12 lg:col-span-5" title="Próximas ações" description="Derivadas dos registros; clique para ver a lista">
          <ul className="flex flex-col gap-1.5">
            {data.actions.map((a) => {
              const Icon = ACTION_ICONS[a.key as keyof typeof ACTION_ICONS] ?? BadgeCheck;
              return (
                <li key={a.key}>
                  <Link href={a.href} className="group flex items-center gap-3 rounded-2xl border border-seam bg-white/[0.015] px-3 py-2.5 transition-colors hover:border-seam-strong hover:bg-white/[0.035]">
                    <IconTile>
                      <Icon aria-hidden />
                    </IconTile>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] text-ink">{a.label}</span>
                      <span className="block text-[11.5px] text-ink-faint">{a.hint}</span>
                    </span>
                    <span className="tnum text-[17px] font-bold" style={{ color: a.count > 0 ? tone[a.tone] : "var(--ink-faint)" }}>
                      {a.count}
                    </span>
                    <ArrowUpRight className="size-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        </DashboardCard>
      </div>
    </>
  );
}
