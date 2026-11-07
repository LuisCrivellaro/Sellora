"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { DonutChart } from "@/components/charts/donut";
import { NeonLineChart } from "@/components/charts/neon-line-chart";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { ProposalDetail } from "@/components/proposals/proposal-detail";
import { ProposalForm } from "@/components/proposals/proposal-form";
import { useUrlParams } from "@/components/shared/use-url-state";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, TonePill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardCard, LegendStat } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { PROPOSAL_STATUSES, proposalStatusMeta, tone } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { formatDate, formatRelative, RANGE_OPTIONS, type RangeKey } from "@/lib/dates";
import { approvalRate, isExpired, proposalsByStatus, proposalSeries, proposalTotal } from "@/lib/metrics/proposals";
import type { Proposal, ProposalStatus } from "@/lib/types";
import { cn, formatBRL, formatPercent, matchesQuery, sum } from "@/lib/utils";
import { Money } from "@/components/ui/money";

type StatusFilter = ProposalStatus | "todas" | "aguardando";

export function ProposalsView() {
  const { db } = useStore();
  const { params, setParams } = useUrlParams();
  const [range, setRange] = useState<RangeKey>("90d");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>((params.get("status") as StatusFilter) ?? "todas");
  const [formOpen, setFormOpen] = useState(params.get("novo") === "1");
  const [editing, setEditing] = useState<Proposal | null>(null);

  const data = useMemo(() => {
    if (!db) return null;
    return { series: proposalSeries(db.proposals, range), byStatus: proposalsByStatus(db.proposals), approval: approvalRate(db.proposals) };
  }, [db, range]);

  if (!db || !data) return <PageSkeleton />;

  const pkgName = (id: string) => db.settings.packages.find((p) => p.id === id)?.name ?? id;
  const rows = db.proposals.filter(
    (p) =>
      matchesQuery(query, p.title, p.recipientName) &&
      (status === "todas" || (status === "aguardando" ? p.status === "enviada" || p.status === "negociacao" : p.status === status)),
  );
  const detailId = params.get("id");
  const detail = detailId ? (db.proposals.find((p) => p.id === detailId) ?? null) : null;
  const rangeInfo = RANGE_OPTIONS.find((r) => r.value === range)!;
  const maxValue = Math.max(1, ...data.byStatus.map((s) => s.value));
  const colors: Record<ProposalStatus, string> = { rascunho: "#8a83a0", enviada: "#8866bd", negociacao: "#bb6ba5", aprovada: "#5fbf9f", recusada: "#7473c4" };

  const columns: Column<Proposal>[] = [
    {
      key: "client",
      header: "Cliente",
      sortValue: (p) => p.recipientName,
      cell: (p) => (
        <span className="flex items-center gap-3">
          <Avatar name={p.recipientName} size={30} />
          <span className="min-w-0">
            <span className="block max-w-[220px] truncate font-semibold">{p.recipientName}</span>
            <span className="block max-w-[220px] truncate text-[11.5px] text-ink-faint">{p.title}</span>
          </span>
        </span>
      ),
    },
    { key: "package", header: "Pacote", sortValue: (p) => p.packageId, cell: (p) => <TonePill tone={p.packageId === "personalizado" ? "magenta" : p.packageId === "profissional" ? "violet" : "lilac"}>{pkgName(p.packageId)}</TonePill> },
    { key: "value", header: "Valor", align: "right", sortValue: (p) => proposalTotal(p), cell: (p) => <span className="tnum font-semibold text-ink"><Money value={proposalTotal(p)} /></span> },
    { key: "created", header: "Criação", hideBelow: "lg", sortValue: (p) => p.createdAt, cell: (p) => <span className="tnum">{formatDate(p.createdAt)}</span> },
    {
      key: "valid",
      header: "Validade",
      sortValue: (p) => p.validUntil,
      cell: (p) => (
        <span className={cn("tnum whitespace-nowrap", isExpired(p) && "text-danger")}>
          {formatDate(p.validUntil)}
          {isExpired(p) && <span className="block text-[11.5px]">vencida</span>}
        </span>
      ),
    },
    { key: "status", header: "Status", sortValue: (p) => PROPOSAL_STATUSES.indexOf(p.status), cell: (p) => <StatusBadge tone={proposalStatusMeta[p.status].tone} label={proposalStatusMeta[p.status].label} /> },
    {
      key: "next",
      header: "Próxima ação",
      hideBelow: "xl",
      cell: (p) => (p.nextAction ? <span className="block max-w-[220px] truncate">{p.nextAction}</span> : <span className="text-ink-faint">—</span>),
    },
  ];

  return (
    <>
      <PageHeader
        title="Propostas"
        description="Propostas comerciais. Envio, assinatura e cobrança são feitos fora do sistema."
        actions={
          <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden /> Nova proposta
          </Button>
        }
      />
      <div className="grid grid-cols-12 gap-3.5">
        <DashboardCard
          index={0}
          lit
          className="col-span-12 xl:col-span-5"
          title="Volume de propostas"
          description={rangeInfo.description}
          actions={<Segmented label="Período" value={range} onChange={setRange} options={RANGE_OPTIONS.map((r) => ({ value: r.value, label: r.label, title: r.description }))} />}
        >
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1.5">
            <LegendStat color={tone.magenta} label="Criadas" value={sum(data.series.created)} />
            <LegendStat color={tone.lilac} label="Enviadas" value={sum(data.series.sent)} />
          </div>
          <NeonLineChart
            height={220}
            labels={data.series.buckets.map((b) => b.label)}
            longLabels={data.series.buckets.map((b) => b.longLabel)}
            series={[
              { key: "criadas", label: "Criadas", color: "#bb6ba5", values: data.series.created },
              { key: "enviadas", label: "Enviadas", color: "#a891d1", values: data.series.sent },
            ]}
            summary={`Propostas, ${rangeInfo.description}: ${sum(data.series.created)} criadas e ${sum(data.series.sent)} enviadas`}
          />
        </DashboardCard>

        <DashboardCard index={1} className="col-span-12 md:col-span-6 xl:col-span-4" title="Valores por status" description="Soma dos totais das propostas">
          <ul className="flex flex-1 flex-col justify-around gap-3.5">
            {data.byStatus.map((s) => (
              <li key={s.status}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-ink">
                    {proposalStatusMeta[s.status].label} <span className="text-[11.5px] font-normal text-ink-faint">· {s.count}</span>
                  </span>
                  <span className="tnum text-[13.5px] font-bold text-ink"><Money value={s.value} /></span>
                </div>
                <SegmentedBar value={s.value / maxValue} color={colors[s.status]} label={`Valor ${proposalStatusMeta[s.status].label}`} valueText={formatBRL(s.value)} />
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard index={2} className="col-span-12 md:col-span-6 xl:col-span-3" title="Conversão de propostas" description={`Aprovadas ÷ decididas: ${formatPercent(data.approval)}`}>
          <DonutChart
            size={176}
            legendPosition="bottom"
            centerLabel="propostas"
            summary={`Propostas por status: ${data.byStatus.map((s) => `${proposalStatusMeta[s.status].label} ${s.count}`).join(", ")}`}
            slices={data.byStatus.map((s) => ({ key: s.status, label: proposalStatusMeta[s.status].label, value: s.count, color: colors[s.status] }))}
          />
        </DashboardCard>

        <DashboardCard index={3} className="col-span-12" title="Propostas" description={`${rows.length} de ${db.proposals.length}`}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput label="Buscar propostas" value={query} onChange={setQuery} placeholder="Buscar por cliente ou título…" className="w-full sm:w-[300px]" />
            <div className="max-w-full overflow-x-auto">
              <Segmented<StatusFilter>
                label="Filtrar por status"
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setParams({ status: v === "todas" ? null : v });
                }}
                options={[
                  { value: "todas", label: "Todas" },
                  { value: "aguardando", label: "Aguardando resposta" },
                  ...PROPOSAL_STATUSES.map((s) => ({ value: s, label: proposalStatusMeta[s].label })),
                ]}
              />
            </div>
          </div>
          <DataTable
            key={`${query}|${status}`}
            rows={rows}
            columns={columns}
            getRowId={(p) => p.id}
            getRowLabel={(p) => p.title}
            onOpen={(p) => setParams({ id: p.id })}
            caption="Propostas"
            initialSort={{ key: "created", dir: "desc" }}
            mobileCard={(p) => (
              <span className="flex flex-col gap-1.5">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-ink">{p.recipientName}</span>
                    <span className="block text-[12px] text-ink-faint">
                      {pkgName(p.packageId)} · válida {formatRelative(p.validUntil)}
                    </span>
                  </span>
                  <span className="tnum text-[14px] font-bold text-ink"><Money value={proposalTotal(p)} /></span>
                </span>
                <StatusBadge size="sm" tone={proposalStatusMeta[p.status].tone} label={proposalStatusMeta[p.status].label} />
              </span>
            )}
            empty={
              <EmptyState
                title={db.proposals.length ? "Nenhuma proposta com esses filtros" : "Nenhuma proposta ainda"}
                description={db.proposals.length ? "Ajuste a busca ou o status." : "Crie uma proposta a partir de um lead em diagnóstico."}
                action={
                  !db.proposals.length && (
                    <Button variant="primary" onClick={() => setFormOpen(true)}>
                      <Plus aria-hidden /> Criar proposta
                    </Button>
                  )
                }
              />
            }
          />
        </DashboardCard>
      </div>

      <ProposalForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setEditing(null);
            if (params.get("novo")) setParams({ novo: null, lead: null });
          }
        }}
        proposal={editing}
        defaultLeadId={params.get("lead")}
        onSaved={(p) => !editing && setParams({ id: p.id, novo: null, lead: null })}
      />
      <ProposalDetail
        proposal={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setParams({ id: null })}
        onEdit={(p) => {
          setEditing(p);
          setFormOpen(true);
        }}
        onDuplicated={(p) => setParams({ id: p.id })}
      />
    </>
  );
}
