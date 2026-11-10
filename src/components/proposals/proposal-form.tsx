"use client";

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "@/components/forms/use-form";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { packageOrder, PROPOSAL_STATUSES, proposalStatusMeta } from "@/lib/constants";
import { createProposal, updateProposal } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { addDays, fromInputDate, isoDate, toInputDate } from "@/lib/dates";
import { proposalInputSchema } from "@/lib/schemas";
import type { PackageId, Proposal, ProposalStatus } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { Money } from "@/components/ui/money";

interface ItemValue {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
}

type Values = {
  recipient: string; // "lead:ID" | "client:ID" | "livre"
  recipientName: string;
  title: string;
  packageId: PackageId;
  items: ItemValue[];
  scope: string;
  discount: string;
  deadlineDays: string;
  revisions: string;
  paymentTerms: string;
  exclusions: string;
  validUntil: string;
  status: ProposalStatus;
  nextAction: string;
  notes: string;
};

const num = (s: string) => Number(String(s).replace(",", ".")) || 0;

export function ProposalForm({
  open,
  onOpenChange,
  proposal,
  defaultLeadId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  proposal?: Proposal | null;
  defaultLeadId?: string | null;
  onSaved?: (p: Proposal) => void;
}) {
  const { db } = useStore();
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);
  const packages = db?.settings.packages ?? [];

  const initial = (): Values => {
    const lead = defaultLeadId ? db?.leads.find((l) => l.id === defaultLeadId) : null;
    const pkg = packages.find((p) => p.id === (proposal?.packageId ?? "profissional"));
    return {
      recipient: proposal ? (proposal.clientId ? `client:${proposal.clientId}` : proposal.leadId ? `lead:${proposal.leadId}` : "livre") : lead ? `lead:${lead.id}` : "livre",
      recipientName: proposal?.recipientName ?? lead?.name ?? "",
      title: proposal?.title ?? (lead ? `Site ${lead.name}` : ""),
      packageId: proposal?.packageId ?? "profissional",
      items: proposal
        ? proposal.items.map((i) => ({ id: i.id, description: i.description, quantity: String(i.quantity), unitPrice: String(i.unitPrice) }))
        : [{ id: uid("item"), description: `Pacote ${pkg?.name ?? "Profissional"}`, quantity: "1", unitPrice: String(pkg?.price ?? 990) }],
      scope: proposal?.scope ?? "",
      discount: String(proposal?.discount ?? 0),
      deadlineDays: String(proposal?.deadlineDays ?? 15),
      revisions: String(proposal?.revisions ?? db?.settings.defaultRevisions ?? 2),
      paymentTerms: proposal?.paymentTerms ?? db?.settings.defaultPaymentTerms ?? "50% de entrada na aprovação e 50% na entrega",
      exclusions: proposal?.exclusions ?? "Domínio, hospedagem, produção de fotos e manutenção mensal não inclusos.",
      validUntil: proposal ? toInputDate(proposal.validUntil) : isoDate(addDays(new Date(), db?.settings.defaultProposalValidityDays ?? 15)),
      status: proposal?.status ?? "rascunho",
      nextAction: proposal?.nextAction ?? "Revisar escopo antes de enviar",
      notes: proposal?.notes ?? "",
    };
  };

  const { values, set, errors, reset, validate, formRef } = useForm<Values>(initial());

  useEffect(() => {
    if (open) reset(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proposal, defaultLeadId]);

  const subtotal = values.items.reduce((s, i) => s + num(i.quantity) * num(i.unitPrice), 0);
  const total = Math.max(0, subtotal - num(values.discount));

  const choosePackage = (id: PackageId) => {
    const pkg = packages.find((p) => p.id === id);
    set("packageId", id);
    if (!pkg) return;
    const [first, ...rest] = values.items;
    set("items", [{ ...(first ?? { id: uid("item"), quantity: "1" }), description: `Pacote ${pkg.name}`, unitPrice: String(pkg.price), quantity: first?.quantity ?? "1" }, ...rest]);
    set("deadlineDays", id === "essencial" ? "7" : id === "profissional" ? "15" : "25");
  };

  const updateItem = (id: string, patch: Partial<ItemValue>) => set("items", values.items.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const recipientOptions = [
    { value: "livre", label: "Outro (digitar nome)" },
    ...(db?.clients ?? []).map((c) => ({ value: `client:${c.id}`, label: `Cliente · ${c.name}` })),
    ...(db?.leads ?? []).filter((l) => l.stage !== "perdido" && !l.clientId).map((l) => ({ value: `lead:${l.id}`, label: `Lead · ${l.name}` })),
  ];

  const pickRecipient = (v: string) => {
    set("recipient", v);
    const [kind, id] = v.split(":");
    const name = kind === "client" ? db?.clients.find((c) => c.id === id)?.name : kind === "lead" ? db?.leads.find((l) => l.id === id)?.name : "";
    if (name) {
      set("recipientName", name);
      if (!values.title) set("title", `Site ${name}`);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const [kind, id] = values.recipient.split(":");
    const data = validate(proposalInputSchema, {
      recipientName: values.recipientName,
      leadId: kind === "lead" ? id : kind === "client" ? (db?.clients.find((c) => c.id === id)?.leadId ?? null) : null,
      clientId: kind === "client" ? id : null,
      title: values.title,
      packageId: values.packageId,
      items: values.items.map((i) => ({ id: i.id, description: i.description, quantity: i.quantity, unitPrice: i.unitPrice.replace(",", ".") })),
      scope: values.scope,
      discount: values.discount.replace(",", "."),
      deadlineDays: values.deadlineDays,
      revisions: values.revisions,
      paymentTerms: values.paymentTerms,
      exclusions: values.exclusions,
      validUntil: values.validUntil ? fromInputDate(values.validUntil) : "",
      status: values.status,
      nextAction: values.nextAction,
      notes: values.notes,
    });
    if (!data) return;
    if (data.discount > subtotal) {
      return notify({ kind: "error", title: "Desconto maior que o subtotal", description: "Ajuste o desconto ou os itens." });
    }
    setSaving(true);
    try {
      const saved = proposal ? updateProposal(proposal.id, data) : createProposal(data);
      notify({ kind: "success", title: proposal ? "Proposta atualizada" : "Proposta criada", description: <>{saved.title} · <Money value={total} /></> });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      notify({ kind: "error", title: "Não foi possível salvar", description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="xl"
      title={proposal ? `Editar proposta` : "Nova proposta"}
      description="Valores de referência editáveis. Nada é enviado automaticamente: o envio é feito por você."
      footer={
        <>
          <span className="tnum mr-auto text-[13px] text-ink-soft">
            Total <span className="text-[17px] font-bold text-ink"><Money value={total} /></span>
          </span>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="proposal-form" loading={saving}>
            {proposal ? "Salvar proposta" : "Criar proposta"}
          </Button>
        </>
      }
    >
      <form id="proposal-form" ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <Field label="Para" className="sm:col-span-3">
            {(p) => <Select {...p} value={values.recipient} onValueChange={pickRecipient} options={recipientOptions} />}
          </Field>
          <Field label="Nome do cliente/lead" error={errors.recipientName} className="sm:col-span-3">
            {(p) => <TextInput {...p} value={values.recipientName} onChange={(e) => set("recipientName", e.target.value)} />}
          </Field>
          <Field label="Título" error={errors.title} className="sm:col-span-4">
            {(p) => <TextInput {...p} value={values.title} onChange={(e) => set("title", e.target.value)} />}
          </Field>
          <Field label="Status" className="sm:col-span-2">
            {(p) => <Select {...p} value={values.status} onValueChange={(v) => set("status", v)} options={PROPOSAL_STATUSES.map((s) => ({ value: s, label: proposalStatusMeta[s].label }))} />}
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-[12.5px] font-semibold text-ink-soft">Pacote</legend>
          <div role="radiogroup" aria-label="Pacote" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {packageOrder.map((id) => {
              const pkg = packages.find((p) => p.id === id);
              if (!pkg) return null;
              const active = values.packageId === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => choosePackage(id)}
                  className={cn("rounded-2xl border p-3.5 text-left transition-colors", active ? "pill-active rounded-2xl" : "border-seam hover:border-seam-strong")}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="text-[14px] font-bold text-ink">{pkg.name}</span>
                    <span className="tnum text-[13px] font-semibold text-interactive">
                      {id === "personalizado" ? "a partir de " : ""}
                      <Money value={pkg.price} />
                    </span>
                  </span>
                  <span className="mt-1 block text-[12px] leading-snug text-ink-faint">{pkg.description}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[12.5px] font-semibold text-ink-soft">Itens</legend>
          {errors.items && (
            <p role="alert" className="mb-2 text-[12px] text-danger">
              {errors.items}
            </p>
          )}
          <ul className="flex flex-col gap-2">
            {values.items.map((item, idx) => (
              <li key={item.id} className="grid grid-cols-[1fr_auto] gap-2 rounded-2xl border border-seam p-2.5 sm:grid-cols-[1fr_90px_130px_110px_auto] sm:items-start">
                <div className="col-span-2 sm:col-span-1">
                  <TextInput aria-label={`Descrição do item ${idx + 1}`} aria-invalid={errors[`items.${idx}.description`] ? true : undefined} value={item.description} onChange={(e) => updateItem(item.id, { description: e.target.value })} placeholder="Descrição do item" />
                  {errors[`items.${idx}.description`] && <p className="mt-1 text-[11.5px] text-danger">{errors[`items.${idx}.description`]}</p>}
                </div>
                <TextInput aria-label={`Quantidade do item ${idx + 1}`} inputMode="numeric" value={item.quantity} onChange={(e) => updateItem(item.id, { quantity: e.target.value })} />
                <TextInput aria-label={`Preço unitário do item ${idx + 1}`} moneySign={1} inputMode="decimal" value={item.unitPrice} onChange={(e) => updateItem(item.id, { unitPrice: e.target.value })} />
                <span className="tnum self-center text-right text-[13px] font-semibold text-ink"><Money value={num(item.quantity) * num(item.unitPrice)} /></span>
                <Button type="button" variant="ghost" size="icon-sm" disabled={values.items.length === 1} onClick={() => set("items", values.items.filter((i) => i.id !== item.id))} aria-label={`Remover item ${idx + 1}`} className="self-center">
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => set("items", [...values.items, { id: uid("item"), description: "", quantity: "1", unitPrice: "0" }])}>
            <Plus aria-hidden /> Adicionar item
          </Button>
        </fieldset>

        <Field label="Escopo (o que será entregue)" optional error={errors.scope} hint="Páginas, seções e funcionalidades combinadas. Aparece na proposta impressa.">
          {(p) => <TextArea {...p} className="min-h-[84px]" value={values.scope} onChange={(e) => set("scope", e.target.value)} placeholder="Ex.: página inicial, sobre, serviços, contato com mapa e botão de WhatsApp; versão mobile; SEO local básico." />}
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <Field label="Desconto (R$)" error={errors.discount} className="sm:col-span-2">
            {(p) => <TextInput {...p} moneySign={-1} inputMode="decimal" value={values.discount} onChange={(e) => set("discount", e.target.value)} />}
          </Field>
          <Field label="Prazo (dias)" error={errors.deadlineDays} className="sm:col-span-2">
            {(p) => <TextInput {...p} inputMode="numeric" value={values.deadlineDays} onChange={(e) => set("deadlineDays", e.target.value)} />}
          </Field>
          <Field label="Rodadas de revisão" error={errors.revisions} className="sm:col-span-2">
            {(p) => <TextInput {...p} inputMode="numeric" value={values.revisions} onChange={(e) => set("revisions", e.target.value)} />}
          </Field>
          <Field label="Forma de pagamento" className="sm:col-span-3">
            {(p) => <TextInput {...p} value={values.paymentTerms} onChange={(e) => set("paymentTerms", e.target.value)} />}
          </Field>
          <Field label="Validade" error={errors.validUntil} className="sm:col-span-3">
            {(p) => <TextInput {...p} type="date" value={values.validUntil} onChange={(e) => set("validUntil", e.target.value)} />}
          </Field>
          <Field label="Não incluso (custos recorrentes e exclusões)" className="sm:col-span-6">
            {(p) => <TextArea {...p} className="min-h-[64px]" value={values.exclusions} onChange={(e) => set("exclusions", e.target.value)} />}
          </Field>
          <Field label="Próxima ação" optional className="sm:col-span-3">
            {(p) => <TextInput {...p} value={values.nextAction} onChange={(e) => set("nextAction", e.target.value)} />}
          </Field>
          <Field label="Notas internas" optional className="sm:col-span-3">
            {(p) => <TextInput {...p} value={values.notes} onChange={(e) => set("notes", e.target.value)} />}
          </Field>
        </div>
      </form>
    </Modal>
  );
}
