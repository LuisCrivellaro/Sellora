"use client";

import { AlarmClock, ArrowUpRight, BadgeCheck, CalendarDays, CalendarClock, ChevronDown, CircleDollarSign, FileText, Handshake, MessageCircle, UserPlus, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { NeonLineChart } from "@/components/charts/neon-line-chart";
import { RadarChart } from "@/components/charts/radar";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { HomeKpi } from "@/components/home/kpi-card";
import { RecentCommercialActivities } from "@/components/home/recent-activities";
import { SourceIcon } from "@/components/shared/source-icon";
import { DashboardCard, LegendStat } from "@/components/ui/card";
import { IconTile, PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { PageSkeleton } from "@/components/ui/states";
import { leadSourceMeta, leadStageMeta, OPEN_STAGES } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { formatDate, formatShort, RANGE_OPTIONS, type RangeKey } from "@/lib/dates";
import { commercialRadar, nextActions } from "@/lib/metrics/home";
import { homePeriodOverview } from "@/lib/metrics/home-overview";
import { formatPercent } from "@/lib/utils";
import { dashboardColors, dashboardTone as tone } from "@/lib/visualization";
import "./home-view.css";

const ACTION_ICONS = { sem_contato: UserPlus, follow_ups: AlarmClock, propostas: FileText, prazos: CalendarClock, pagamentos: CircleDollarSign } as const;

export function HomeView() {
  const { db } = useStore();
  const [range, setRange] = useState<RangeKey>("90d");
  const data = useMemo(() => {
    if (!db) return null;
    const now = new Date();
    return {
      now,
      overview: homePeriodOverview(db, range, now),
      radar: commercialRadar(db, now),
      actions: nextActions(db, now),
      openTotal: db.leads.filter((lead) => OPEN_STAGES.includes(lead.stage)).length,
      stages: OPEN_STAGES.map((stage) => ({ stage, count: db.leads.filter((lead) => lead.stage === stage).length })),
    };
  }, [db, range]);

  if (!db || !data) return <PageSkeleton rows={[["col-span-12 sm:col-span-6 xl:col-span-3 h-[170px]", "col-span-12 sm:col-span-6 xl:col-span-3 h-[170px]", "col-span-12 sm:col-span-6 xl:col-span-3 h-[170px]", "col-span-12 sm:col-span-6 xl:col-span-3 h-[170px]"], ["col-span-12 xl:col-span-8 h-[350px]", "col-span-12 xl:col-span-4 h-[350px]"], ["col-span-12 h-[420px]"]]} />;

  const { overview } = data;
  const { series, metrics } = overview;
  const rangeInfo = RANGE_OPTIONS.find((item) => item.value === range)!;
  return (
    <div className="home-overview" style={{ "--home-red": dashboardColors.red, "--home-red-light": dashboardColors.redLight } as CSSProperties}>
      <PageHeader
        title="Visão geral"
        description={`Sua operação comercial em perspectiva · ${formatDate(data.now.toISOString())}`}
        actions={<div className="home-period-controls">
          <span className="home-period-dates"><CalendarDays size={14} aria-hidden />{formatShort(new Date(overview.start))} — {formatShort(new Date(overview.end - 1))}</span>
          <Segmented label="Período da visão geral" value={range} onChange={setRange} options={RANGE_OPTIONS.map((item) => ({ value: item.value, label: item.label, title: item.description }))} />
        </div>}
      />

      <div className="home-kpis">
        <HomeKpi title="Leads captados" metric={metrics.leads} icon={UsersRound} href="/leads" note="Novos registros no período" featured index={0} />
        <HomeKpi title="Contatos realizados" metric={metrics.contacts} icon={MessageCircle} href="/leads" note="Atividades de contato concluídas" index={1} />
        <HomeKpi title="Propostas enviadas" metric={metrics.proposals} icon={FileText} href="/propostas" note="Envios registrados no período" index={2} />
        <HomeKpi title="Vendas fechadas" metric={metrics.sales} icon={Handshake} href="/clientes" note={overview.conversion === null ? "Conversão acumulada sem base" : `${formatPercent(overview.conversion, 1)} de conversão acumulada`} info={overview.undatedWon ? `${overview.undatedWon} ganho(s) sem data de fechamento registrada ficam fora da contagem por período. Não usamos a data de edição do lead como fechamento.` : "Ganhos no período, pelo histórico de etapa ou pela aprovação da proposta. Cada lead é contado uma vez."} index={3} />
      </div>

      <div className="home-analytics">
        <DashboardCard index={4} title="Evolução comercial" description={rangeInfo.description} className="home-trend-card" actions={<span className="home-chart-period">{rangeInfo.label}</span>}>
          <div className="home-chart-legend">
            <LegendStat color={dashboardColors.red} label="Leads captados" value={metrics.leads.value} />
            <LegendStat color={dashboardColors.steel} label="Contatos realizados" value={metrics.contacts.value} />
            <LegendStat color={dashboardColors.redLight} label="Propostas enviadas" value={metrics.proposals.value} />
          </div>
          <NeonLineChart
            className="home-trend-plot"
            touchTooltip
            height={244}
            labels={series.buckets.map((bucket) => bucket.label)}
            longLabels={series.buckets.map((bucket) => bucket.longLabel)}
            series={[
              { key: "leads", label: "Leads captados", color: dashboardColors.red, values: series.leads },
              { key: "contatos", label: "Contatos realizados", color: dashboardColors.steel, values: series.contacts },
              { key: "propostas", label: "Propostas enviadas", color: dashboardColors.redLight, values: series.proposals },
            ]}
            summary={`Evolução comercial, ${rangeInfo.description}: ${metrics.leads.value} leads captados, ${metrics.contacts.value} contatos e ${metrics.proposals.value} propostas enviadas`}
          />
        </DashboardCard>

        <DashboardCard index={5} title="Fontes de leads" description={`${metrics.leads.value} captados no período selecionado`} className="home-sources-card">
          <ul className="home-sources">
            {overview.sources.map((source) => {
              const meta = leadSourceMeta[source.source];
              return <li key={source.source} className="home-source-row">
                <span className="home-source-icon"><SourceIcon source={source.source} className="size-4" /></span>
                <div className="min-w-0 flex-1">
                  <div className="home-source-heading">
                    <span className="truncate text-[12.5px] font-medium text-ink">{meta.label}</span>
                    <span className="tnum flex shrink-0 items-center gap-2 text-[11.5px] text-ink-faint"><strong className="text-[12.5px] font-semibold text-ink">{source.count}</strong>{formatPercent(source.share)}</span>
                  </div>
                  <SegmentedBar size="sm" value={(source.share ?? 0) / 100} color={tone[meta.tone]} label={`${meta.label}: participação`} valueText={`${source.count} leads, ${formatPercent(source.share)}`} />
                </div>
              </li>;
            })}
          </ul>
        </DashboardCard>
      </div>

      <RecentCommercialActivities rows={overview.recent} range={range} />

      <details className="home-secondary">
        <summary>
          <span><strong>Análises complementares</strong><span className="home-secondary-hint">Performance, pipeline e próximas ações</span></span>
          <ChevronDown className="home-secondary-chevron" size={17} aria-hidden />
        </summary>
        <div className="home-secondary-grid">
          <DashboardCard index={7} title="Performance comercial" description="Índices normalizados 0–100 · 30 dias">
            <RadarChart axes={data.radar} summary={`Performance comercial: ${data.radar.map((axis) => `${axis.label} ${axis.value ?? "sem base"}`).join(", ")}`} />
          </DashboardCard>
          <DashboardCard index={8} title="Pipeline comercial" description={`${data.openTotal} leads em aberto · acumulado`} actions={<Link href="/leads?visao=kanban" className="home-secondary-link" aria-label="Abrir Kanban"><ArrowUpRight size={16} aria-hidden /></Link>}>
            <ul className="flex flex-col gap-3">
              {data.stages.map(({ stage, count }) => {
                const meta = leadStageMeta[stage];
                const share = data.openTotal ? count / data.openTotal : 0;
                return <li key={stage}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[12px]">
                    <span className="flex items-center gap-1.5 text-ink"><span className="size-2 rounded-full" style={{ background: tone[meta.tone] }} aria-hidden />{meta.label}</span>
                    <span className="tnum whitespace-nowrap text-ink-faint"><strong className="font-semibold text-ink">{count}</strong> · {formatPercent(share * 100)}</span>
                  </div>
                  <SegmentedBar size="sm" value={share} color={tone[meta.tone]} label={`Etapa ${meta.label}`} valueText={`${count} leads`} />
                </li>;
              })}
            </ul>
          </DashboardCard>
          <DashboardCard index={9} title="Próximas ações" description="Pendências atuais, derivadas dos registros">
            <ul className="flex flex-col gap-2">
              {data.actions.map((action) => {
                const Icon = ACTION_ICONS[action.key as keyof typeof ACTION_ICONS] ?? BadgeCheck;
                return <li key={action.key}><Link href={action.href} className="home-next-action">
                  <IconTile><Icon aria-hidden /></IconTile>
                  <span className="min-w-0 flex-1"><strong className="block text-[12px] font-medium text-ink">{action.label}</strong><span className="block text-[10.5px] text-ink-faint">{action.hint}</span></span>
                  <span className="tnum text-[15px] font-bold" style={{ color: action.count > 0 ? tone[action.tone] : "var(--ink-faint)" }}>{action.count}</span>
                  <ArrowUpRight size={13} className="shrink-0 text-ink-faint" aria-hidden />
                </Link></li>;
              })}
            </ul>
          </DashboardCard>
        </div>
      </details>
    </div>
  );
}
