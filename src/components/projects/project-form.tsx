"use client";

import { useEffect, useState } from "react";
import { useForm } from "@/components/forms/use-form";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { PROJECT_STAGES, projectStageMeta, siteTypeMeta } from "@/lib/constants";
import { createProject, updateProject } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { addDays, fromInputDate, isoDate, toInputDate } from "@/lib/dates";
import { projectInputSchema } from "@/lib/schemas";
import type { Project, ProjectStage, SiteType } from "@/lib/types";

type Values = {
  clientId: string;
  title: string;
  siteType: SiteType;
  stage: ProjectStage;
  startDate: string;
  dueDate: string;
  contractValue: string;
  previewUrl: string;
  publishedUrl: string;
  notes: string;
};

const toValues = (p?: Project | null, clientId?: string | null): Values => ({
  clientId: p?.clientId ?? clientId ?? "",
  title: p?.title ?? "",
  siteType: p?.siteType ?? "institucional",
  stage: p?.stage ?? "briefing",
  startDate: p ? toInputDate(p.startDate) : isoDate(new Date()),
  dueDate: p ? toInputDate(p.dueDate) : isoDate(addDays(new Date(), 15)),
  contractValue: String(p?.contractValue ?? 990),
  previewUrl: p?.previewUrl ?? "",
  publishedUrl: p?.publishedUrl ?? "",
  notes: p?.notes ?? "",
});

export function ProjectForm({
  open,
  onOpenChange,
  project,
  defaultClientId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  project?: Project | null;
  defaultClientId?: string | null;
  onSaved?: (p: Project) => void;
}) {
  const { db } = useStore();
  const { values, set, errors, reset, validate, formRef } = useForm<Values>(toValues(project, defaultClientId));
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const v = toValues(project, defaultClientId);
    if (!project && v.clientId && !v.title) v.title = `Site ${db?.clients.find((c) => c.id === v.clientId)?.name ?? ""}`.trim();
    reset(v);
  }, [open, project, defaultClientId, reset, db]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = validate(projectInputSchema, {
      ...values,
      contractValue: values.contractValue.replace(",", "."),
      startDate: values.startDate ? fromInputDate(values.startDate) : "",
      dueDate: values.dueDate ? fromInputDate(values.dueDate) : "",
    });
    if (!data) return;
    setSaving(true);
    try {
      const saved = project ? updateProject(project.id, data) : createProject(data);
      notify({ kind: "success", title: project ? "Projeto atualizado" : "Projeto criado", description: project ? saved.title : "11 tarefas padrão adicionadas ao checklist." });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      notify({ kind: "error", title: "Não foi possível salvar", description: err instanceof Error ? err.message : undefined });
    } finally {
      setSaving(false);
    }
  };

  const clients = db?.clients ?? [];

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={project ? `Editar ${project.title}` : "Novo projeto"}
      description="O progresso é calculado pelas tarefas concluídas do checklist."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="project-form" loading={saving} disabled={!clients.length}>
            {project ? "Salvar alterações" : "Criar projeto"}
          </Button>
        </>
      }
    >
      {!clients.length ? (
        <p className="text-[13.5px] text-ink-soft">Cadastre ou converta um cliente antes de criar um projeto.</p>
      ) : (
        <form id="project-form" ref={formRef} onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <Field label="Cliente" error={errors.clientId} className="sm:col-span-3">
            {(p) => <Select {...p} value={values.clientId} placeholder="Selecione o cliente" onValueChange={(v) => set("clientId", v)} options={clients.map((c) => ({ value: c.id, label: c.name }))} />}
          </Field>
          <Field label="Tipo de site" className="sm:col-span-3">
            {(p) => <Select {...p} value={values.siteType} onValueChange={(v) => set("siteType", v)} options={(Object.keys(siteTypeMeta) as SiteType[]).map((s) => ({ value: s, label: siteTypeMeta[s].label }))} />}
          </Field>
          <Field label="Projeto" error={errors.title} className="sm:col-span-6">
            {(p) => <TextInput {...p} value={values.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Site institucional Padaria Pão Quente" />}
          </Field>
          <Field label="Etapa" className="sm:col-span-2">
            {(p) => <Select {...p} value={values.stage} onValueChange={(v) => set("stage", v)} options={PROJECT_STAGES.map((s) => ({ value: s, label: projectStageMeta[s].label }))} />}
          </Field>
          <Field label="Início" error={errors.startDate} className="sm:col-span-2">
            {(p) => <TextInput {...p} type="date" value={values.startDate} onChange={(e) => set("startDate", e.target.value)} />}
          </Field>
          <Field label="Prazo" error={errors.dueDate} className="sm:col-span-2">
            {(p) => <TextInput {...p} type="date" value={values.dueDate} onChange={(e) => set("dueDate", e.target.value)} />}
          </Field>
          <Field label="Valor contratado (R$)" error={errors.contractValue} className="sm:col-span-2">
            {(p) => <TextInput {...p} inputMode="decimal" value={values.contractValue} onChange={(e) => set("contractValue", e.target.value)} />}
          </Field>
          <Field label="URL do preview" optional error={errors.previewUrl} className="sm:col-span-2">
            {(p) => <TextInput {...p} type="url" value={values.previewUrl} onChange={(e) => set("previewUrl", e.target.value)} placeholder="preview.exemplo.com" />}
          </Field>
          <Field label="URL publicada" optional error={errors.publishedUrl} hint="Registre só após publicação autorizada." className="sm:col-span-2">
            {(p) => <TextInput {...p} type="url" value={values.publishedUrl} onChange={(e) => set("publishedUrl", e.target.value)} placeholder="www.cliente.com.br" />}
          </Field>
          <Field label="Observações" optional className="sm:col-span-6">
            {(p) => <TextArea {...p} value={values.notes} onChange={(e) => set("notes", e.target.value)} />}
          </Field>
        </form>
      )}
    </Modal>
  );
}
