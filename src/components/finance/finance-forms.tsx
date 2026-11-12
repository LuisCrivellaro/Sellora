"use client";

import { useState } from "react";
import { useForm } from "@/components/forms/use-form";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { EXPENSE_CATEGORIES, expenseCategoryLabel, PAYMENT_METHODS, paymentMethodLabel } from "@/lib/constants";
import { addPayment, cancelProjectContract, createTransaction, reversePayment, setOpeningBalance, updateTransaction } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { addDays, formatDate, fromInputDate, isoDate, toInputDate } from "@/lib/dates";
import { openAmount, paidAmount } from "@/lib/metrics/finance";
import { openingBalanceSchema, paymentInputSchema, transactionInputSchema } from "@/lib/schemas";
import type { ExpenseCategory, Payment, PaymentMethod, Project, Transaction, TransactionKind } from "@/lib/types";
import { Money } from "@/components/ui/money";

/*
 * Formulários do Financeiro. Todos validam com Zod antes de gravar, mostram a
 * confirmação só depois que o repositório aceitou a operação e travam o botão
 * enquanto gravam (sem lançamento duplicado por clique repetido).
 */

// O Radix Select não aceita item com valor vazio: "none" representa "não informado" na tela.
const NONE = "none";
const methodOptions = [{ value: NONE, label: "Não informada" }, ...PAYMENT_METHODS.map((m) => ({ value: m as string, label: paymentMethodLabel[m] }))];
const asMethod = (v: string) => (v === NONE ? "" : v) as PaymentMethod;
const categoryOptions = [{ value: NONE, label: "Sem categoria" }, ...EXPENSE_CATEGORIES.map((c) => ({ value: c as string, label: expenseCategoryLabel[c] }))];
const asCategory = (v: string) => (v === NONE ? "" : v) as ExpenseCategory;
/** "1.234,56" → "1234.56"; sem vírgula, o ponto é decimal ("1234.56"). */
const toNumber = (v: string) => {
  const s = v.trim();
  return s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
};
const errorText = (err: unknown, fallback = "Não foi possível salvar.") => (err instanceof Error ? err.message : fallback);

type TxValues = {
  kind: TransactionKind;
  clientId: string;
  projectId: string;
  description: string;
  amount: string;
  dueDate: string;
  category: ExpenseCategory;
  notes: string;
  settled: "sim" | "nao";
  method: PaymentMethod;
};

export function TransactionForm({
  open,
  onOpenChange,
  defaultKind = "receita",
  defaultProjectId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultKind?: TransactionKind;
  defaultProjectId?: string | null;
}) {
  const { db } = useStore();
  const { notify } = useToast();
  const project = defaultProjectId ? db?.projects.find((p) => p.id === defaultProjectId) : null;
  // O componente é remontado por `key` a cada abertura: o estado inicial basta.
  const { values, set, errors, setErrors, validate, formRef } = useForm<TxValues>({
    kind: defaultKind,
    clientId: project?.clientId ?? "none",
    projectId: project?.id ?? "none",
    description: "",
    amount: "",
    dueDate: isoDate(defaultKind === "custo" ? new Date() : addDays(new Date(), 7)),
    category: "",
    notes: "",
    settled: defaultKind === "custo" ? "sim" : "nao",
    method: "",
  });
  const [saving, setSaving] = useState(false);
  const isCost = values.kind === "custo";
  const settled = values.settled === "sim";

  const projects = (db?.projects ?? []).filter((p) => values.clientId === "none" || p.clientId === values.clientId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const data = validate(transactionInputSchema, {
      kind: values.kind,
      clientId: values.clientId === "none" ? null : values.clientId,
      projectId: values.projectId === "none" ? null : values.projectId,
      description: values.description,
      amount: toNumber(values.amount),
      dueDate: values.dueDate ? fromInputDate(values.dueDate) : "",
      category: isCost ? values.category : "",
      notes: values.notes,
    });
    if (!data) return;
    setSaving(true);
    try {
      createTransaction(data, settled ? { date: data.dueDate, method: values.method } : undefined);
      notify({
        kind: "success",
        title: isCost ? (settled ? "Despesa paga registrada" : "Despesa a pagar lançada") : settled ? "Recebimento registrado" : "Recebível lançado",
        description: <>{data.description} · <Money value={isCost ? -data.amount : data.amount} /></>,
      });
      onOpenChange(false);
    } catch (err) {
      setErrors({ amount: errorText(err) });
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={isCost ? "Registrar despesa" : "Registrar recebimento"}
      description="Registro manual. Nenhum banco, gateway ou nota fiscal é integrado."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="tx-form" loading={saving} disabled={saving}>
            Salvar lançamento
          </Button>
        </>
      }
    >
      <form id="tx-form" ref={formRef} onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Segmented
            label="Tipo de lançamento"
            size="md"
            value={values.kind}
            onChange={(v) => {
              set("kind", v);
              set("settled", v === "custo" ? "sim" : "nao");
            }}
            options={[
              { value: "receita", label: "Recebimento do cliente" },
              { value: "custo", label: "Despesa" },
            ]}
          />
        </div>
        <Field label="Cliente" optional>
          {(p) => (
            <Select
              {...p}
              value={values.clientId}
              onValueChange={(v) => {
                set("clientId", v);
                set("projectId", "none");
              }}
              options={[{ value: "none", label: "Sem cliente" }, ...(db?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            />
          )}
        </Field>
        <Field label="Projeto vinculado" optional>
          {(p) => <Select {...p} value={values.projectId} onValueChange={(v) => set("projectId", v)} options={[{ value: "none", label: "Sem projeto" }, ...projects.map((x) => ({ value: x.id, label: x.title }))]} />}
        </Field>
        <Field label="Descrição" error={errors.description} className="sm:col-span-2">
          {(p) => <TextInput {...p} value={values.description} onChange={(e) => set("description", e.target.value)} placeholder={isCost ? "Ex.: Registro de domínio" : "Ex.: Saldo 50% — entrega do site"} />}
        </Field>
        {isCost && (
          <Field label="Categoria" className="sm:col-span-2">
            {(p) => <Select {...p} value={values.category || NONE} onValueChange={(v) => set("category", asCategory(v))} options={categoryOptions} />}
          </Field>
        )}
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-[12.5px] font-semibold text-ink-soft">Status</span>
          <Segmented
            label="Status do lançamento"
            size="md"
            value={values.settled}
            onChange={(v) => {
              set("settled", v);
              // Pago/recebido: data de hoje. A receber/pagar: vencimento futuro.
              if (!isCost) set("dueDate", isoDate(v === "sim" ? new Date() : addDays(new Date(), 7)));
            }}
            options={isCost ? [{ value: "sim", label: "Paga" }, { value: "nao", label: "A pagar" }] : [{ value: "nao", label: "A receber (parcela)" }, { value: "sim", label: "Já recebido" }]}
          />
        </div>
        <Field label="Valor (R$)" error={errors.amount}>
          {(p) => <TextInput {...p} moneySign={isCost ? -1 : 1} inputMode="decimal" value={values.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0,00" />}
        </Field>
        <Field label={settled ? (isCost ? "Data do pagamento" : "Data do recebimento") : "Vencimento"} error={errors.dueDate}>
          {(p) => <TextInput {...p} type="date" value={values.dueDate} onChange={(e) => set("dueDate", e.target.value)} />}
        </Field>
        {settled && (
          <Field label="Forma de pagamento" optional className="sm:col-span-2">
            {(p) => <Select {...p} value={values.method || NONE} onValueChange={(v) => set("method", asMethod(v))} options={methodOptions} />}
          </Field>
        )}
        <Field label="Observações" optional error={errors.notes} className="sm:col-span-2">
          {(p) => <TextArea {...p} value={values.notes} onChange={(e) => set("notes", e.target.value)} rows={2} className="min-h-[64px]" />}
        </Field>
        <p className="text-[12px] text-ink-faint sm:col-span-2">
          {settled ? (isCost ? "Entra como saída de caixa nesta data." : "Entra como entrada de caixa nesta data.") : isCost ? "Fica a pagar: só vira saída quando o pagamento for registrado." : "Fica a receber: só vira recebimento quando o pagamento for registrado."}
        </p>
      </form>
    </Modal>
  );
}

export function PaymentForm({ tx, onOpenChange }: { tx: Transaction | null; onOpenChange: (o: boolean) => void }) {
  const { notify } = useToast();
  // O componente é remontado por `key` a cada lançamento, então o estado inicial basta.
  const [amount, setAmount] = useState(() => (tx ? String(openAmount(tx)).replace(".", ",") : ""));
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [method, setMethod] = useState<PaymentMethod>("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  if (!tx) return null;
  const remaining = openAmount(tx);
  const isCost = tx.kind === "custo";
  const sign = isCost ? -1 : 1;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const parsed = paymentInputSchema.safeParse({ amount: toNumber(amount), date: date ? fromInputDate(date) : "", method, note });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] ??= i.message));
      return setErrors(errs);
    }
    setSaving(true);
    try {
      addPayment(tx.id, parsed.data);
      const partial = parsed.data.amount < remaining - 0.001;
      notify({ kind: "success", title: isCost ? (partial ? "Pagamento parcial da despesa registrado" : "Despesa paga") : partial ? "Recebimento parcial registrado" : "Recebimento registrado", description: <><Money value={sign * parsed.data.amount} /> em {formatDate(parsed.data.date)}</> });
      onOpenChange(false);
    } catch (err) {
      setErrors({ amount: errorText(err, "Valor inválido") });
      setSaving(false);
    }
  };

  const verb = isCost ? "pago" : "recebido";
  return (
    <Modal
      open={!!tx}
      onOpenChange={onOpenChange}
      title={isCost ? "Registrar pagamento da despesa" : "Registrar recebimento"}
      description={<>{tx.description} · total <Money value={sign * tx.amount} /> · já {verb} <Money value={sign * paidAmount(tx)} /> · em aberto <Money value={sign * remaining} /></>}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="payment-form" loading={saving} disabled={saving}>
            {isCost ? "Registrar pagamento" : "Registrar recebimento"}
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`Valor ${verb} (R$)`} error={errors.amount} hint="Valores menores que o saldo ficam como pagamento parcial.">
          {(p) => <TextInput {...p} moneySign={sign} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field label="Data do pagamento" error={errors.date}>
          {(p) => <TextInput {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Forma de pagamento" optional>
          {(p) => <Select {...p} value={method || NONE} onValueChange={(v) => setMethod(asMethod(v))} options={methodOptions} />}
        </Field>
        <Field label="Observação" optional error={errors.note}>
          {(p) => <TextInput {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: comprovante nº 123" />}
        </Field>
      </form>
      <p className="mt-4 text-[12px] text-ink-faint">Registro manual: nenhum pagamento é processado pelo sistema.</p>
    </Modal>
  );
}

/** Correção de lançamento com revisão das mudanças antes de gravar. */
export function EditTransactionForm({ tx, onOpenChange }: { tx: Transaction | null; onOpenChange: (o: boolean) => void }) {
  const { db } = useStore();
  const { notify } = useToast();
  const [v, setV] = useState(() => ({
    clientId: tx?.clientId ?? "none",
    projectId: tx?.projectId ?? "none",
    description: tx?.description ?? "",
    amount: tx ? String(tx.amount).replace(".", ",") : "",
    dueDate: toInputDate(tx?.dueDate),
    category: (tx?.category ?? "") as ExpenseCategory,
    notes: tx?.notes ?? "",
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [review, setReview] = useState<string[] | null>(null);
  if (!tx) return null;
  const isCost = tx.kind === "custo";
  const patch = { ...v, clientId: v.clientId === "none" ? null : v.clientId, projectId: v.projectId === "none" ? null : v.projectId, amount: toNumber(v.amount), dueDate: v.dueDate ? fromInputDate(v.dueDate) : "", category: isCost ? v.category : ("" as ExpenseCategory) };
  const projects = (db?.projects ?? []).filter((p) => v.clientId === "none" || p.clientId === v.clientId);
  const upd = <K extends keyof typeof v>(k: K, val: (typeof v)[K]) => {
    setV((s) => ({ ...s, [k]: val }));
    setReview(null);
  };

  const check = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = transactionInputSchema.safeParse({ ...patch, kind: tx.kind });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] ??= i.message));
      return setErrors(errs);
    }
    setErrors({});
    const d = parsed.data;
    const list: string[] = [];
    if (Math.round(d.amount * 100) !== Math.round(tx.amount * 100)) list.push(`Valor: ${tx.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} → ${d.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`);
    if (formatDate(d.dueDate) !== formatDate(tx.dueDate)) list.push(`Vencimento: ${formatDate(tx.dueDate)} → ${formatDate(d.dueDate)}`);
    if (d.description !== tx.description) list.push(`Descrição: “${tx.description}” → “${d.description}”`);
    if (d.clientId !== tx.clientId || d.projectId !== tx.projectId) list.push("Cliente/projeto vinculado alterado");
    if (d.category !== tx.category || d.notes !== tx.notes) list.push("Categoria/observações alteradas");
    if (!list.length) return onOpenChange(false);
    setReview(list);
  };

  const confirm = () => {
    try {
      updateTransaction(tx.id, patch);
      notify({ kind: "success", title: "Lançamento corrigido", description: "A alteração ficou registrada no histórico do cliente/projeto." });
      onOpenChange(false);
    } catch (err) {
      setReview(null);
      setErrors({ amount: errorText(err) });
    }
  };

  return (
    <Modal
      open={!!tx}
      onOpenChange={onOpenChange}
      title="Corrigir lançamento"
      description={`Já ${isCost ? "pago" : "recebido"}: ${paidAmount(tx).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}. O valor não pode ficar abaixo disso.`}
      footer={
        review ? (
          <>
            <Button variant="secondary" onClick={() => setReview(null)}>
              Voltar
            </Button>
            <Button variant="primary" onClick={confirm}>
              Confirmar correção
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="edit-tx-form">
              Revisar alterações
            </Button>
          </>
        )
      }
    >
      {review ? (
        <div className="flex flex-col gap-3">
          <p className="text-[13.5px] text-ink-soft">Confira antes de gravar. A correção fica registrada no histórico, com os valores anteriores.</p>
          <ul className="flex flex-col gap-1.5 rounded-2xl border border-seam p-3 text-[13px] text-ink">
            {review.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : (
        <form id="edit-tx-form" onSubmit={check} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Cliente" optional>
            {(p) => <Select {...p} value={v.clientId} onValueChange={(x) => { upd("clientId", x); upd("projectId", "none"); }} options={[{ value: "none", label: "Sem cliente" }, ...(db?.clients ?? []).map((c) => ({ value: c.id, label: c.name }))]} />}
          </Field>
          <Field label="Projeto vinculado" optional>
            {(p) => <Select {...p} value={v.projectId} onValueChange={(x) => upd("projectId", x)} options={[{ value: "none", label: "Sem projeto" }, ...projects.map((x) => ({ value: x.id, label: x.title }))]} />}
          </Field>
          <Field label="Descrição" error={errors.description} className="sm:col-span-2">
            {(p) => <TextInput {...p} value={v.description} onChange={(e) => upd("description", e.target.value)} />}
          </Field>
          <Field label="Valor (R$)" error={errors.amount}>
            {(p) => <TextInput {...p} moneySign={isCost ? -1 : 1} inputMode="decimal" value={v.amount} onChange={(e) => upd("amount", e.target.value)} />}
          </Field>
          <Field label="Vencimento" error={errors.dueDate}>
            {(p) => <TextInput {...p} type="date" value={v.dueDate} onChange={(e) => upd("dueDate", e.target.value)} />}
          </Field>
          {isCost && (
            <Field label="Categoria" className="sm:col-span-2">
              {(p) => <Select {...p} value={v.category || NONE} onValueChange={(x) => upd("category", asCategory(x))} options={categoryOptions} />}
            </Field>
          )}
          <Field label="Observações" optional error={errors.notes} className="sm:col-span-2">
            {(p) => <TextArea {...p} value={v.notes} onChange={(e) => upd("notes", e.target.value)} rows={2} className="min-h-[64px]" />}
          </Field>
        </form>
      )}
    </Modal>
  );
}

/** Estorno de um pagamento: exige motivo e confirma o impacto antes de gravar. */
export function ReversePaymentForm({ target, onOpenChange }: { target: { tx: Transaction; payment: Payment } | null; onOpenChange: (o: boolean) => void }) {
  const { notify } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (!target) return null;
  const { tx, payment } = target;
  const isCost = tx.kind === "custo";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      reversePayment(tx.id, payment.id, reason);
      notify({ kind: "success", title: "Pagamento estornado", description: <>A {isCost ? "saída" : "entrada"} de <Money value={isCost ? -payment.amount : payment.amount} /> saiu do caixa e o estorno ficou no histórico.</> });
      onOpenChange(false);
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title="Estornar pagamento"
      description={<>{tx.description} · <Money value={isCost ? -payment.amount : payment.amount} /> em {formatDate(payment.date)}</>}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="danger" type="submit" form="reverse-form">
            Estornar pagamento
          </Button>
        </>
      }
    >
      <form id="reverse-form" onSubmit={submit} noValidate className="flex flex-col gap-3">
        <p className="text-[13px] text-ink-soft">Use só para corrigir um registro errado. O valor volta a ficar em aberto e os indicadores são recalculados.</p>
        <Field label="Motivo do estorno" error={error}>
          {(p) => <TextInput {...p} value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder="Ex.: pagamento lançado em duplicidade" />}
        </Field>
      </form>
    </Modal>
  );
}

/** Cancelamento de contrato do projeto, com motivo. */
export function CancelContractForm({ project, onOpenChange }: { project: Project | null; onOpenChange: (o: boolean) => void }) {
  const { notify } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (!project) return null;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      cancelProjectContract(project.id, reason);
      notify({ kind: "success", title: "Contrato cancelado", description: "Deixou de contar como receita contratada. O que já foi recebido continua no caixa." });
      onOpenChange(false);
    } catch (err) {
      setError(errorText(err));
    }
  };
  return (
    <Modal
      open
      onOpenChange={onOpenChange}
      title="Cancelar contrato"
      description={<>{project.title} · contrato de <Money value={project.contractValue} /></>}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Voltar
          </Button>
          <Button variant="danger" type="submit" form="cancel-contract-form">
            Cancelar contrato
          </Button>
        </>
      }
    >
      <form id="cancel-contract-form" onSubmit={submit} noValidate className="flex flex-col gap-3">
        <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-soft">
          <li>O contrato deixa de contar como receita contratada.</li>
          <li>Parcelas sem pagamento são canceladas.</li>
          <li>Parcelas com pagamento parcial são encerradas no valor já recebido.</li>
          <li>Recebimentos já registrados continuam no caixa. Tudo fica no histórico.</li>
        </ul>
        <Field label="Motivo do cancelamento" error={error}>
          {(p) => <TextInput {...p} value={reason} onChange={(e) => { setReason(e.target.value); setError(""); }} placeholder="Ex.: cliente desistiu antes do briefing" />}
        </Field>
      </form>
    </Modal>
  );
}

/** Saldo de caixa informado (ex.: extrato do banco) numa data de referência. */
export function OpeningBalanceForm({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { db } = useStore();
  const { notify } = useToast();
  const current = db?.settings.openingBalance ?? null;
  const [amount, setAmount] = useState(() => (current ? String(current.amount).replace(".", ",") : ""));
  const [date, setDate] = useState(() => (current ? toInputDate(current.date) : isoDate(new Date())));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = openingBalanceSchema.safeParse({ amount: amount.trim() === "" ? undefined : toNumber(amount), date: date ? fromInputDate(date) : "" });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] ??= i.message));
      return setErrors(errs);
    }
    setOpeningBalance(parsed.data);
    notify({ kind: "success", title: "Saldo inicial salvo", description: <><Money value={parsed.data.amount} /> em {formatDate(parsed.data.date)}</> });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Saldo inicial de caixa"
      description="Informe o saldo real da conta (extrato) no início de uma data. O saldo exibido passa a ser esse valor mais as entradas e menos as saídas registradas a partir dela."
      footer={
        <>
          {current && (
            <Button
              variant="ghost"
              className="mr-auto"
              onClick={() => {
                setOpeningBalance(null);
                notify({ kind: "success", title: "Saldo inicial removido", description: "O Financeiro volta a mostrar só a movimentação líquida registrada." });
                onOpenChange(false);
              }}
            >
              Remover saldo
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="opening-form">
            Salvar saldo
          </Button>
        </>
      }
    >
      <form id="opening-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Saldo (R$)" error={errors.amount} hint="Pode ser negativo.">
          {(p) => <TextInput {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />}
        </Field>
        <Field label="Saldo no início do dia" error={errors.date}>
          {(p) => <TextInput {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
