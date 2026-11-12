import { buildBuckets, startOfDay, sumByBucket, type RangeKey } from "../dates";
import type { Database, Project, Transaction, TransactionStatus } from "../types";
import { round2, sum } from "../utils";

export function paidAmount(tx: Transaction) {
  return round2(sum(tx.payments.map((p) => p.amount)));
}

export function openAmount(tx: Transaction) {
  return tx.cancelled ? 0 : round2(Math.max(0, tx.amount - paidAmount(tx)));
}

export function lastPaymentDate(tx: Transaction): string | null {
  if (!tx.payments.length) return null;
  return tx.payments.map((p) => p.date).sort().at(-1) ?? null;
}

/** Status derivado do lançamento (vencido = saldo aberto e vencimento anterior a hoje). */
export function transactionStatus(tx: Transaction, now = new Date()): TransactionStatus {
  if (tx.cancelled) return "cancelado";
  const paid = paidAmount(tx);
  if (paid >= tx.amount - 0.001) return "pago";
  if (new Date(tx.dueDate) < startOfDay(now)) return "vencido";
  if (paid > 0) return "parcial";
  return "a_receber";
}

/** Valor contratado que vale como receita: contrato cancelado conta zero. */
export function contractValueOf(p: Project): number {
  return p.contractCancelledAt ? 0 : p.contractValue;
}

export function activeContracts(db: Database): Project[] {
  return db.projects.filter((p) => !p.contractCancelledAt && p.contractValue > 0);
}

/**
 * Separação explícita:
 * - contratado: soma do valor dos contratos (projetos) não cancelados;
 * - faturado: soma das receitas lançadas (não canceladas);
 * - recebido: soma dos pagamentos registrados em receitas (dinheiro que entrou);
 * - a receber: saldo aberto das receitas; vencido é a parte com vencimento passado;
 * - custos: soma dos custos lançados.
 */
export function financeSummary(db: Database, now = new Date()) {
  const receitas = db.transactions.filter((t) => t.kind === "receita" && !t.cancelled);
  const custos = db.transactions.filter((t) => t.kind === "custo" && !t.cancelled);
  const contracts = activeContracts(db);
  const contracted = sum(contracts.map((p) => p.contractValue));
  const invoiced = sum(receitas.map((t) => t.amount));
  // Pagamento registrado é dinheiro que entrou, mesmo que o lançamento seja cancelado depois.
  const received = sum(db.transactions.filter((t) => t.kind === "receita").map(paidAmount));
  const open = sum(receitas.map(openAmount));
  const overdue = sum(receitas.filter((t) => transactionStatus(t, now) === "vencido").map(openAmount));
  const costs = sum(custos.map((t) => t.amount));
  const sales = contracts.length;
  return {
    contracted: round2(contracted),
    invoiced: round2(invoiced),
    received: round2(received),
    open: round2(open),
    overdue: round2(overdue),
    toReceive: round2(open - overdue),
    costs: round2(costs),
    sales,
    averageTicket: sales > 0 ? round2(contracted / sales) : null,
  };
}

export function financeSeries(db: Database, range: RangeKey, now = new Date()) {
  const buckets = buildBuckets(range, now);
  const contracted = sumByBucket(
    buckets,
    activeContracts(db).map((p) => ({ date: p.createdAt, value: p.contractValue })),
  );
  const received = sumByBucket(
    buckets,
    db.transactions
      .filter((t) => t.kind === "receita")
      .flatMap((t) => t.payments.map((p) => ({ date: p.date, value: p.amount }))),
  );
  return { buckets, contracted, received };
}

/* ───────────── Fluxo de caixa (página Financeiro) ─────────────
 * Entradas = pagamentos registrados em receitas (dinheiro que entrou).
 * Saídas   = pagamentos registrados em custos (dinheiro que saiu).
 * Pagamentos contam pela data do pagamento, inclusive em lançamento cancelado
 * depois (o dinheiro já se moveu; para desfazer, estorna-se o pagamento).
 *
 * Saldo:
 * - com saldo inicial informado (valor V na data D):
 *   saldo(t) = V + líquido(movimentos < t) − líquido(movimentos < início de D).
 *   É o saldo de caixa reconstruído a partir do saldo informado.
 * - sem saldo informado: só a movimentação líquida registrada (entradas −
 *   saídas). Nunca é apresentada como saldo bancário.
 * Contratos não recebidos nunca entram no caixa.
 */

export interface CashMovement {
  id: string;
  transactionId: string;
  kind: "entrada" | "saida";
  amount: number;
  date: string;
  description: string;
  clientId: string | null;
  projectId: string | null;
}

export function cashMovements(db: Database): CashMovement[] {
  return db.transactions
    .flatMap((t) =>
      t.payments.map((p) => ({
        id: p.id,
        transactionId: t.id,
        kind: t.kind === "receita" ? ("entrada" as const) : ("saida" as const),
        amount: p.amount,
        date: p.date,
        description: t.description,
        clientId: t.clientId,
        projectId: t.projectId,
      })),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function rangeBounds(range: RangeKey, now = new Date()) {
  const buckets = buildBuckets(range, now);
  const start = buckets[0].start;
  const end = buckets[buckets.length - 1].end;
  return { buckets, start, end, prevStart: start - (end - start), prevEnd: start };
}

const within = (iso: string | null | undefined, from: number, to: number) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from && t < to;
};

/** Variação percentual só quando existe base anterior (> 0). */
export function variation(current: number, previous: number): number | null {
  return previous > 0 ? ((current - previous) / previous) * 100 : null;
}

const signed = (m: CashMovement) => (m.kind === "entrada" ? m.amount : -m.amount);

export function cashFlow(db: Database, range: RangeKey, now = new Date()) {
  const { buckets, start, end, prevStart, prevEnd } = rangeBounds(range, now);
  const moves = cashMovements(db);
  const inflow = sumByBucket(buckets, moves.filter((m) => m.kind === "entrada").map((m) => ({ date: m.date, value: m.amount })));
  const outflow = sumByBucket(buckets, moves.filter((m) => m.kind === "saida").map((m) => ({ date: m.date, value: m.amount })));
  const netBefore = (t: number) => sum(moves.filter((m) => new Date(m.date).getTime() < t).map(signed));

  const opening = db.settings.openingBalance;
  // Ajuste que transforma "líquido acumulado" em saldo de caixa a partir do saldo informado.
  const offset = opening ? opening.amount - netBefore(startOfDay(opening.date).getTime()) : 0;
  const before = round2(netBefore(start) + offset);
  let acc = before;
  const balance = inflow.map((v, i) => (acc = round2(acc + v - outflow[i])));
  const total = (kind: CashMovement["kind"], from: number, to: number) => round2(sum(moves.filter((m) => m.kind === kind && within(m.date, from, to)).map((m) => m.amount)));
  const contracted = (from: number, to: number) => round2(sum(activeContracts(db).filter((p) => within(p.createdAt, from, to)).map((p) => p.contractValue)));
  const net = round2(sum(moves.map(signed)));
  return {
    buckets,
    inflow: inflow.map(round2),
    outflow: outflow.map(round2),
    balance,
    /** "saldo" quando há saldo inicial informado; "liquido" = só movimentação registrada. */
    balanceKind: opening ? ("saldo" as const) : ("liquido" as const),
    openingBalance: before,
    /** Houve alguma entrada ou saída no período selecionado. */
    hasMovement: inflow.some((v) => v > 0) || outflow.some((v) => v > 0),
    /** Existe ao menos um registro no período anterior (base de comparação). */
    hasPrevious: moves.some((m) => within(m.date, prevStart, prevEnd)) || activeContracts(db).some((p) => within(p.createdAt, prevStart, prevEnd)),
    period: { inflow: total("entrada", start, end), outflow: total("saida", start, end), contracted: contracted(start, end) },
    previous: { inflow: total("entrada", prevStart, prevEnd), outflow: total("saida", prevStart, prevEnd), contracted: contracted(prevStart, prevEnd) },
    /** Movimentação líquida de todos os registros (entradas − saídas). */
    netMovement: net,
    /** Saldo de caixa até agora; null quando o saldo inicial não foi informado. */
    cashBalance: opening ? round2(net + offset) : null,
  };
}

/** Recebíveis em aberto: a vencer, vencidos e parcialmente recebidos, com faixas de vencimento. */
export function receivablesAging(db: Database, now = new Date()) {
  const today = startOfDay(now).getTime();
  const day = 86_400_000;
  const open = db.transactions.filter((t) => t.kind === "receita" && openAmount(t) > 0);
  const bucket = (from: number, to: number) => round2(sum(open.filter((t) => { const d = new Date(t.dueDate).getTime(); return d >= from && d < to; }).map(openAmount)));
  const overdue = open.filter((t) => transactionStatus(t, now) === "vencido");
  const partial = open.filter((t) => paidAmount(t) > 0);
  return {
    total: round2(sum(open.map(openAmount))),
    overdueCount: overdue.length,
    overdue: round2(sum(overdue.map(openAmount))),
    notDue: round2(sum(open.filter((t) => transactionStatus(t, now) !== "vencido").map(openAmount))),
    /** Parcelas com pagamento parcial (saldo restante; podem estar vencidas ou não). */
    partialCount: partial.length,
    partial: round2(sum(partial.map(openAmount))),
    count: open.length,
    buckets: [
      { key: "vencido", label: "Vencido", value: bucket(-Infinity, today) },
      { key: "7d", label: "7 dias", value: bucket(today, today + 8 * day) },
      { key: "30d", label: "30 dias", value: bucket(today + 8 * day, today + 31 * day) },
      { key: "mais", label: "30+ dias", value: bucket(today + 31 * day, Infinity) },
    ],
  };
}

/** Próximos recebimentos: abertos, ordenados por vencimento (vencidos primeiro). */
export function upcomingReceivables(db: Database, now = new Date(), limit = 6) {
  return db.transactions
    .filter((t) => t.kind === "receita" && openAmount(t) > 0)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, limit)
    .map((t) => ({ tx: t, open: openAmount(t), status: transactionStatus(t, now) }));
}

/**
 * Resultado por projeto: contratado, recebido e custos registrados.
 * Resultado realizado = recebido − custos pagos, só quando houver custo
 * registrado; sem custos, não se calcula margem.
 */
export function projectResults(db: Database) {
  return db.projects
    .map((p) => {
      const txs = db.transactions.filter((t) => t.projectId === p.id && !t.cancelled);
      const received = round2(sum(txs.filter((t) => t.kind === "receita").map(paidAmount)));
      const costs = round2(sum(txs.filter((t) => t.kind === "custo").map((t) => t.amount)));
      const costsPaid = round2(sum(txs.filter((t) => t.kind === "custo").map(paidAmount)));
      const hasCosts = txs.some((t) => t.kind === "custo");
      return {
        project: p,
        cancelled: !!p.contractCancelledAt,
        contracted: contractValueOf(p),
        received,
        costs,
        result: hasCosts ? round2(received - costsPaid) : null,
        receivedShare: p.contractValue > 0 ? Math.min(1, received / p.contractValue) : 0,
      };
    })
    .sort((a, b) => b.contracted - a.contracted);
}
