"use client";

import { Ban, CheckCheck, Copy, ExternalLink, Monitor, RotateCcw, MessageCircle, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { Field, TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { approveLeadDemo, restoreLeadDemo, revokeDemoApproval, saveDemoMessage, markDemoManuallySent, upgradeLeadDemoDesign } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { demoMessageForCopy, demoPreviewUrl } from "@/lib/demos/model";
import { formatDate } from "@/lib/dates";
import type { Lead } from "@/lib/types";
import { isCurrentDemoSent, normalizeWhatsappPhone, whatsappDraftUrl } from "@/lib/demos/whatsapp";
import { ConfirmDialog } from "@/components/ui/overlay";
import { findApprovedConcept } from "@/lib/demos/concepts";
import { demoCreativeIssues } from "@/lib/demos/creative-review";
import { enqueueDemoGeneration, useDemoGenerator } from "@/lib/demos/generation-client";
import { DemoGeneratorStatus } from "./demo-generator-status";

export function LeadDemoPanel({ lead, embedded = false }: { lead: Lead; embedded?: boolean }) {
  const { notify } = useToast();
  const { db, sync, mode, storageError } = useStore();
  const generator = useDemoGenerator();
  const generating = generator.items.some((item) => item.leadId === lead.id && (item.status === "queued" || item.status === "running"));
  const demo = lead.demo;
  const [text, setText] = useState(demo?.message ?? "");
  const [reviewed, setReviewed] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);
  const dirty = !!demo && text.trim() !== demo.message;
  const blocked = mode === "supabase" ? sync.pending > 0 || !!sync.error : !!storageError;
  const phone = normalizeWhatsappPhone(lead.phone);
  const sent = demo ? isCurrentDemoSent(demo, lead.phone) : false;
  const availableConcept = demo && demo.version < 4 ? findApprovedConcept(demo.business) : undefined;
  const creativeIssues = useMemo(() => demo ? demoCreativeIssues(demo, db?.leads.flatMap((item) => item.demo ? [item.demo] : []) ?? []) : [], [demo, db?.leads]);
  const act = (action: () => void, title: string) => {
    try { action(); notify({ kind: "success", title }); }
    catch (e) { notify({ kind: "error", title: "Não foi possível concluir", description: e instanceof ZodError ? e.issues[0]?.message : e instanceof Error ? e.message : "Tente novamente." }); }
  };

  if (!demo) return (
    <section className="rounded-2xl border border-seam p-4" aria-label="Demo e mensagem">
      <h3 className="text-[14px] font-semibold text-ink">Uma prévia para começar a conversa</h3>
      <p className="mt-1 mb-3 text-[12.5px] text-ink-faint">Prepare uma composição visual para este negócio e uma mensagem para revisão.</p>
      <DemoGeneratorStatus leadId={lead.id} />
      <Button size="sm" variant="secondary" loading={generating} disabled={blocked || !generator.connection?.available} onClick={() => enqueueDemoGeneration([lead.id])}><Monitor aria-hidden /> Gerar demo e mensagem com IA</Button>
    </section>
  );

  if (demo.status === "rejected") {
    const history = [
      { at: demo.createdAt, text: "Demo e mensagem criadas" },
      demo.lastManualSend && { at: demo.lastManualSend.at, text: `Envio manual declarado por ${demo.lastManualSend.by} (entrega não verificada)` },
      { at: demo.rejectedAt!, text: `Recusada por ${demo.rejectedBy}` },
    ].filter((h): h is { at: string; text: string } => !!h).sort((a, b) => a.at.localeCompare(b.at));
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-[#5c2a2e] p-4" aria-label="Demo recusada">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[14px] font-semibold text-ink">Demo e mensagem</h3>
          <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#e3a1a1]" role="status"><Ban size={14} aria-hidden /> Recusada</span>
        </div>
        <p className="text-[12px] text-ink-soft">Esta demo foi recusada e não pode ser aprovada, copiada nem enviada. O lead e o histórico continuam no CRM.</p>
        {!embedded && <Button size="sm" variant="secondary" className="self-start" onClick={() => window.open(demoPreviewUrl(demo, window.location.origin), "_blank", "noopener,noreferrer")}><ExternalLink aria-hidden /> Abrir demo</Button>}
        <div><p className="mb-1.5 text-[12px] font-semibold text-ink-soft">Mensagem guardada</p><p className="rounded-xl border border-seam p-3 text-[12.5px] leading-relaxed whitespace-pre-wrap text-ink-faint">{demo.message}</p></div>
        <div><p className="mb-1.5 text-[12px] font-semibold text-ink-soft">Histórico</p>
          <ol className="flex flex-col gap-1.5 text-[12px] text-ink-soft">{history.map((h) => <li key={`${h.at}${h.text}`} className="flex gap-2"><span className="tnum shrink-0 text-ink-faint">{formatDate(h.at)}</span><span>{h.text}</span></li>)}</ol>
        </div>
        <Button size="sm" className="self-start" disabled={blocked} onClick={() => act(() => restoreLeadDemo(lead.id), "Demo restaurada para aguardando aprovação")}><RotateCcw aria-hidden /> Restaurar para aguardando aprovação</Button>
        {blocked && <p role="status" className="text-[12px] text-warn">Aguarde a gravação ou resolva o erro de armazenamento para restaurar.</p>}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-seam-strong p-4" aria-label="Demo e mensagem">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-ink">Demo e mensagem</h3>
        <span className={demo.status === "approved" && !dirty ? "text-[12px] font-semibold text-mint" : "text-[12px] font-semibold text-warn"} role="status">{sent && !dirty ? "Envio registrado" : demo.status === "approved" && !dirty ? "Aprovada · envio manual" : "Aguardando aprovação"}</span>
      </div>
      <p className="text-[12px] text-ink-faint">{demo.version === 5 ? "Criada pelo gerador com Unique Site Designer. Imagem, textos e composição foram produzidos para este negócio e comparados com o histórico acessível." : demo.version === 4 ? "Conceito exclusivo revisado com Unique Site Designer, com imagem ilustrativa criada por IA e textos próprios." : demo.version === 3 ? "Variação visual por negócio. Confira a imagem e os textos na revisão criativa." : "Modelo por segmento com nome, cidade e telefone disponíveis."} Demonstração não oficial. Revise os dados antes de aprovar.</p>
      <DemoGeneratorStatus leadId={lead.id} />
      <Button size="sm" className="self-start" variant="secondary" loading={generating} disabled={blocked || dirty || !generator.connection?.available} onClick={() => enqueueDemoGeneration([lead.id])}><Monitor aria-hidden /> {demo.version === 5 ? "Gerar outra direção com IA" : "Gerar demo exclusiva com IA"}</Button>
      {!embedded && <Button size="sm" variant="secondary" className="self-start" onClick={() => window.open(demoPreviewUrl(demo, window.location.origin), "_blank", "noopener,noreferrer")}><ExternalLink aria-hidden /> Abrir demo</Button>}
      {(availableConcept || demo.version < 3) && <div className="rounded-xl border border-seam p-3 text-[12px] text-ink-soft"><p className="mb-2">{availableConcept ? "Este negócio tem um conceito aprovado, com imagem e textos próprios. A aplicação devolve a mensagem à revisão e conserva textos editados por você." : "Atualize a composição e confira possíveis repetições de imagem e texto antes da aprovação."}</p><Button size="sm" variant="secondary" disabled={blocked || dirty} onClick={() => act(() => { upgradeLeadDemoDesign(lead.id); setReviewed(false); }, "Visual pronto para revisão")}>{availableConcept ? "Aplicar conceito aprovado" : "Personalizar visual da demo"}</Button></div>}
      {creativeIssues.length > 0 && demo.status !== "approved" && <div role="status" className="rounded-xl border border-warn/30 bg-warn/5 p-3 text-[12px] text-ink-soft"><p className="font-semibold text-warn">Revisão criativa pendente</p><ul className="mt-2 list-disc space-y-1 pl-4">{creativeIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul><p className="mt-2">Use “Gerar demo exclusiva com IA” para o Sellora criar uma imagem, textos e composição próprios com a skill.</p></div>}
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
          <Button size="sm" className="self-start" disabled={!reviewed || dirty || blocked || creativeIssues.length > 0} onClick={() => act(() => approveLeadDemo(lead.id), "Mensagem aprovada para envio manual")}><CheckCheck aria-hidden /> Aprovar mensagem</Button>
        </>
      )}
      {blocked && <p role="status" className="text-[12px] text-warn">Aguarde a gravação ou resolva o erro de armazenamento para aprovar e copiar.</p>}
      {demo.lastManualSend && <p className="rounded-xl border border-seam p-3 text-[12px] text-ink-soft">Último envio manual declarado em {formatDate(demo.lastManualSend.at)} por {demo.lastManualSend.by}. Entrega não verificada pelo Sellora.</p>}
      <p className="text-[11.5px] text-ink-faint">Nenhum envio automático. Só “Já enviei” atualiza o último contato e registra a atividade no CRM.</p>
      <ConfirmDialog open={confirmSent} onOpenChange={setConfirmSent} title="Você já enviou esta mensagem?" description={`Confirme apenas se você apertou Enviar no WhatsApp para ${lead.name}, no número ${lead.phone}. Isso registra o contato no CRM; não confirma entrega nem envia outra mensagem.`} confirmLabel="Confirmar envio manual" destructive={false} onConfirm={() => act(() => markDemoManuallySent(lead.id, window.location.origin), "Envio manual registrado no CRM")} />
    </section>
  );
}
