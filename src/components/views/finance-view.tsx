"use client";

import { Ban, CircleDollarSign, MoreHorizontal, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { DonutChart } from "@/components/charts/donut";
import { NeonLineChart } from "@/components/charts/neon-line-chart";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { PaymentForm, TransactionForm } from "@/components/finance/finance-forms";
import { useUrlParams } from "@/components/shared/use-url-state";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardCard, LegendStat } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput, Select } from "@/components/ui/field";
import { Menu } from "@/components/ui/overlay";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { AnimatedCounter, EmptyState, PageSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { tone, transactionStatusMeta } from "@/lib/constants";
import { setTransactionCancelled } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { addDays, formatDate, RANGE_OPTIONS, type RangeKey } from "@/lib/dates";
import { financeSeries, financeSummary, lastPaymentDate, openAmount, paidAmount, transactionStatus } from "@/lib/metrics/finance";
import type { Transaction } from "@/lib/types";
import { cn, formatBRL, formatBRLCompact, matchesQuery, sum } from "@/lib/utils";

type StatusFilter = "todos" | "pendente" | "vencido" | "pago" | "custo";
type PeriodFilter = "todos" | "30" | "90" | "365";

export function FinanceView() {
  const { db } = useStore();
  const { params, setParams } = useUrlParams();
  const { notify } = useToast();
  const [range, setRange] = useState<RangeKey>("1a");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>((params.get("status") as StatusFilter) ?? "todos");
  const [period, setPeriod] = useState<PeriodFilter>("todos");
  const [txFormOpen, setTxFormOpen] = useState(false);
  const [paying, setPaying] = useState<Transaction | null>(null);

  const data = useMemo(() => (db ? { summary: financeSummary(db), series: financeSeries(db, range) } : null), [db, range]);
  if (!db || !data) return <PageSkeleton />;
  const { summary, series } = data;

  const clientName = (id: string | null) => (id ? (db.clients.find((c) => c.id === id)?.name ?? "—") : "—");
  const projectTitle = (id: string | null) => (id ? (db.projects.find((p) => p.id === id)?.title ?? "—") : "—");
  const since = period === "todos" ? null : addDays(new Date(), -Number(period)).getTime();

  const rows = db.transactions.filter((t) => {
    const st = transactionStatus(t);
    const statusOk =
      status === "todos" ||
      (status === "custo" ? t.kind === "custo" : t.kind === "receita" && (status === "pendente" ? ["a_receber", "parcial", "vencido"].includes(st) : st === status));
    return statusOk && (!since || new Date(t.dueDate).getTime() >= since) && matchesQuery(query, t.description, clientName(t.clientId), projectTitle(t.projectId));
  });

  const byClient = db.clients
    .map((c) => {
      const txs = db.transactions.filter((t) => t.clientId === c.id && t.kind === "receita" && !t.cancelled);
      return {
        id: c.id,
        name: c.name,
        contracted: sum(db.projects.filter((p) => p.clientId === c.id).map((p) => p.contractValue)),
        received: sum(txs.map(paidAmount)),
        open: sum(txs.map(openAmount)),
      };
    })
    .filter((c) => c.contracted || c.received || c.open)
    .sort((a, b) => b.contracted - a.contracted);

  const rangeInfo = RANGE_OPTIONS.find((r) => r.value === range)!;
  const kpis = [
    { label: "Receita contratada", value: summary.contracted, hint: "Soma dos contratos de projeto", color: tone.magenta },
    { label: "Faturado", value: summary.invoiced, hint: "Receitas lançadas", color: tone.violet },
    { label: "Total recebido", value: summary.received, hint: "Pagamentos registrados", color: tone.mint },
    { label: "Saldo pendente", value: summary.open, hint: `${formatBRL(summary.overdue)} vencido`, color: summary.overdue ? tone.danger : tone.lilac },
    { label: "Custos", value: summary.costs, hint: "Custos lançados", color: tone.indigo },
    { label: "Ticket médio", value: summary.averageTicket ?? 0, hint: `${summary.sales} vendas (projetos)`, color: tone.lilac },
  ];

  const columns: Column<Transaction>[] = [
    {
      key: "client",
      header: "Cliente",
      sortValue: (t) => clientName(t.clientId),
      cell: (t) => (
        <span className="min-w-0">
          <span className="block max-w-[200px] truncate font-semibold">{clientName(t.clientId)}</span>
          <span className="block max-w-[200px] truncate text-[11.5px] text-ink-faint xl:hidden">{t.description}</span>
        </span>
      ),
    },
    { key: "project", header: "Projeto", hideBelow: "lg", sortValue: (t) => projectTitle(t.projectId), cell: (t) => <span className="block max-w-[200px] truncate">{projectTitle(t.projectId)}</span> },
    { key: "desc", header: "Descrição", hideBelow: "xl", sortValue: (t) => t.description, cell: (t) => <span className="block max-w-[240px] truncate">{t.description}</span> },
    {
      key: "amount",
      header: "Valor",
      align: "right",
      sortValue: (t) => t.amount,
      cell: (t) => (
        <span className="tnum whitespace-nowrap">
          <span className={cn("font-semibold", t.kind === "custo" ? "text-ink-soft" : "text-ink")}>
            {t.kind === "custo" ? "− " : ""}
            {formatBRL(t.amount)}
          </span>
          {t.kind === "receita" && paidAmount(t) > 0 && paidAmount(t) < t.amount && <span className="block text-[11.5px] text-ink-faint">recebido {formatBRL(paidAmount(t))}</span>}
        </span>
      ),
    },
    { key: "due", header: "Vencimento", sortValue: (t) => t.dueDate, cell: (t) => <span className="tnum">{formatDate(t.dueDate)}</span> },
    { key: "paid", header: "Pagamento", hideBelow: "lg", sortValue: (t) => lastPaymentDate(t) ?? "", cell: (t) => <span className="tnum">{formatDate(lastPaymentDate(t))}</span> },
    {
      key: "status",
      header: "Status",
      sortValue: (t) => transactionStatus(t),
      cell: (t) => (t.kind === "custo" ? <StatusBadge tone="indigo" label={t.cancelled ? "Cancelado" : "Custo"} /> : <StatusBadge tone={transactionStatusMeta[transactionStatus(t)].tone} label={transactionStatusMeta[transactionStatus(t)].label} />),
    },
  ];

  return (
    <>
      <PageHeader
        title="Financeiro"
        description="Contratos, faturamento, recebimentos e custos — registros manuais, sem integração bancária."
        actions={
          <Button variant="primary" onClick={() => setTxFormOpen(true)}>
            <Plus aria-hidden /> Novo lançamento
          </Button>
        }
      />
      <div className="grid grid-cols-12 gap-3.5">
        <DashboardCard
          index={0}
          lit
          className="col-span-12 xl:col-span-8"
          title="Evolução financeira"
          description={rangeInfo.description}
          actions={<Segmented label="Período" value={range} onChange={setRange} options={RANGE_OPTIONS.map((r) => ({ value: r.value, label: r.label, title: r.description }))} />}
        >
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1.5">
            <LegendStat color={tone.magenta} label="Valor contratado" value={formatBRLCompact(sum(series.contracted))} />
            <LegendStat color={tone.mint} label="Recebimentos efetivos" value={formatBRLCompact(sum(series.received))} />
          </div>
          <NeonLineChart
            height={240}
            labels={series.buckets.map((b) => b.label)}
            longLabels={series.buckets.map((b) => b.longLabel)}
            format={(n) => formatBRLCompact(n).replace(",00", "")}
            series={[
              { key: "contratado", label: "Contratado", color: "#f230d6", values: series.contracted },
              { key: "recebido", label: "Recebido", color: "#1de9b6", values: series.received },
            ]}
            summary={`Evolução financeira, ${rangeInfo.description}: contratado ${formatBRL(sum(series.contracted))}, recebido ${formatBRL(sum(series.received))}`}
          />
        </DashboardCard>

        <DashboardCard index={1} className="col-span-12 xl:col-span-4" title="Situação dos recebimentos" description="Sobre o total faturado (receitas)">
          <div className="flex flex-1 items-center">
            <DonutChart
              size={190}
              centerLabel="faturado"
              centerValue={formatBRLCompact(summary.invoiced)}
              format={(n) => formatBRLCompact(n)}
              summary={`Recebido ${formatBRL(summary.received)}, a receber ${formatBRL(summary.toReceive)}, vencido ${formatBRL(summary.overdue)}`}
              slices={[
                { key: "recebido", label: "Recebido", value: summary.received, color: "#1de9b6" },
                { key: "receber", label: "A receber", value: summary.toReceive, color: "#8f4bff" },
                { key: "vencido", label: "Vencido", value: summary.overdue, color: "#ff4f70" },
              ]}
            />
          </div>
        </DashboardCard>

        <div className="col-span-12 grid grid-cols-2 gap-3.5 md:grid-cols-3 2xl:grid-cols-6">
          {kpis.map((k, i) => (
            <DashboardCard key={k.label} index={2 + i} as="div" bodyClassName="py-4">
              <p className="flex items-center gap-2 text-[12.5px] text-ink-soft">
                <span className="size-2 rounded-full" style={{ background: k.color, boxShadow: `0 0 8px ${k.color}` }} aria-hidden />
                {k.label}
              </p>
              {k.label === "Ticket médio" && summary.averageTicket === null ? (
                <span className="mt-2 block text-[20px] leading-tight font-bold text-ink-faint" title="Sem vendas registradas">
                  —
                </span>
              ) : (
                <AnimatedCounter value={k.value} format={(n) => formatBRL(n)} className="mt-2 block text-[20px] leading-tight font-bold tracking-[-0.01em] text-ink" />
              )}
              <p className="mt-1 text-[11.5px] text-ink-faint">{k.hint}</p>
            </DashboardCard>
          ))}
        </div>

        <DashboardCard index={8} className="col-span-12" title="Transações" description={`${rows.length} de ${db.transactions.length} lançamentos`}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput label="Buscar transações" value={query} onChange={setQuery} placeholder="Buscar cliente, projeto ou descrição…" className="w-full sm:w-[300px]" />
            <div className="max-w-full overflow-x-auto">
              <Segmented<StatusFilter>
                label="Filtrar por status"
                value={status}
                onChange={(v) => {
                  setStatus(v);
                  setParams({ status: v === "todos" ? null : v });
                }}
                options={[
                  { value: "todos", label: "Todos" },
                  { value: "pendente", label: "Pendentes" },
                  { value: "vencido", label: "Vencidos" },
                  { value: "pago", label: "Recebidos" },
                  { value: "custo", label: "Custos" },
                ]}
              />
            </div>
            <div className="w-[170px]">
              <Select<PeriodFilter>
                size="sm"
                aria-label="Período por vencimento"
                value={period}
                onValueChange={setPeriod}
                options={[
                  { value: "todos", label: "Todo o período" },
                  { value: "30", label: "Últimos 30 dias" },
                  { value: "90", label: "Últimos 90 dias" },
                  { value: "365", label: "Últimos 12 meses" },
                ]}
              />
            </div>
          </div>
          <DataTable
            key={`${query}|${status}|${period}`}
            rows={rows}
            columns={columns}
            getRowId={(t) => t.id}
            getRowLabel={(t) => t.description}
            caption="Transações"
            initialSort={{ key: "due", dir: "desc" }}
            rowActions={(t) => (
              <Menu
                label={`Ações de ${t.description}`}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${t.description}`}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                }
                items={[
                  { label: "Registrar recebimento", icon: <CircleDollarSign />, disabled: t.kind === "custo" || t.cancelled || openAmount(t) <= 0, onSelect: () => setPaying(t) },
                  "separator",
                  t.cancelled
                    ? { label: "Reativar lançamento", icon: <RotateCcw />, onSelect: () => { setTransactionCancelled(t.id, false); notify({ kind: "success", title: "Lançamento reativado" }); } }
                    : { label: "Cancelar lançamento", icon: <Ban />, destructive: true, onSelect: () => { setTransactionCancelled(t.id, true); notify({ kind: "success", title: "Lançamento cancelado", description: "Ele deixa de contar nos indicadores." }); } },
                ]}
              />
            )}
            mobileCard={(t) => (
              <span className="flex flex-col gap-1.5">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-ink">{clientName(t.clientId)}</span>
                    <span className="block truncate text-[12px] text-ink-faint">{t.description}</span>
                  </span>
                  <span className="tnum text-[14px] font-bold text-ink">{formatBRL(t.amount)}</span>
                </span>
                <span className="flex items-center justify-between text-[12px] text-ink-faint">
                  vence {formatDate(t.dueDate)}
                  {t.kind === "custo" ? <StatusBadge size="sm" tone="indigo" label="Custo" /> : <StatusBadge size="sm" tone={transactionStatusMeta[transactionStatus(t)].tone} label={transactionStatusMeta[transactionStatus(t)].label} />}
                </span>
              </span>
            )}
            empty={<EmptyState title={db.transactions.length ? "Nenhuma transação com esses filtros" : "Nenhum lançamento ainda"} description={db.transactions.length ? "Ajuste a busca, o status ou o período." : "Lance a entrada e o saldo de cada projeto contratado."} />}
          />
        </DashboardCard>

        <DashboardCard index={9} className="col-span-12" title="Valores por cliente" description="Contratado, recebido e em aberto">
          {byClient.length === 0 ? (
            <EmptyState title="Sem valores por cliente" description="Crie projetos com valor contratado para ver o resumo." />
          ) : (
            <ul className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
              {byClient.map((c) => (
                <li key={c.id}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13.5px] font-semibold text-ink">{c.name}</span>
                    <span className="tnum shrink-0 text-[12.5px] text-ink-faint">
                      <span className="font-bold text-ink">{formatBRL(c.received)}</span> / {formatBRL(c.contracted)}
                    </span>
                  </div>
                  <SegmentedBar size="sm" value={c.contracted ? c.received / c.contracted : 0} color={tone.mint} label={`${c.name}: recebido sobre contratado`} valueText={`${formatBRL(c.received)} de ${formatBRL(c.contracted)}`} />
                  {c.open > 0 && <p className="mt-1 text-[11.5px] text-ink-faint">Em aberto {formatBRL(c.open)}</p>}
                </li>
              ))}
            </ul>
          )}
        </DashboardCard>
      </div>

      <TransactionForm open={txFormOpen} onOpenChange={setTxFormOpen} />
      <PaymentForm key={paying?.id ?? "none"} tx={paying} onOpenChange={(o) => !o && setPaying(null)} />
    </>
  );
}
