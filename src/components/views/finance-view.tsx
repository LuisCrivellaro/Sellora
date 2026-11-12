"use client";

import { ArrowDownRight, ArrowUpRight, CircleDollarSign, ExternalLink, Eye, List, MoreHorizontal, Ban, Pencil, RotateCcw, Receipt } from "lucide-react";
import Link from "next/link";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { CashFlowChart, type FlowMode } from "@/components/finance/cash-flow-chart";
import { FinCard, FinLabel, GrowBar, MiniBars, PillGroup, RingIndicator } from "@/components/finance/fin-ui";
import { CancelContractForm, EditTransactionForm, OpeningBalanceForm, PaymentForm, ReversePaymentForm, TransactionForm } from "@/components/finance/finance-forms";
import { useUrlParams } from "@/components/shared/use-url-state";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/field";
import { ConfirmDialog, Menu, Modal } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { expenseCategoryLabel, paymentMethodLabel, transactionStatusMeta } from "@/lib/constants";
import { reactivateProjectContract, setTransactionCancelled } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { formatDate, formatRelative, RANGE_OPTIONS, type RangeKey } from "@/lib/dates";
import { cashFlow, cashMovements, financeSummary, lastPaymentDate, openAmount, paidAmount, projectResults, receivablesAging, transactionStatus, upcomingReceivables, variation } from "@/lib/metrics/finance";
import { cardEntrance, motionTokens, useMotionEnabled } from "@/lib/motion";
import type { Payment, Project, Transaction } from "@/lib/types";
import { cn, formatBRL, formatPercent, matchesQuery } from "@/lib/utils";
import { Money } from "@/components/ui/money";

type StatusFilter = "todos" | "pendente" | "parcial" | "vencido" | "pago" | "custo" | "cancelado";

function Delta({ value, inverse = false }: { value: number | null; inverse?: boolean }) {
  if (value === null) return <span className="text-[11.5px] text-[var(--fin-neutral)]">Sem comparação disponível</span>;
  const up = value >= 0;
  const good = inverse ? !up : up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("tnum inline-flex items-center gap-0.5 text-[11.5px] font-semibold", good ? "text-[var(--fin-in)]" : "text-danger")}>
      <Icon className="size-3.5" aria-hidden />
      {formatPercent(Math.abs(value))} vs período anterior
    </span>
  );
}

export function FinanceView() {
  const { db, mode: dataMode } = useStore();
  const { params, setParams } = useUrlParams();
  const { notify } = useToast();
  const enabled = useMotionEnabled();
  const [range, setRange] = useState<RangeKey>("90d");
  const [mode, setMode] = useState<FlowMode>("tudo");
  const [txForm, setTxForm] = useState<{ kind: "receita" | "custo"; projectId?: string | null } | null>(null);
  const [paying, setPaying] = useState<Transaction | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [reversing, setReversing] = useState<{ tx: Transaction; payment: Payment } | null>(null);
  const [confirmCancel, setConfirmCancel] = useState<Transaction | null>(null);
  const [cancellingContract, setCancellingContract] = useState<Project | null>(null);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [picker, setPicker] = useState(false);
  const [movesOpen, setMovesOpen] = useState(params.get("status") !== null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>((params.get("status") as StatusFilter) ?? "todos");
  const projectId = params.get("projeto");

  const data = useMemo(() => {
    if (!db) return null;
    return {
      flow: cashFlow(db, range),
      summary: financeSummary(db),
      aging: receivablesAging(db),
      upcoming: upcomingReceivables(db),
      results: projectResults(db),
      moves: cashMovements(db).slice(0, 6),
    };
  }, [db, range]);

  if (!db || !data) return <PageSkeleton rows={[["col-span-12 h-[140px]"], ["col-span-12 xl:col-span-3 h-[420px]", "col-span-12 xl:col-span-9 h-[420px]"]]} />;
  const { flow, summary, aging } = data;
  const rangeInfo = RANGE_OPTIONS.find((r) => r.value === range)!;
  const clientName = (id: string | null) => (id ? (db.clients.find((c) => c.id === id)?.name ?? "—") : "—");
  const projectTitle = (id: string | null) => (id ? (db.projects.find((p) => p.id === id)?.title ?? "—") : "—");
  const flowMax = Math.max(flow.period.inflow, flow.period.outflow, 1);
  const receivedShare = summary.invoiced > 0 ? Math.min(1, summary.received / summary.invoiced) : 0;
  const contractedVar = variation(flow.period.contracted, flow.previous.contracted);
  const selectedProject = projectId ? data.results.find((r) => r.project.id === projectId) : null;
  const detail = detailId ? (db.transactions.find((t) => t.id === detailId) ?? null) : null;
  const opening = db.settings.openingBalance;
  const balanceLabel = flow.balanceKind === "saldo" ? "Saldo de caixa acumulado" : "Movimentação líquida acumulada";

  /** Erros de regra (ex.: cancelar lançamento já pago) aparecem como aviso, sem quebrar a tela. */
  const run = (fn: () => void, success: { title: string; description?: string }) => {
    try {
      fn();
      notify({ kind: "success", ...success });
    } catch (err) {
      notify({ kind: "error", title: "Não foi possível concluir", description: err instanceof Error ? err.message : undefined });
    }
  };

  const rows = db.transactions.filter((t) => {
    const st = transactionStatus(t);
    const ok =
      status === "todos" ||
      (status === "custo" ? t.kind === "custo" && !t.cancelled
        : status === "cancelado" ? t.cancelled
        : t.kind === "receita" && (status === "pendente" ? ["a_receber", "parcial", "vencido"].includes(st) : st === status));
    return ok && matchesQuery(query, t.description, clientName(t.clientId), projectTitle(t.projectId), t.notes);
  });
  const columns: Column<Transaction>[] = [
    { key: "client", header: "Cliente", sortValue: (t) => clientName(t.clientId), cell: (t) => <span className="font-semibold">{clientName(t.clientId)}</span> },
    { key: "desc", header: "Descrição", sortValue: (t) => t.description, cell: (t) => <span className="block max-w-[240px] truncate">{t.description}</span> },
    { key: "amount", header: "Valor", align: "right", sortValue: (t) => t.kind === "custo" ? -t.amount : t.amount, cell: (t) => <Money value={t.kind === "custo" ? -t.amount : t.amount} className="font-semibold" /> },
    { key: "due", header: "Vencimento", sortValue: (t) => t.dueDate, cell: (t) => <span className="tnum">{formatDate(t.dueDate)}</span> },
    { key: "paid", header: "Pagamento", hideBelow: "lg", sortValue: (t) => lastPaymentDate(t) ?? "", cell: (t) => <span className="tnum">{formatDate(lastPaymentDate(t))}</span> },
    { key: "status", header: "Status", sortValue: (t) => transactionStatus(t), cell: (t) => (t.kind === "custo" ? <StatusBadge tone="indigo" label={t.cancelled ? "Cancelada" : "Despesa"} /> : <StatusBadge tone={transactionStatusMeta[transactionStatus(t)].tone} label={transactionStatusMeta[transactionStatus(t)].label} />) },
  ];

  return (
    <>
      {/* A — Cabeçalho financeiro */}
      <motion.header {...cardEntrance(0, enabled)} className="mb-6 grid grid-cols-1 items-end gap-x-10 gap-y-6 lg:grid-cols-[1.05fr_1fr_1.15fr]">
        <div>
          <h1 className="text-[40px] leading-[1.02] font-extrabold tracking-[-0.035em] text-ink sm:text-[48px]">
            Gestão
            <br />
            Financeira
          </h1>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" className="border-[var(--fin-border-strong)]" onClick={() => setPicker(true)}>
              <CircleDollarSign aria-hidden /> Registrar recebimento
            </Button>
            <Button size="sm" variant="secondary" className="border-[var(--fin-border-strong)]" onClick={() => setTxForm({ kind: "custo" })}>
              <Receipt aria-hidden /> Registrar despesa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMovesOpen(true)}>
              <List aria-hidden /> Movimentações
            </Button>
          </div>
        </div>
        <div>
          {flow.cashBalance !== null && opening ? (
            <>
              <FinLabel>Saldo de caixa registrado</FinLabel>
              <Money animated value={flow.cashBalance} className="mt-1 block text-[36px] leading-none font-extrabold tracking-[-0.03em] sm:text-[42px]" />
              <p className="mt-2 text-[12px] text-[var(--fin-neutral)]">
                Saldo informado de <Money value={opening.amount} /> em {formatDate(opening.date)} + entradas − saídas registradas.{" "}
                <button type="button" onClick={() => setOpeningOpen(true)} className="font-semibold text-[var(--fin-in)] hover:underline">
                  Alterar
                </button>
              </p>
            </>
          ) : (
            <>
              <FinLabel>Movimentação líquida registrada</FinLabel>
              <Money animated value={flow.netMovement} className="mt-1 block text-[36px] leading-none font-extrabold tracking-[-0.03em] sm:text-[42px]" />
              <p className="mt-2 text-[12px] text-[var(--fin-neutral)]">
                Entradas − saídas registradas. Saldo inicial não informado: não é saldo bancário.{" "}
                <button type="button" onClick={() => setOpeningOpen(true)} className="font-semibold text-[var(--fin-in)] hover:underline">
                  Informar saldo inicial
                </button>
              </p>
            </>
          )}
        </div>
        <div className="grid gap-4">
          {[
            { label: "Saídas no período", value: flow.period.outflow, prev: flow.previous.outflow, color: "var(--fin-out)", inverse: true },
            { label: "Entradas no período", value: flow.period.inflow, prev: flow.previous.inflow, color: "var(--fin-in)", inverse: false },
          ].map((m) => (
            <div key={m.label}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <FinLabel>{m.label}</FinLabel>
                <Money value={m.inverse ? -m.value : m.value} className="text-[17px] font-bold" />
              </div>
              <GrowBar value={m.value / flowMax} color={m.color} label={m.label} valueText={formatBRL(m.value)} />
              <div className="mt-1 flex justify-between">
                <span className="text-[11.5px] text-[var(--fin-neutral)]">{rangeInfo.description}</span>
                <Delta value={variation(m.value, m.prev)} inverse={m.inverse} />
              </div>
            </div>
          ))}
        </div>
      </motion.header>

      {/* B + C — cards à esquerda e gráfico principal */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[300px_1fr]">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 xl:grid-cols-1">
          <FinCard index={1} interactive label="Receita contratada">
            <FinLabel>Receita contratada</FinLabel>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Money animated value={flow.period.contracted} className="block text-[24px] leading-tight font-bold" />
                <p className="mt-1 text-[11.5px] text-[var(--fin-neutral)]">Contratos fechados (não cancelados) · {rangeInfo.label}</p>
              </div>
              {contractedVar !== null ? (
                <RingIndicator value={Math.min(1, flow.period.contracted / (flow.previous.contracted || 1))} label={`Contratado no período equivale a ${formatPercent(contractedVar + 100)} do período anterior`}>
                  {contractedVar >= 0 ? "+" : "−"}
                  {Math.abs(Math.round(contractedVar))}%
                </RingIndicator>
              ) : (
                <span className="max-w-[90px] text-right text-[11px] text-[var(--fin-neutral)]">Sem comparação disponível</span>
              )}
            </div>
            <p className="mt-3 text-[11px] text-[var(--fin-neutral)]">Contratado não é caixa: entra no saldo só quando recebido.</p>
          </FinCard>

          <FinCard index={2} interactive label="Recebimentos">
            <FinLabel>Recebimentos</FinLabel>
            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <Money animated value={summary.received} className="block text-[24px] leading-tight font-bold" />
                <p className="mt-1 text-[11.5px] text-[var(--fin-neutral)]">Acumulado · de <Money value={summary.invoiced} /> faturados</p>
              </div>
              {summary.invoiced > 0 ? (
                <RingIndicator value={receivedShare} label={`${formatPercent(receivedShare * 100)} dos recebíveis lançados já quitados`}>
                  {Math.round(receivedShare * 100)}%
                </RingIndicator>
              ) : (
                <span className="max-w-[90px] text-right text-[11px] text-[var(--fin-neutral)]">Sem dados disponíveis</span>
              )}
            </div>
            <p className="mt-3 text-[11px] text-[var(--fin-neutral)]">Só pagamentos registrados como recebidos. Anel: parcela do faturado já recebida.</p>
          </FinCard>

          <FinCard index={3} interactive label="Pagamentos pendentes">
            <div className="flex items-start justify-between gap-2">
              <FinLabel>Pagamentos pendentes</FinLabel>
              {aging.overdueCount > 0 && <span className="rounded-full bg-[rgba(217,103,123,0.14)] px-2 py-0.5 text-[11px] font-semibold text-[#ff8da2]">{aging.overdueCount} vencida{aging.overdueCount > 1 ? "s" : ""}</span>}
            </div>
            <Money animated value={aging.total} className="mt-2 block text-[24px] leading-tight font-bold" />
            <p className="mt-1 text-[11.5px] text-[var(--fin-neutral)]">{aging.count} {aging.count === 1 ? "parcela" : "parcelas"} em aberto, por vencimento</p>
            <dl className="mt-2 mb-3 grid grid-cols-3 gap-2 text-[11px] text-[var(--fin-neutral)]">
              <div>
                <dt>A vencer</dt>
                <dd className="tnum font-semibold text-ink"><Money value={aging.notDue} /></dd>
              </div>
              <div>
                <dt>Vencidos</dt>
                <dd className="tnum font-semibold text-ink"><Money value={aging.overdue} /></dd>
              </div>
              <div>
                <dt>Parciais ({aging.partialCount})</dt>
                <dd className="tnum font-semibold text-ink"><Money value={aging.partial} /></dd>
              </div>
            </dl>
            <MiniBars items={aging.buckets.map((b) => ({ ...b, tone: b.key === "vencido" ? ("danger" as const) : ("default" as const) }))} format={formatBRL} />
          </FinCard>
        </div>

        <FinCard index={4} className="facade-lit min-h-[440px] p-5 sm:p-6" label="Fluxo financeiro">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <PillGroup<FlowMode>
              label="Séries do gráfico"
              value={mode}
              onChange={setMode}
              options={[
                { value: "tudo", label: "Tudo" },
                { value: "entradas", label: "Entradas" },
                { value: "saidas", label: "Saídas" },
                { value: "saldo", label: "Saldo", title: flow.balanceKind === "saldo" ? "Saldo de caixa: saldo inicial informado + entradas − saídas" : "Movimentação líquida acumulada (entradas − saídas); saldo inicial não informado" },
              ]}
            />
            <PillGroup<RangeKey> size="sm" label="Período" value={range} onChange={setRange} options={RANGE_OPTIONS.map((r) => ({ value: r.value, label: r.label, title: r.description }))} />
          </div>
          <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-ink-soft">
            {mode !== "saldo" && mode !== "saidas" && (
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-4 rounded bg-[var(--fin-in)]" aria-hidden /> Entradas <b className="tnum text-ink"><Money value={flow.period.inflow} compact /></b>
              </span>
            )}
            {mode !== "saldo" && mode !== "entradas" && (
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-4 rounded bg-[var(--fin-out)]" aria-hidden /> Saídas <b><Money value={-flow.period.outflow} compact /></b>
              </span>
            )}
            {mode === "saldo" && (
              <span>
                {flow.balanceKind === "saldo" ? "Saldo de caixa" : "Movimentação líquida acumulada (sem saldo inicial)"} a partir de <Money value={flow.openingBalance} /> antes do período
              </span>
            )}
            <span className="ml-auto text-[var(--fin-neutral)]">{rangeInfo.description}</span>
          </div>
          <CashFlowChart
            buckets={flow.buckets}
            inflow={flow.inflow}
            outflow={flow.outflow}
            balance={flow.balance}
            mode={mode}
            animationKey={`${range}-${mode}`}
            height={390}
            balanceLabel={balanceLabel}
            emptyState={
              <div className="absolute inset-x-4 top-[30%] flex flex-col items-center gap-3 text-center">
                <p className="text-[13.5px] font-semibold text-ink">Nenhuma movimentação financeira registrada neste período.</p>
                <p className="max-w-[420px] text-[12px] text-[var(--fin-neutral)]">O gráfico mostra só pagamentos registrados. Nenhuma curva é estimada.</p>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button size="sm" variant="secondary" className="border-[var(--fin-border-strong)]" onClick={() => setPicker(true)}>
                    <CircleDollarSign aria-hidden /> Registrar recebimento
                  </Button>
                  <Button size="sm" variant="secondary" className="border-[var(--fin-border-strong)]" onClick={() => setTxForm({ kind: "custo" })}>
                    <Receipt aria-hidden /> Registrar despesa
                  </Button>
                </div>
              </div>
            }
          />
        </FinCard>
      </div>

      {/* D — cards inferiores */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <FinCard index={5} label="Recebimentos futuros">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">Recebimentos futuros</h2>
            <button type="button" onClick={() => { setStatus("pendente"); setMovesOpen(true); }} className="text-[12px] font-semibold text-[var(--fin-in)] hover:underline">
              Ver todos
            </button>
          </div>
          {data.upcoming.length === 0 ? (
            <EmptyState title="Nada a receber" description="Lance a entrada e o saldo de cada projeto contratado." />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--fin-border)]">
              {data.upcoming.map(({ tx, open, status: st }) => (
                <li key={tx.id} className="flex items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink">{clientName(tx.clientId)}</p>
                    <p className="truncate text-[11.5px] text-[var(--fin-neutral)]">
                      {projectTitle(tx.projectId)} · vence {formatDate(tx.dueDate)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-[13.5px] font-bold text-ink"><Money value={open} /></p>
                    <StatusBadge size="sm" tone={transactionStatusMeta[st].tone} label={transactionStatusMeta[st].label} />
                  </div>
                  <Button size="icon-sm" variant="ghost" aria-label={`Registrar recebimento de ${clientName(tx.clientId)}`} onClick={() => setPaying(tx)}>
                    <CircleDollarSign aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </FinCard>

        <FinCard index={6} label="Resultado por projeto">
          <h2 className="mb-3 text-[15px] font-semibold text-ink">Resultado por projeto</h2>
          {data.results.length === 0 ? (
            <EmptyState title="Sem projetos" description="Crie projetos com valor contratado." />
          ) : (
            <ul className="flex flex-col gap-1">
              {data.results.slice(0, 6).map((r) => (
                <li key={r.project.id}>
                  <button type="button" onClick={() => setParams({ projeto: r.project.id })} className="w-full rounded-2xl px-2 py-2 text-left transition-colors hover:bg-white/[0.04]" aria-label={`Detalhes financeiros de ${r.project.title}`}>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-semibold text-ink">{r.project.title}</span>
                      <span className="tnum shrink-0 text-[12px] text-[var(--fin-neutral)]">
                        <b className="text-ink"><Money value={r.received} /></b> / <Money value={r.contracted} />
                      </span>
                    </span>
                    <span className="mt-1.5 block">
                      <GrowBar value={r.receivedShare} color="var(--fin-in)" label={`${r.project.title}: recebido sobre contratado`} valueText={`${formatPercent(r.receivedShare * 100)}`} />
                    </span>
                    <span className="mt-1 block text-[11px] text-[var(--fin-neutral)]">
                      {r.cancelled && <span className="font-semibold text-[#ff8da2]">Contrato cancelado · </span>}
                      {r.result === null ? "Sem custos registrados — resultado não calculado" : <>Custos <Money value={-r.costs} /> · resultado realizado <Money value={r.result} /></>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </FinCard>

        <FinCard index={7} label="Movimentações recentes">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">Movimentações recentes</h2>
            <button type="button" onClick={() => { setStatus("todos"); setMovesOpen(true); }} className="text-[12px] font-semibold text-[var(--fin-in)] hover:underline">
              Ver todas
            </button>
          </div>
          {data.moves.length === 0 ? (
            <EmptyState title="Sem movimentações" description="Recebimentos e despesas pagas aparecem aqui." />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--fin-border)]">
              {data.moves.map((m) => (
                <li key={m.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", m.kind === "entrada" ? "bg-[rgba(168,145,209,0.14)] text-[var(--fin-in)]" : "bg-[rgba(187,107,165,0.14)] text-[var(--fin-out)]")} aria-hidden>
                    {m.kind === "entrada" ? <ArrowDownRight className="size-4" /> : <ArrowUpRight className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{clientName(m.clientId)}</p>
                    <p className="truncate text-[11.5px] text-[var(--fin-neutral)]">
                      {m.description} · {formatRelative(m.date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tnum text-[13.5px] font-bold">
                      <Money value={m.kind === "entrada" ? m.amount : -m.amount} showPlus />
                    </p>
                    <p className="text-[11px] text-[var(--fin-neutral)]">{m.kind === "entrada" ? "Recebimento" : "Despesa paga"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </FinCard>
      </div>

      {/* Escolher recebível para registrar pagamento */}
      <Modal open={picker} onOpenChange={setPicker} title="Registrar recebimento" description="Escolha a parcela em aberto. Valores menores que o saldo ficam como pagamento parcial.">
        {upcomingReceivables(db, new Date(), 100).length === 0 ? (
          <EmptyState title="Nenhuma parcela em aberto" description="Registre um recebimento avulso ou lance uma parcela a receber." action={<Button variant="primary" onClick={() => { setPicker(false); setTxForm({ kind: "receita" }); }}>Novo recebimento</Button>} />
        ) : (
          <>
          <Button size="sm" variant="secondary" className="mb-3" onClick={() => { setPicker(false); setTxForm({ kind: "receita" }); }}>
            <CircleDollarSign aria-hidden /> Novo recebimento (sem parcela)
          </Button>
          <ul className="flex flex-col gap-1.5">
            {upcomingReceivables(db, new Date(), 100).map(({ tx, open, status: st }) => (
              <li key={tx.id}>
                <button type="button" onClick={() => { setPicker(false); setPaying(tx); }} className="flex w-full items-center gap-3 rounded-2xl border border-[var(--fin-border-strong)] px-3.5 py-2.5 text-left hover:bg-white/[0.04]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{clientName(tx.clientId)} — {tx.description}</span>
                    <span className="block text-[12px] text-[var(--fin-neutral)]">vence {formatDate(tx.dueDate)} · {transactionStatusMeta[st].label}</span>
                  </span>
                  <span className="tnum text-[14px] font-bold text-ink"><Money value={open} /></span>
                </button>
              </li>
            ))}
          </ul>
          </>
        )}
      </Modal>

      {/* Movimentações completas */}
      <Modal open={movesOpen} onOpenChange={(o) => { setMovesOpen(o); if (!o && params.get("status")) setParams({ status: null }); }} variant="sheet" size="xl" title="Movimentações" description="Recebíveis e despesas lançados. Registros manuais, sem integração bancária.">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput label="Buscar transações" value={query} onChange={setQuery} placeholder="Cliente, projeto ou descrição…" className="w-full sm:w-[260px]" />
          <Segmented<StatusFilter>
            label="Filtrar por status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "todos", label: "Todos" },
              { value: "pendente", label: "Pendentes" },
              { value: "parcial", label: "Parciais" },
              { value: "vencido", label: "Vencidos" },
              { value: "pago", label: "Recebidos" },
              { value: "custo", label: "Despesas" },
              { value: "cancelado", label: "Cancelados" },
            ]}
          />
        </div>
        <DataTable
          key={`${query}|${status}`}
          rows={rows}
          columns={columns}
          getRowId={(t) => t.id}
          getRowLabel={(t) => t.description}
          caption="Transações"
          pageSize={12}
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
                { label: "Ver detalhes", icon: <Eye />, onSelect: () => setDetailId(t.id) },
                { label: t.kind === "custo" ? "Registrar pagamento da despesa" : "Registrar recebimento", icon: <CircleDollarSign />, disabled: t.cancelled || openAmount(t) <= 0, onSelect: () => setPaying(t) },
                { label: "Corrigir lançamento", icon: <Pencil />, disabled: t.cancelled, onSelect: () => setEditing(t) },
                "separator",
                t.cancelled
                  ? { label: "Reativar lançamento", icon: <RotateCcw />, onSelect: () => run(() => setTransactionCancelled(t.id, false), { title: "Lançamento reativado" }) }
                  : { label: "Cancelar lançamento", icon: <Ban />, destructive: true, disabled: t.payments.length > 0, onSelect: () => setConfirmCancel(t) },
              ]}
            />
          )}
          mobileCard={(t) => (
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-semibold text-ink">{clientName(t.clientId)}</span>
                <span className="block truncate text-[12px] text-ink-faint">{t.description} · vence {formatDate(t.dueDate)}</span>
              </span>
              <Money value={t.kind === "custo" ? -t.amount : t.amount} className="text-[14px] font-bold" />
            </span>
          )}
          empty={<EmptyState title="Nenhuma transação com esses filtros" description="Ajuste a busca ou o status." />}
        />
      </Modal>

      {/* Detalhe financeiro do projeto */}
      <Modal open={!!selectedProject} onOpenChange={(o) => !o && setParams({ projeto: null })} variant="sheet" title={selectedProject?.project.title ?? "Projeto"} description={selectedProject ? `${clientName(selectedProject.project.clientId)} · financeiro do projeto` : undefined}>
        {selectedProject && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                ["Contratado", selectedProject.contracted],
                ["Recebido", selectedProject.received],
                ["Custos", -selectedProject.costs],
                ["Resultado", selectedProject.result],
              ] as const).map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-[var(--fin-border-strong)] p-3">
                  <dt className="text-[11.5px] text-[var(--fin-neutral)]">{k}</dt>
                  <dd className="tnum mt-1 text-[15px] font-bold text-ink">{typeof v === "number" ? <Money value={v} /> : "—"}</dd>
                </div>
              ))}
            </dl>
            {selectedProject.result === null && <p className="text-[12px] text-[var(--fin-neutral)]">Sem custos registrados: o resultado não é calculado para não exibir margem fictícia.</p>}
            {selectedProject.cancelled && (
              <p className="rounded-2xl border border-[rgba(217,103,123,0.35)] px-3 py-2 text-[12.5px] text-[#ff8da2]">
                Contrato cancelado em {formatDate(selectedProject.project.contractCancelledAt)}. Não conta como receita contratada; o já recebido continua no caixa.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => setTxForm({ kind: "receita", projectId: selectedProject.project.id })}>
                <CircleDollarSign aria-hidden /> Lançar parcela/recebimento
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setTxForm({ kind: "custo", projectId: selectedProject.project.id })}>
                <Receipt aria-hidden /> Registrar despesa do projeto
              </Button>
              {selectedProject.cancelled ? (
                <Button size="sm" variant="ghost" onClick={() => run(() => reactivateProjectContract(selectedProject.project.id), { title: "Contrato reativado", description: "Parcelas canceladas não voltam sozinhas: relance o que faltar receber." })}>
                  <RotateCcw aria-hidden /> Reativar contrato
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setCancellingContract(selectedProject.project)}>
                  <Ban aria-hidden /> Cancelar contrato
                </Button>
              )}
              <Button size="sm" variant="ghost" asChild>
                <Link href={`/projetos?id=${selectedProject.project.id}`}>
                  <ExternalLink aria-hidden /> Abrir projeto
                </Link>
              </Button>
            </div>
            <ul className="flex flex-col divide-y divide-[var(--fin-border)]">
              {db.transactions
                .filter((t) => t.projectId === selectedProject.project.id)
                .map((t) => (
                  <li key={t.id} className="flex items-center gap-3 py-2.5">
                    <button type="button" onClick={() => setDetailId(t.id)} className="min-w-0 flex-1 text-left" aria-label={`Detalhes de ${t.description}`}>
                      <span className="block truncate text-[13px] font-semibold text-ink">{t.description}{t.cancelled ? " (cancelado)" : ""}</span>
                      <span className="block text-[11.5px] text-[var(--fin-neutral)]">
                        vence {formatDate(t.dueDate)} · pago <Money value={t.kind === "custo" ? -paidAmount(t) : paidAmount(t)} />
                      </span>
                    </button>
                    <Money value={t.kind === "custo" ? -t.amount : t.amount} className="text-[13px] font-bold" />
                    {openAmount(t) > 0 && !t.cancelled && (
                      <Button size="sm" variant="outline" onClick={() => setPaying(t)}>
                        Registrar
                      </Button>
                    )}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </Modal>

      {/* Detalhe de um lançamento: pagamentos, forma, observações, estorno */}
      <Modal open={!!detail} onOpenChange={(o) => !o && setDetailId(null)} variant="sheet" title={detail?.description ?? "Lançamento"} description={detail ? `${detail.kind === "custo" ? "Despesa" : "Recebível"} · ${clientName(detail.clientId)} · ${projectTitle(detail.projectId)}` : undefined}>
        {detail && (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {([
                ["Valor", detail.kind === "custo" ? -detail.amount : detail.amount],
                [detail.kind === "custo" ? "Pago" : "Recebido", detail.kind === "custo" ? -paidAmount(detail) : paidAmount(detail)],
                ["Em aberto", detail.kind === "custo" ? -openAmount(detail) : openAmount(detail)],
                ["Vencimento", formatDate(detail.dueDate)],
              ] as const).map(([k, v]) => (
                <div key={k} className="rounded-2xl border border-[var(--fin-border-strong)] p-3">
                  <dt className="text-[11.5px] text-[var(--fin-neutral)]">{k}</dt>
                  <dd className="tnum mt-1 text-[15px] font-bold text-ink">{typeof v === "number" ? <Money value={v} /> : v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-[12.5px] text-ink-soft">
              Status:{" "}
              <b className="text-ink">{detail.kind === "custo" ? (detail.cancelled ? "Cancelada" : openAmount(detail) > 0 ? "A pagar" : "Paga") : transactionStatusMeta[transactionStatus(detail)].label}</b>
              {detail.kind === "custo" && <> · Categoria: <b className="text-ink">{expenseCategoryLabel[detail.category]}</b></>}
              {detail.notes && <> · {detail.notes}</>}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={detail.cancelled || openAmount(detail) <= 0} onClick={() => setPaying(detail)}>
                <CircleDollarSign aria-hidden /> {detail.kind === "custo" ? "Registrar pagamento" : "Registrar recebimento"}
              </Button>
              <Button size="sm" variant="ghost" disabled={detail.cancelled} onClick={() => setEditing(detail)}>
                <Pencil aria-hidden /> Corrigir lançamento
              </Button>
            </div>
            <div>
              <h3 className="mb-2 text-[13px] font-semibold text-ink">Pagamentos registrados</h3>
              {detail.payments.length === 0 ? (
                <p className="text-[12.5px] text-[var(--fin-neutral)]">Nenhum pagamento registrado.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-[var(--fin-border)]">
                  {detail.payments.map((p) => (
                    <li key={p.id} className="flex items-center gap-3 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] font-semibold text-ink">{formatDate(p.date)} · {paymentMethodLabel[p.method]}</span>
                        {p.note && <span className="block truncate text-[11.5px] text-[var(--fin-neutral)]">{p.note}</span>}
                      </span>
                      <Money value={detail.kind === "custo" ? -p.amount : p.amount} className="text-[13px] font-bold" />
                      <Button size="sm" variant="outline" onClick={() => setReversing({ tx: detail, payment: p })}>
                        Estornar
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-[11.5px] text-[var(--fin-neutral)]">Correções, estornos e cancelamentos ficam registrados no histórico do cliente/projeto. Lançamentos não são apagados.</p>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirmCancel}
        onOpenChange={(o) => !o && setConfirmCancel(null)}
        title="Cancelar lançamento?"
        description={confirmCancel ? <>“{confirmCancel.description}” (<Money value={confirmCancel.amount} />) deixa de contar nos indicadores. O registro não é apagado e pode ser reativado; o cancelamento fica no histórico.</> : ""}
        confirmLabel="Cancelar lançamento"
        onConfirm={() => confirmCancel && run(() => setTransactionCancelled(confirmCancel.id, true), { title: "Lançamento cancelado", description: "Deixa de contar nos indicadores." })}
      />

      <TransactionForm key={txForm ? `tx-${txForm.kind}-${txForm.projectId ?? ""}` : "tx-none"} open={!!txForm} onOpenChange={(o) => !o && setTxForm(null)} defaultKind={txForm?.kind ?? "receita"} defaultProjectId={txForm?.projectId ?? null} />
      <PaymentForm key={paying ? `pay-${paying.id}` : "pay-none"} tx={paying} onOpenChange={(o) => !o && setPaying(null)} />
      <EditTransactionForm key={editing ? `edit-${editing.id}-${editing.updatedAt}` : "edit-none"} tx={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <ReversePaymentForm key={reversing ? `rev-${reversing.payment.id}` : "rev-none"} target={reversing} onOpenChange={(o) => !o && setReversing(null)} />
      <CancelContractForm key={cancellingContract ? `cc-${cancellingContract.id}` : "cc-none"} project={cancellingContract} onOpenChange={(o) => !o && setCancellingContract(null)} />
      <OpeningBalanceForm key={openingOpen ? "ob-open" : "ob-closed"} open={openingOpen} onOpenChange={setOpeningOpen} />
      <p className="mt-6 text-[11.5px] text-[var(--fin-neutral)]" style={{ transitionDuration: `${motionTokens.ui}s` }}>
        Valores {db.demo ? "fictícios do modo demonstração" : dataMode === "supabase" ? "registrados manualmente no banco de dados" : "registrados manualmente neste navegador"}. Nenhum banco, gateway ou emissão fiscal está conectado.
      </p>
    </>
  );
}
