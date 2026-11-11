"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { useForm } from "@/components/forms/use-form";
import { Button } from "@/components/ui/button";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { opportunityMeta, segmentOptions, UF_NAMES, UFS } from "@/lib/prospecting/catalog";
import { prospectParamsSchema } from "@/lib/prospecting/schema";
import { MAX_OPTIONS, OPPORTUNITY_TYPES, RADIUS_OPTIONS, type OpportunityType, type ProspectParams } from "@/lib/prospecting/types";

type Values = { city: string; uf: string; segment: string; radius: string; max: string; opportunity: OpportunityType };

const initial: Values = { city: "", uf: "SP", segment: "beleza", radius: "10", max: "20", opportunity: "todas" };

export function ProspectForm({ disabled, busy, onSubmit }: { disabled: boolean; busy: boolean; onSubmit: (p: ProspectParams, generateDemos: boolean) => void }) {
  const { values, set, errors, validate, formRef } = useForm<Values>(initial);
  const [generateDemos, setGenerateDemos] = useState(true);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = validate(prospectParamsSchema, {
      city: values.city,
      uf: values.uf,
      segment: values.segment,
      radiusKm: Number(values.radius),
      maxResults: Number(values.max),
      opportunity: values.opportunity,
    });
    if (data) onSubmit(data as ProspectParams, generateDemos);
  };

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-4" aria-label="Buscar oportunidades">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_120px]">
        <Field label="Cidade" error={errors.city}>
          {(p) => <TextInput {...p} name="city" autoComplete="address-level2" value={values.city} onChange={(e) => set("city", e.target.value)} placeholder="Ex.: Campinas" disabled={disabled} />}
        </Field>
        <Field label="UF" error={errors.uf}>
          {(p) => <Select {...p} value={values.uf} onValueChange={(v) => set("uf", v)} options={UFS.map((u) => ({ value: u, label: u }))} aria-label={`UF: ${UF_NAMES[values.uf as keyof typeof UF_NAMES] ?? values.uf}`} />}
        </Field>
      </div>
      <Field label="Segmento" error={errors.segment}>
        {(p) => <Select {...p} value={values.segment} onValueChange={(v) => set("segment", v)} options={segmentOptions} />}
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-soft">Raio a partir do centro</span>
          <Segmented label="Raio a partir do centro" value={values.radius} onChange={(v) => set("radius", v)} options={RADIUS_OPTIONS.map((r) => ({ value: String(r), label: `${r} km` }))} className="self-start" />
        </div>
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-[12.5px] font-semibold text-ink-soft">Máximo de oportunidades</span>
          <Segmented label="Máximo de oportunidades" value={values.max} onChange={(v) => set("max", v)} options={MAX_OPTIONS.map((m) => ({ value: String(m), label: String(m) }))} className="self-start" />
        </div>
      </div>
      <Field label="Tipo de oportunidade" error={errors.opportunity} hint={opportunityMeta[values.opportunity].hint}>
        {(p) => <Select<OpportunityType> {...p} value={values.opportunity} onValueChange={(v) => set("opportunity", v)} options={OPPORTUNITY_TYPES.map((o) => ({ value: o, label: opportunityMeta[o].label }))} />}
      </Field>
      <label className="flex items-start gap-2 rounded-xl border border-seam p-3 text-[12.5px] text-ink-soft">
        <input type="checkbox" checked={generateDemos} disabled={disabled} onChange={(e) => setGenerateDemos(e.target.checked)} className="mt-0.5 accent-white" />
        <span><span className="block font-semibold text-ink">Preparar demos e mensagens para aprovação</span><span className="mt-1 block text-ink-faint">Importa HOT/WARM para o CRM, ignora descartados e reaproveita demos existentes. Ganhos e perdidos ficam de fora. Sem envio automático.</span></span>
      </label>
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button type="submit" variant="primary" loading={busy} disabled={disabled}>
          {!busy && <Search aria-hidden />} {generateDemos ? "Buscar e gerar demos" : "Buscar oportunidades"}
        </Button>
        <span className="text-[12px] text-ink-faint">Só dados comerciais públicos. Nenhuma mensagem é enviada.</span>
      </div>
    </form>
  );
}
