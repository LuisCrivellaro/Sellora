"use client";

import { Copy, MessageCircle, RefreshCw, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { markOutreachManuallySent } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { demoPreviewUrl, publishedDemoUrl } from "@/lib/demos/model";
import { isBrazilianLandline, normalizeWhatsappPhone } from "@/lib/demos/whatsapp";
import { buildOutreachMessage, outreachActivityKind, outreachFacts, outreachIssues, outreachKindLabel, recentFirstContacts, type OutreachKind } from "@/lib/outreach/messages";
import type { Lead } from "@/lib/types";
import { cn } from "@/lib/utils";

const KINDS: OutreachKind[] = ["first_contact", "interested", "undecided", "declined"];
const HINTS: Record<OutreachKind, string> = {
  first_contact: "Curta, sem link e terminando com pergunta. O objetivo é conseguir uma resposta, não vender agora.",
  interested: "O lead respondeu com interesse: aqui vai o link da demonstração, identificada como conceito não oficial.",
  undecided: "Sem pressão: ofereça a demonstração e deixe a decisão com o lead.",
  declined: "Agradeça e encerre sem insistir. Mude a etapa do lead manualmente, se for o caso.",
};

/** Abordagem comercial manual: rascunhos variados por lead, editáveis, sem envio automático. */
export function OutreachPanel({ lead }: { lead: Lead }) {
  const { notify } = useToast();
  const { db, sync, mode, storageError } = useStore();
  const blocked = mode === "supabase" ? sync.pending > 0 || !!sync.error : !!storageError;
  const activities = db?.activities;
  const contacted = useMemo(() => (activities ?? []).some((a) => a.leadId === lead.id && outreachActivityKind(a) === "first_contact"), [activities, lead.id]);
  const [kind, setKind] = useState<OutreachKind>(contacted ? "interested" : "first_contact");
  const [variant, setVariant] = useState(0);
  const [edited, setEdited] = useState<Partial<Record<OutreachKind, string>>>({});
  const [confirm, setConfirm] = useState(false);

  // Só demo aprovada vai como link; sem ela a resposta ao interessado promete enviar depois.
  const demo = lead.demo;
  const demoUrl = demo?.status === "approved" && typeof window !== "undefined" ? publishedDemoUrl(demo) ?? demoPreviewUrl(demo, window.location.origin) : null;
  const generated = useMemo(() => {
    const facts = outreachFacts(lead, db?.settings.profile.name ?? "");
    const recent = kind === "first_contact" ? recentFirstContacts(activities ?? [], db?.leads ?? [], lead.id) : [];
    return buildOutreachMessage(facts, kind, { recent, variant, demoUrl });
  }, [lead, db?.settings.profile.name, db?.leads, activities, kind, variant, demoUrl]);
  const text = edited[kind] ?? generated;
  const issues = outreachIssues(text, kind);
  const phone = normalizeWhatsappPhone(lead.phone);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-seam-strong p-4" aria-label="Abordagem comercial">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-ink">Abordagem</h3>
        <span className="text-[12px] text-ink-faint" role="status">{contacted ? "Primeiro contato registrado" : "Ainda sem contato registrado"}</span>
      </div>
      <div role="tablist" aria-label="Momento da conversa" className="flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setVariant(0); }}
            className={cn("rounded-full border px-3 py-1 text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2", kind === k ? "border-seam-strong bg-selected font-semibold text-ink" : "border-seam text-ink-soft hover:border-seam-strong")}>
            {outreachKindLabel[k]}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-ink-faint">{HINTS[kind]}</p>
      {kind === "interested" && !demoUrl && <p role="status" className="text-[12px] text-warn">Sem demo aprovada: a resposta não leva link. Gere e aprove a demo abaixo para incluir a demonstração.</p>}
      <Field label="Mensagem" hint="Rascunho gerado a partir de dados do cadastro, sem IA. Edite à vontade antes de enviar.">
        {(p) => <TextArea {...p} rows={kind === "interested" ? 8 : 6} maxLength={1500} value={text} onChange={(e) => setEdited((current) => ({ ...current, [kind]: e.target.value }))} />}
      </Field>
      {issues.length > 0 && <ul role="status" className="list-disc space-y-1 rounded-xl border border-warn/30 bg-warn/5 p-3 pl-7 text-[12px] text-ink-soft">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={!phone || text.trim().length < 10} onClick={() => window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text.trim())}`, "_blank", "noopener,noreferrer")}><MessageCircle aria-hidden /> Abrir no WhatsApp</Button>
        <Button size="sm" variant="secondary" onClick={async () => {
          try { await navigator.clipboard.writeText(text.trim()); notify({ kind: "success", title: "Mensagem copiada", description: "Nenhuma mensagem foi enviada pelo Sellora." }); }
          catch { notify({ kind: "error", title: "Não foi possível copiar", description: "Permita acesso à área de transferência e tente novamente." }); }
        }}><Copy aria-hidden /> Copiar</Button>
        <Button size="sm" variant="ghost" onClick={() => { setVariant((v) => v + 1); setEdited((current) => ({ ...current, [kind]: undefined })); }}><RefreshCw aria-hidden /> Outra versão</Button>
        <Button size="sm" variant="outline" disabled={blocked || !phone || text.trim().length < 10} onClick={() => setConfirm(true)}><Send aria-hidden /> Já enviei</Button>
      </div>
      {phone && isBrazilianLandline(lead.phone) && <p role="status" className="text-[12px] text-warn">{lead.phone} é um telefone fixo e quase nunca tem WhatsApp. Procure o celular do estabelecimento e atualize a ficha antes de abrir a conversa.</p>}
      {!phone && <p role="status" className="text-[12px] text-warn">Cadastre um telefone com DDD na ficha do lead para abrir a conversa.</p>}
      <p className="text-[11.5px] text-ink-faint">Nenhum envio automático. Só “Já enviei” registra a atividade e o último contato no CRM.</p>
      <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="Você já enviou esta mensagem?" description={`Confirme apenas se você apertou Enviar para ${lead.name}. Isso registra a atividade (${outreachKindLabel[kind].toLowerCase()}) no CRM; não confirma entrega.`} confirmLabel="Registrar envio manual" destructive={false}
        onConfirm={() => {
          try {
            markOutreachManuallySent(lead.id, kind, text);
            notify({ kind: "success", title: "Envio manual registrado no CRM" });
            if (kind === "first_contact") { setKind("interested"); setVariant(0); }
          } catch (e) { notify({ kind: "error", title: "Não foi possível registrar", description: e instanceof Error ? e.message : "Tente novamente." }); }
        }} />
    </section>
  );
}
