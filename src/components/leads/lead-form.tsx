"use client";

import { useEffect, useState } from "react";
import { useForm } from "@/components/forms/use-form";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { LEAD_SOURCES, LEAD_STAGES, leadSourceMeta, leadStageMeta, priorityMeta, SEGMENTS, segmentMeta, websiteSituationMeta } from "@/lib/constants";
import { createLead, updateLead } from "@/lib/data/repository";
import { fromInputDate, toInputDate } from "@/lib/dates";
import { leadInputSchema } from "@/lib/schemas";
import type { Lead, LeadSource, LeadStage, Priority, Segment, WebsiteSituation } from "@/lib/types";

type Values = {
  name: string;
  segment: Segment;
  city: string;
  uf: string;
  source: LeadSource;
  website: string;
  websiteSituation: WebsiteSituation;
  stage: LeadStage;
  priority: Priority;
  phone: string;
  email: string;
  instagram: string;
  potentialValue: string;
  nextAction: string;
  nextActionAt: string;
  notes: string;
};

function toValues(lead?: Lead | null): Values {
  return {
    name: lead?.name ?? "",
    segment: lead?.segment ?? "restaurantes",
    city: lead?.city ?? "",
    uf: lead?.uf ?? "SP",
    source: lead?.source ?? "google_maps",
    website: lead?.website ?? "",
    websiteSituation: lead?.websiteSituation ?? "sem_site",
    stage: lead?.stage ?? "novo",
    priority: lead?.priority ?? "media",
    phone: lead?.phone ?? "",
    email: lead?.email ?? "",
    instagram: lead?.instagram ?? "",
    potentialValue: String(lead?.potentialValue ?? 990),
    nextAction: lead?.nextAction ?? "Verificar presença digital e qualificar",
    nextActionAt: toInputDate(lead?.nextActionAt),
    notes: lead?.notes ?? "",
  };
}

export function LeadForm({ open, onOpenChange, lead, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; lead?: Lead | null; onSaved?: (lead: Lead) => void }) {
  const { values, set, errors, reset, validate, formRef } = useForm<Values>(toValues(lead));
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) reset(toValues(lead));
  }, [open, lead, reset]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = validate(leadInputSchema, {
      ...values,
      potentialValue: values.potentialValue.replace(",", "."),
      nextActionAt: values.nextActionAt ? fromInputDate(values.nextActionAt) : null,
    });
    if (!data) return;
    setSaving(true);
    try {
      const saved = lead ? updateLead(lead.id, data) : createLead(data);
      notify({ kind: "success", title: lead ? "Lead atualizado" : "Lead cadastrado", description: saved.name });
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
      size="lg"
      title={lead ? `Editar ${lead.name}` : "Novo lead"}
      description="Registre só dados comerciais públicos. Campos obrigatórios: estabelecimento, cidade e UF."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="lead-form" loading={saving}>
            {lead ? "Salvar alterações" : "Cadastrar lead"}
          </Button>
        </>
      }
    >
      <form id="lead-form" ref={formRef} onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field label="Estabelecimento" error={errors.name} className="sm:col-span-4">
          {(p) => <TextInput {...p} value={values.name} onChange={(e) => set("name", e.target.value)} autoComplete="organization" placeholder="Ex.: Padaria Pão Quente" />}
        </Field>
        <Field label="Segmento" className="sm:col-span-2">
          {(p) => <Select {...p} value={values.segment} onValueChange={(v) => set("segment", v)} options={SEGMENTS.map((s) => ({ value: s, label: segmentMeta[s].label }))} />}
        </Field>
        <Field label="Cidade" error={errors.city} className="sm:col-span-4">
          {(p) => <TextInput {...p} value={values.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" />}
        </Field>
        <Field label="UF" error={errors.uf} className="sm:col-span-2">
          {(p) => <TextInput {...p} value={values.uf} maxLength={2} onChange={(e) => set("uf", e.target.value.toUpperCase())} autoComplete="address-level1" />}
        </Field>
        <Field label="Origem" className="sm:col-span-2">
          {(p) => <Select {...p} value={values.source} onValueChange={(v) => set("source", v)} options={LEAD_SOURCES.map((s) => ({ value: s, label: leadSourceMeta[s].label }))} />}
        </Field>
        <Field label="Etapa" className="sm:col-span-2">
          {(p) => <Select {...p} value={values.stage} onValueChange={(v) => set("stage", v)} options={LEAD_STAGES.map((s) => ({ value: s, label: leadStageMeta[s].label }))} />}
        </Field>
        <Field label="Prioridade" className="sm:col-span-2">
          {(p) => <Select {...p} value={values.priority} onValueChange={(v) => set("priority", v)} options={(["alta", "media", "baixa"] as Priority[]).map((s) => ({ value: s, label: priorityMeta[s].label }))} />}
        </Field>
        <Field label="Website atual" optional error={errors.website} hint="Deixe vazio se não encontrou site." className="sm:col-span-4">
          {(p) => <TextInput {...p} type="url" inputMode="url" value={values.website} onChange={(e) => set("website", e.target.value)} placeholder="www.exemplo.com.br" />}
        </Field>
        <Field label="Situação do site" className="sm:col-span-2">
          {(p) => (
            <Select
              {...p}
              value={values.websiteSituation}
              onValueChange={(v) => set("websiteSituation", v)}
              options={(Object.keys(websiteSituationMeta) as WebsiteSituation[]).map((s) => ({ value: s, label: websiteSituationMeta[s].label }))}
            />
          )}
        </Field>
        <Field label="Telefone comercial" optional error={errors.phone} className="sm:col-span-2">
          {(p) => <TextInput {...p} type="tel" inputMode="tel" autoComplete="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(19) 99999-0000" />}
        </Field>
        <Field label="E-mail comercial" optional error={errors.email} className="sm:col-span-2">
          {(p) => <TextInput {...p} type="email" spellCheck={false} autoComplete="email" value={values.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@empresa.com.br" />}
        </Field>
        <Field label="Instagram" optional className="sm:col-span-2">
          {(p) => <TextInput {...p} value={values.instagram} onChange={(e) => set("instagram", e.target.value)} placeholder="@perfil" />}
        </Field>
        <Field label="Valor potencial (R$)" error={errors.potentialValue} className="sm:col-span-2">
          {(p) => <TextInput {...p} moneySign={1} inputMode="decimal" value={values.potentialValue} onChange={(e) => set("potentialValue", e.target.value)} />}
        </Field>
        <Field label="Próxima ação" optional className="sm:col-span-2">
          {(p) => <TextInput {...p} value={values.nextAction} onChange={(e) => set("nextAction", e.target.value)} />}
        </Field>
        <Field label="Data da próxima ação" optional className="sm:col-span-2">
          {(p) => <TextInput {...p} type="date" value={values.nextActionAt} onChange={(e) => set("nextActionAt", e.target.value)} />}
        </Field>
        <Field label="Observações" optional className="sm:col-span-6">
          {(p) => <TextArea {...p} value={values.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Evidências da pesquisa, contexto do negócio…" />}
        </Field>
      </form>
    </Modal>
  );
}
