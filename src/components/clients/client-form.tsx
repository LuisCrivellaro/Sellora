"use client";

import { useEffect, useState } from "react";
import { useForm } from "@/components/forms/use-form";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { clientStatusMeta, SEGMENTS, segmentMeta } from "@/lib/constants";
import { createClient, updateClient } from "@/lib/data/repository";
import { clientInputSchema } from "@/lib/schemas";
import type { Client, ClientStatus, Segment } from "@/lib/types";

type Values = {
  name: string;
  segment: Segment;
  city: string;
  uf: string;
  contactName: string;
  phone: string;
  email: string;
  status: ClientStatus;
  siteUrl: string;
  notes: string;
};

const toValues = (c?: Client | null): Values => ({
  name: c?.name ?? "",
  segment: c?.segment ?? "restaurantes",
  city: c?.city ?? "",
  uf: c?.uf ?? "SP",
  contactName: c?.contactName ?? "",
  phone: c?.phone ?? "",
  email: c?.email ?? "",
  status: c?.status ?? "ativo",
  siteUrl: c?.siteUrl ?? "",
  notes: c?.notes ?? "",
});

export function ClientForm({ open, onOpenChange, client, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; client?: Client | null; onSaved?: (c: Client) => void }) {
  const { values, set, errors, reset, validate, formRef } = useForm<Values>(toValues(client));
  const { notify } = useToast();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) reset(toValues(client));
  }, [open, client, reset]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = validate(clientInputSchema);
    if (!data) return;
    setSaving(true);
    try {
      const saved = client ? updateClient(client.id, data) : createClient(data);
      notify({ kind: "success", title: client ? "Cliente atualizado" : "Cliente cadastrado", description: saved.name });
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
      title={client ? `Editar ${client.name}` : "Novo cliente"}
      description="Clientes também podem nascer da conversão de um lead ganho."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" form="client-form" loading={saving}>
            {client ? "Salvar alterações" : "Cadastrar cliente"}
          </Button>
        </>
      }
    >
      <form id="client-form" ref={formRef} onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-6">
        <Field label="Cliente (estabelecimento)" error={errors.name} className="sm:col-span-4">
          {(p) => <TextInput {...p} value={values.name} onChange={(e) => set("name", e.target.value)} autoComplete="organization" />}
        </Field>
        <Field label="Segmento" className="sm:col-span-2">
          {(p) => <Select {...p} value={values.segment} onValueChange={(v) => set("segment", v)} options={SEGMENTS.map((s) => ({ value: s, label: segmentMeta[s].label }))} />}
        </Field>
        <Field label="Cidade" error={errors.city} className="sm:col-span-4">
          {(p) => <TextInput {...p} value={values.city} onChange={(e) => set("city", e.target.value)} />}
        </Field>
        <Field label="UF" error={errors.uf} className="sm:col-span-2">
          {(p) => <TextInput {...p} value={values.uf} maxLength={2} onChange={(e) => set("uf", e.target.value.toUpperCase())} />}
        </Field>
        <Field label="Pessoa de contato" optional className="sm:col-span-2">
          {(p) => <TextInput {...p} value={values.contactName} onChange={(e) => set("contactName", e.target.value)} autoComplete="name" />}
        </Field>
        <Field label="Telefone" optional error={errors.phone} className="sm:col-span-2">
          {(p) => <TextInput {...p} type="tel" inputMode="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(19) 99999-0000" />}
        </Field>
        <Field label="E-mail" optional error={errors.email} className="sm:col-span-2">
          {(p) => <TextInput {...p} type="email" spellCheck={false} value={values.email} onChange={(e) => set("email", e.target.value)} />}
        </Field>
        <Field label="Status de atendimento" className="sm:col-span-2">
          {(p) => <Select {...p} value={values.status} onValueChange={(v) => set("status", v)} options={(Object.keys(clientStatusMeta) as ClientStatus[]).map((s) => ({ value: s, label: clientStatusMeta[s].label }))} />}
        </Field>
        <Field label="Site do cliente" optional error={errors.siteUrl} className="sm:col-span-4">
          {(p) => <TextInput {...p} type="url" inputMode="url" value={values.siteUrl} onChange={(e) => set("siteUrl", e.target.value)} placeholder="www.cliente.com.br" />}
        </Field>
        <Field label="Observações" optional className="sm:col-span-6">
          {(p) => <TextArea {...p} value={values.notes} onChange={(e) => set("notes", e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}
