import { buildBuckets, startOfDay, sumByBucket, type RangeKey } from "../dates";
import type { Database, Transaction, TransactionStatus } from "../types";
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

/**
 * Separação explícita:
 * - contratado: soma do valor de contrato dos projetos;
 * - faturado: soma das receitas lançadas (não canceladas);
 * - recebido: soma dos pagamentos das receitas;
 * - a receber: saldo aberto das receitas; vencido é a parte com vencimento passado;
 * - custos: soma dos custos lançados.
 */
export function financeSummary(db: Database, now = new Date()) {
  const receitas = db.transactions.filter((t) => t.kind === "receita" && !t.cancelled);
  const custos = db.transactions.filter((t) => t.kind === "custo" && !t.cancelled);
  const contracted = sum(db.projects.map((p) => p.contractValue));
  const invoiced = sum(receitas.map((t) => t.amount));
  const received = sum(receitas.map(paidAmount));
  const open = sum(receitas.map(openAmount));
  const overdue = sum(receitas.filter((t) => transactionStatus(t, now) === "vencido").map(openAmount));
  const costs = sum(custos.map((t) => t.amount));
  const sales = db.projects.length;
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
    db.projects.map((p) => ({ date: p.createdAt, value: p.contractValue })),
  );
  const received = sumByBucket(
    buckets,
    db.transactions
      .filter((t) => t.kind === "receita" && !t.cancelled)
      .flatMap((t) => t.payments.map((p) => ({ date: p.date, value: p.amount }))),
  );
  return { buckets, contracted, received };
}
