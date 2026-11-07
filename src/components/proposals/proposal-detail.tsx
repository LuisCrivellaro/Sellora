"use client";

import { Copy, Pencil, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { LogoMark } from "@/components/shell/logo";
import { TonePill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { ConfirmDialog, Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { PROPOSAL_STATUSES, proposalStatusMeta } from "@/lib/constants";
import { deleteProposal, duplicateProposal, setProposalStatus } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { formatDate } from "@/lib/dates";
import { isExpired, proposalSubtotal, proposalTotal } from "@/lib/metrics/proposals";
import type { Proposal } from "@/lib/types";
import { formatBRL } from "@/lib/utils";

export function ProposalDetail({
  proposal,
  open,
  onOpenChange,
  onEdit,
  onDuplicated,
}: {
  proposal: Proposal | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onEdit: (p: Proposal) => void;
  onDuplicated: (p: Proposal) => void;
}) {
  const { db } = useStore();
  const { notify } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  if (!proposal || !db) return null;
  const pkg = db.settings.packages.find((p) => p.id === proposal.packageId);
  const expired = isExpired(proposal);
  const lead = proposal.leadId ? db.leads.find((l) => l.id === proposal.leadId) : null;

  return (
    <>
      <Modal open={open} onOpenChange={onOpenChange} variant="sheet" size="xl" title={proposal.title} description={`Para ${proposal.recipientName} · criada em ${formatDate(proposal.createdAt)}`}>
        <div className="no-print flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <TonePill tone={proposalStatusMeta[proposal.status].tone}>{proposalStatusMeta[proposal.status].label}</TonePill>
            {expired && <TonePill tone="danger">Validade vencida</TonePill>}
            {lead && (
              <Link href={`/leads?id=${lead.id}`} className="text-[12px] font-semibold text-lilac hover:text-ink">
                Ver lead
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => onEdit(proposal)}>
              <Pencil aria-hidden /> Editar
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                const copy = duplicateProposal(proposal.id);
                notify({ kind: "success", title: "Proposta duplicada", description: copy.title });
                onDuplicated(copy);
              }}
            >
              <Copy aria-hidden /> Duplicar
            </Button>
            <Button size="sm" variant="secondary" onClick={() => window.print()}>
              <Printer aria-hidden /> Imprimir / salvar PDF
            </Button>
            <Button size="sm" variant="ghost" className="text-danger hover:text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 aria-hidden /> Excluir
            </Button>
            <div className="ml-auto w-[200px]">
              <Select
                aria-label="Atualizar status da proposta"
                value={proposal.status}
                onValueChange={(s) => {
                  setProposalStatus(proposal.id, s);
                  notify({ kind: "success", title: `Status: ${proposalStatusMeta[s].label}`, description: s === "enviada" ? "Registrado como enviada. O envio em si é feito por você." : undefined });
                }}
                options={PROPOSAL_STATUSES.map((s) => ({ value: s, label: proposalStatusMeta[s].label }))}
              />
            </div>
          </div>
          {proposal.status === "aprovada" && lead && !lead.clientId && (
            <p className="rounded-2xl border border-[rgba(29,233,182,0.35)] bg-[rgba(29,233,182,0.06)] px-4 py-3 text-[13px] text-ink">
              Proposta aprovada. Converta o lead em cliente na{" "}
              <Link href={`/leads?id=${lead.id}`} className="font-semibold text-mint underline-offset-2 hover:underline">
                ficha do lead
              </Link>
              .
            </p>
          )}
        </div>

        {/* Documento imprimível */}
        <article className="print-area mt-5 rounded-2xl bg-[#f7f5fb] p-6 text-[#17131f] shadow-[0_20px_60px_-30px_rgba(0,0,0,0.9)] sm:p-8" aria-label="Pré-visualização da proposta">
          <header className="flex items-start justify-between gap-4 border-b border-[#ddd6ea] pb-4">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 place-items-center rounded-xl bg-[#17131f]">
                <LogoMark className="size-6" />
              </span>
              <div>
                <p className="text-[16px] font-extrabold tracking-[-0.02em]">Sellora</p>
                <p className="text-[11.5px] text-[#6b6480]">Sites profissionais para estabelecimentos</p>
              </div>
            </div>
            <div className="text-right text-[11.5px] text-[#6b6480]">
              <p>Proposta comercial</p>
              <p>Emitida em {formatDate(proposal.createdAt)}</p>
              <p>Válida até {formatDate(proposal.validUntil)}</p>
            </div>
          </header>
          <h3 className="mt-5 text-[20px] font-bold tracking-[-0.02em]">{proposal.title}</h3>
          <p className="mt-1 text-[13px] text-[#4b4560]">
            Para: <strong>{proposal.recipientName}</strong> · Pacote {pkg?.name ?? proposal.packageId}
          </p>

          <table className="mt-5 w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-[#ddd6ea] text-[11.5px] text-[#6b6480]">
                <th scope="col" className="py-2 font-semibold">Item</th>
                <th scope="col" className="py-2 text-right font-semibold">Qtd.</th>
                <th scope="col" className="py-2 text-right font-semibold">Unitário</th>
                <th scope="col" className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {proposal.items.map((i) => (
                <tr key={i.id} className="border-b border-[#ebe6f3]">
                  <td className="py-2.5">{i.description}</td>
                  <td className="tnum py-2.5 text-right">{i.quantity}</td>
                  <td className="tnum py-2.5 text-right">{formatBRL(i.unitPrice)}</td>
                  <td className="tnum py-2.5 text-right">{formatBRL(i.quantity * i.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="tnum">
              <tr>
                <td colSpan={3} className="pt-3 text-right text-[#6b6480]">Subtotal</td>
                <td className="pt-3 text-right">{formatBRL(proposalSubtotal(proposal))}</td>
              </tr>
              {proposal.discount > 0 && (
                <tr>
                  <td colSpan={3} className="text-right text-[#6b6480]">Desconto</td>
                  <td className="text-right">− {formatBRL(proposal.discount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={3} className="pt-1 text-right font-bold">Total</td>
                <td className="pt-1 text-right text-[17px] font-extrabold">{formatBRL(proposalTotal(proposal))}</td>
              </tr>
            </tfoot>
          </table>

          <dl className="mt-6 grid grid-cols-1 gap-4 text-[13px] sm:grid-cols-3">
            <div>
              <dt className="text-[11.5px] font-semibold text-[#6b6480]">Prazo de entrega</dt>
              <dd>{proposal.deadlineDays} dias após briefing e conteúdo recebidos</dd>
            </div>
            <div>
              <dt className="text-[11.5px] font-semibold text-[#6b6480]">Revisões incluídas</dt>
              <dd>{proposal.revisions} rodadas</dd>
            </div>
            <div>
              <dt className="text-[11.5px] font-semibold text-[#6b6480]">Pagamento</dt>
              <dd>{proposal.paymentTerms || "A combinar"}</dd>
            </div>
          </dl>
          {proposal.exclusions && (
            <p className="mt-5 rounded-xl bg-[#ece7f5] px-4 py-3 text-[12.5px] text-[#4b4560]">
              <strong>Não incluso:</strong> {proposal.exclusions}
            </p>
          )}
          <p className="mt-6 text-[11.5px] text-[#6b6480]">
            Proposta sujeita a confirmação de escopo. Sem garantia de resultados de vendas ou posicionamento em buscadores. Aceite por escrito antes do início.
          </p>
        </article>
      </Modal>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir proposta?"
        description={`“${proposal.title}” será removida deste navegador. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir proposta"
        onConfirm={() => {
          deleteProposal(proposal.id);
          onOpenChange(false);
          notify({ kind: "success", title: "Proposta excluída" });
        }}
      />
    </>
  );
}
