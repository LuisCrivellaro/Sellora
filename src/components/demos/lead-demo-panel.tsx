"use client";

import { CheckCheck, Copy, ExternalLink, Monitor, RotateCcw, MessageCircle, Send } from "lucide-react";
import { useState } from "react";
import { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { approveLeadDemo, generateLeadDemo, revokeDemoApproval, saveDemoMessage, markDemoManuallySent, upgradeLeadDemoDesign } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { demoMessageForCopy, demoPreviewUrl } from "@/lib/demos/model";
import { formatDate } from "@/lib/dates";
import type { Lead } from "@/lib/types";
import { isCurrentDemoSent, normalizeWhatsappPhone, whatsappDraftUrl } from "@/lib/demos/whatsapp";
import { ConfirmDialog } from "@/components/ui/overlay";

export function LeadDemoPanel({ lead, embedded = false }: { lead: Lead; embedded?: boolean }) {
  const { notify } = useToast();
  const { sync, mode, storageError } = useStore();
  const demo = lead.demo;
  const [text, setText] = useState(demo?.message ?? "");
  const [reviewed, setReviewed] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const dirty = !!demo && text.trim() !== demo.message;
  const blocked = mode === "supabase" ? sync.pending > 0 || !!sync.error : !!storageError;
  const phone = normalizeWhatsappPhone(lead.phone);
  const sent = demo ? isCurrentDemoSent(demo, lead.phone) : false;
  const act = (action: () => void, title: string) => {
    try { action(); notify({ kind: "success", title }); }
    catch (e) { notify({ kind: "error", title: "Não foi possível concluir", description: e instanceof ZodError ? e.issues[0]?.message : e instanceof Error ? e.message : "Tente novamente." }); }
  };

  if (!demo) return (
    <section className="rounded-2xl border border-seam p-4" aria-label="Demo e mensagem">
      <h3 className="text-[14px] font-semibold text-ink">Uma prévia para começar a conversa</h3>
      <p className="mt-1 mb-3 text-[12.5px] text-ink-faint">Gere um modelo por segmento e uma mensagem para revisão. Nenhum contato será realizado.</p>
      <Button size="sm" variant="secondary" onClick={() => act(() => { const next = generateLeadDemo(lead.id); setText(next.message); }, "Demo e rascunho preparados")}><Monitor aria-hidden /> Gerar demo e mensagem</Button>
    </section>
  );

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-seam-strong p-4" aria-label="Demo e mensagem">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-ink">Demo e mensagem</h3>
        <span className={demo.status === "approved" && !dirty ? "text-[12px] font-semibold text-mint" : "text-[12px] font-semibold text-warn"} role="status">{sent && !dirty ? "Envio registrado" : demo.status === "approved" && !dirty ? "Aprovada · envio manual" : "Aguardando aprovação"}</span>
      </div>
      <p className="text-[12px] text-ink-faint">Modelo por segmento com nome, cidade e telefone disponíveis. Demonstração não oficial; revise os dados antes de aprovar.</p>
      {!embedded && <Button size="sm" variant="secondary" className="self-start" onClick={() => window.open(demoPreviewUrl(demo, window.location.origin), "_blank", "noopener,noreferrer")}><ExternalLink aria-hidden /> Abrir demo</Button>}
      {demo.version === 1 && <div className="rounded-xl border border-seam p-3 text-[12px] text-ink-soft"><p className="mb-2">Esta demo usa o visual original. Atualizar preserva o cadastro e devolve a mensagem para revisão.</p><Button size="sm" variant="secondary" onClick={() => act(() => upgradeLeadDemoDesign(lead.id), "Novo visual pronto para revisão")}>Atualizar visual da demo</Button></div>}
      <Field label="Mensagem de apresentação" hint="O link da demo e a indicação de demonstração não oficial são anexados à mensagem na cópia. Alterar o texto exige nova aprovação.">
        {(p) => <TextArea {...p} rows={7} maxLength={2000} value={text} onChange={(e) => { setText(e.target.value); setReviewed(false); }} />}
      </Field>
      {dirty && <Button size="sm" variant="secondary" className="self-start" onClick={() => act(() => { saveDemoMessage(lead.id, text); setReviewed(false); }, "Rascunho salvo para nova revisão")}>Salvar rascunho</Button>}
      <details className="rounded-xl bg-selected p-3 text-[12px] leading-relaxed text-ink-soft"><summary className="cursor-pointer font-semibold">Confira o endereço antes de compartilhar</summary><p className="mt-2">Em localhost/IP privado, a demo é apenas para testes na sua máquina/rede. Para enviar ao lead, abra o Sellora em uma hospedagem pública. O link usa o endereço atual.</p></details>
      {demo.status === "approved" && !dirty ? (
        <>
          <p className="text-[11.5px] text-ink-faint">Aprovada por {demo.approvedBy} em {formatDate(demo.approvedAt!)}. Aprovação não significa envio.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" disabled={blocked || !phone || sent} onClick={() => act(() => {
              window.open(whatsappDraftUrl(demo, lead.phone, window.location.origin), "_blank", "noopener,noreferrer");
            }, "WhatsApp solicitado: confira a conversa e aperte Enviar") }><MessageCircle aria-hidden /> Abrir no WhatsApp</Button>
            <Button size="sm" variant="secondary" disabled={blocked || sent} onClick={async () => {
              try {
                await navigator.clipboard.writeText(demoMessageForCopy(demo, window.location.origin));
                notify({ kind: "success", title: "Mensagem com link copiada", description: "Faça o envio manual no canal escolhido. Nenhuma mensagem foi enviada pelo Sellora." });
              } catch { notify({ kind: "error", title: "Não foi possível copiar", description: "Permita acesso à área de transferência e tente novamente." }); }
            }}><Copy aria-hidden /> Copiar mensagem com demo</Button>
            {!sent && <Button size="sm" variant="outline" disabled={blocked || !phone} onClick={() => setConfirmSent(true)}><Send aria-hidden /> Já enviei</Button>}
            {!sent && <Button size="sm" variant="ghost" disabled={blocked} onClick={() => act(() => { revokeDemoApproval(lead.id); setReviewed(false); }, "Mensagem devolvida à revisão")}><RotateCcw aria-hidden /> Devolver à revisão</Button>}
          </div>
          {!phone && <p role="status" className="text-[12px] text-warn">Cadastre um telefone com DDD na ficha do lead para abrir a conversa. Para outro país, inclua +DDI.</p>}
          <p className="text-[11.5px] text-ink-faint">Destinatário: {lead.phone || "não cadastrado"}. Use com contatos que autorizaram a abordagem. Abrir a conversa não envia nem registra contato.</p>
        </>
      ) : (
        <>
          <label className="flex items-start gap-2 text-[12.5px] text-ink-soft"><input type="checkbox" className="mt-0.5 accent-white" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />Conferi a demo, os dados do negócio e o texto da mensagem.</label>
          <Button size="sm" className="self-start" disabled={!reviewed || dirty || blocked} onClick={() => act(() => approveLeadDemo(lead.id), "Mensagem aprovada para envio manual")}><CheckCheck aria-hidden /> Aprovar mensagem</Button>
        </>
      )}
      {blocked && <p role="status" className="text-[12px] text-warn">Aguarde a gravação ou resolva o erro de armazenamento para aprovar e copiar.</p>}
      {demo.lastManualSend && <p className="rounded-xl border border-seam p-3 text-[12px] text-ink-soft">Último envio manual declarado em {formatDate(demo.lastManualSend.at)} por {demo.lastManualSend.by}. Entrega não verificada pelo Sellora.</p>}
      <p className="text-[11.5px] text-ink-faint">Nenhum envio automático. Só “Já enviei” atualiza o último contato e registra a atividade no CRM.</p>
      <ConfirmDialog open={confirmSent} onOpenChange={setConfirmSent} title="Você já enviou esta mensagem?" description={`Confirme apenas se você apertou Enviar no WhatsApp para ${lead.name}, no número ${lead.phone}. Isso registra o contato no CRM; não confirma entrega nem envia outra mensagem.`} confirmLabel="Confirmar envio manual" destructive={false} onConfirm={() => act(() => markDemoManuallySent(lead.id, window.location.origin), "Envio manual registrado no CRM")} />
    </section>
  );
}
