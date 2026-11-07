"use client";

import { useEffect, useState } from "react";
import { useForm } from "@/components/forms/use-form";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { Segmented } from "@/components/ui/segmented";
import { useToast } from "@/components/ui/toast";
import { addPayment, createTransaction } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { addDays, formatDate, fromInputDate, isoDate } from "@/lib/dates";
import { openAmount, paidAmount } from "@/lib/metrics/finance";
import { paymentInputSchema, transactionInputSchema } from "@/lib/schemas";
import type { Transaction, TransactionKind } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

type TxValues = { kind: TransactionKind; clientId: string; projectId: string; description: string; amount: string; dueDate: string };

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
  const initial: TxValues = {
    kind: defaultKind,
    clientId: project?.clientId ?? "none",
    projectId: project?.id ?? "none",
    description: "",
    amount: "",
    dueDate: isoDate(defaultKind === "custo" ? new Date() : addDays(new Date(), 7)),
  };
  const { values, set, errors, reset, validate, formRef } = useForm<TxValues>(initial);
  // Despesa já paga gera também o pagamento (saída de caixa) na mesma data.
  const [paidNow, setPaidNow] = useState(true);

  useEffect(() => {
    // O formulário é remontado por `key` a cada abertura; aqui só sincroniza os valores.
    if (open) reset(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const projects = (db?.projects ?? []).filter((p) => values.clientId === "none" || p.clientId === values.clientId);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = validate(transactionInputSchema, {
      kind: values.kind,
      clientId: values.clientId === "none" ? null : values.clientId,
      projectId: values.projectId === "none" ? null : values.projectId,
      description: values.description,
      amount: values.amount.replace(",", "."),
      dueDate: values.dueDate ? fromInputDate(values.dueDate) : "",
    });
    if (!data) return;
    const tx = createTransaction(data);
    if (data.kind === "custo" && paidNow) addPayment(tx.id, { amount: data.amount, date: data.dueDate, note: "Despesa paga" });
    notify({
      kind: "success",
      title: values.kind === "receita" ? "Recebível lançado" : paidNow ? "Despesa registrada como paga" : "Despesa lançada a pagar",
      description: `${data.description} · ${formatBRL(data.amount)}`,
    });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Novo lançamento"
      description="Registro manual. Nenhum banco, gateway ou nota fiscal é integrado."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="tx-form">
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
            onChange={(v) => set("kind", v)}
            options={[
              { value: "receita", label: "Recebível do cliente" },
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
        <Field label="Projeto" optional>
          {(p) => <Select {...p} value={values.projectId} onValueChange={(v) => set("projectId", v)} options={[{ value: "none", label: "Sem projeto" }, ...projects.map((x) => ({ value: x.id, label: x.title }))]} />}
        </Field>
        <Field label="Descrição" error={errors.description} className="sm:col-span-2">
          {(p) => <TextInput {...p} value={values.description} onChange={(e) => set("description", e.target.value)} placeholder={values.kind === "receita" ? "Ex.: Saldo 50% — entrega do site" : "Ex.: Registro de domínio"} />}
        </Field>
        <Field label="Valor (R$)" error={errors.amount}>
          {(p) => <TextInput {...p} inputMode="decimal" value={values.amount} onChange={(e) => set("amount", e.target.value)} placeholder="0,00" />}
        </Field>
        <Field label={values.kind === "custo" && paidNow ? "Data do pagamento" : "Vencimento"} error={errors.dueDate}>
          {(p) => <TextInput {...p} type="date" value={values.dueDate} onChange={(e) => set("dueDate", e.target.value)} />}
        </Field>
        {values.kind === "custo" && (
          <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-soft sm:col-span-2">
            <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="size-4 accent-[var(--fin-in)]" />
            Despesa já paga nesta data (gera saída de caixa)
          </label>
        )}
      </form>
    </Modal>
  );
}

export function PaymentForm({ tx, onOpenChange }: { tx: Transaction | null; onOpenChange: (o: boolean) => void }) {
  const { notify } = useToast();
  // O componente é remontado por `key` a cada lançamento, então o estado inicial basta.
  const [amount, setAmount] = useState(() => (tx ? String(openAmount(tx)).replace(".", ",") : ""));
  const [date, setDate] = useState(() => isoDate(new Date()));
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!tx) return null;
  const remaining = openAmount(tx);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = paymentInputSchema.safeParse({ amount: amount.replace(",", "."), date: date ? fromInputDate(date) : "", note });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[String(i.path[0])] ??= i.message));
      return setErrors(errs);
    }
    try {
      addPayment(tx.id, parsed.data);
      const partial = parsed.data.amount < remaining - 0.001;
      notify({ kind: "success", title: partial ? "Pagamento parcial registrado" : "Recebimento registrado", description: `${formatBRL(parsed.data.amount)} em ${formatDate(parsed.data.date)}` });
      onOpenChange(false);
    } catch (err) {
      setErrors({ amount: err instanceof Error ? err.message : "Valor inválido" });
    }
  };

  return (
    <Modal
      open={!!tx}
      onOpenChange={onOpenChange}
      title="Registrar recebimento"
      description={`${tx.description} · total ${formatBRL(tx.amount)} · já recebido ${formatBRL(paidAmount(tx))} · em aberto ${formatBRL(remaining)}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="payment-form">
            Registrar recebimento
          </Button>
        </>
      }
    >
      <form id="payment-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Valor recebido (R$)" error={errors.amount} hint="Valores menores que o saldo ficam como pagamento parcial.">
          {(p) => <TextInput {...p} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <Field label="Data do pagamento" error={errors.date}>
          {(p) => <TextInput {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Observação" optional className="sm:col-span-2">
          {(p) => <TextInput {...p} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Pix, transferência" />}
        </Field>
      </form>
      <p className="mt-4 text-[12px] text-ink-faint">Registro manual: nenhum pagamento é processado pelo sistema.</p>
    </Modal>
  );
}
