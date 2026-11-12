"use client";

import { CheckCheck, Eye, MessageSquareText, Monitor, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/card";
import { SearchInput } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/states";
import { Segmented } from "@/components/ui/segmented";
import { useStore } from "@/lib/data/store";
import { upgradeLeadDemoDesigns } from "@/lib/data/repository";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { segmentMeta } from "@/lib/constants";
import { matchesQuery } from "@/lib/utils";
import { demoReviewStage, manualDemoContactsOnDay } from "@/lib/demos/whatsapp";
import { demoDesignName } from "@/lib/demos/personalization";
import { DemoCover } from "./demo-cover";
import { DemoReview } from "./demo-review";
import { findApprovedConcept } from "@/lib/demos/concepts";
import { enqueueDemoGeneration, useDemoGenerator } from "@/lib/demos/generation-client";
import { DemoGeneratorStatus } from "./demo-generator-status";

const stageMeta = { pending: { label: "Aguardando aprovação", icon: MessageSquareText, color: "text-warn" }, approved: { label: "Aprovada · envio manual", icon: CheckCheck, color: "text-mint" }, sent: { label: "Envio registrado", icon: Send, color: "text-ink-soft" } };

export function DemoQueue({ onOpenLead }: { onOpenLead: (id: string) => void }) {
  const { db, mode, sync, storageError } = useStore();
  const { notify } = useToast();
  const generator = useDemoGenerator();
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [confirmConcepts, setConfirmConcepts] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [query, setQuery] = useState("");
  const [reviewId, setReviewId] = useState<string | null>(null);
  const leads = (db?.leads ?? []).filter((l) => l.demo);
  const legacyLeads = leads.filter((lead) => lead.demo!.version < 3);
  const conceptLeads = leads.filter((lead) => lead.demo!.version < 4 && findApprovedConcept(lead.demo!.business));
  const aiLeads = leads.filter((lead) => lead.demo!.version < 4 && lead.demo!.status === "pending");
  const blocked = mode === "supabase" ? sync.pending > 0 || !!sync.error : !!storageError;
  const pending = leads.filter((l) => demoReviewStage(l.demo!, l.phone) === "pending");
  const approved = leads.filter((l) => demoReviewStage(l.demo!, l.phone) === "approved");
  const sent = leads.filter((l) => demoReviewStage(l.demo!, l.phone) === "sent");
  const filtered = leads.filter((l) => (filter === "all" || demoReviewStage(l.demo!, l.phone) === filter) && matchesQuery(query, l.name, l.city, l.phone));
  const sentToday = manualDemoContactsOnDay(db?.activities ?? [], new Date().toISOString());
  const reviewLead = db?.leads.find((l) => l.id === reviewId) ?? null;
  return <>
    <DashboardCard index={7} className="col-span-12" title="Demos e mensagens" description="Um negócio por cartão. Abra, confira a demo e prepare sua próxima conversa." actions={<span className="rounded-full border border-seam-strong bg-selected px-3 py-1.5 text-[12px] text-ink-soft"><span className="tnum font-semibold text-ink">{sentToday}/10</span> contatos registrados hoje</span>}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented label="Filtrar mensagens" value={filter} onChange={setFilter} options={[{ value: "pending", label: `Para aprovar (${pending.length})` }, { value: "approved", label: `Aprovadas (${approved.length})` }, { value: "sent", label: `Envios (${sent.length})` }, { value: "all", label: "Todas" }]} />
        <SearchInput label="Buscar demos" value={query} onChange={setQuery} placeholder="Nome, cidade ou telefone…" className="w-full sm:w-64" />
        {aiLeads.length > 0 && <Button size="sm" disabled={blocked || !generator.connection?.available} onClick={() => enqueueDemoGeneration(aiLeads.map((lead) => lead.id))}>Gerar demos exclusivas com IA ({aiLeads.length})</Button>}
        {legacyLeads.length > 0 && <Button size="sm" variant="secondary" disabled={blocked} onClick={() => setConfirmUpgrade(true)}>Personalizar demos antigas ({legacyLeads.length})</Button>}
        {conceptLeads.length > 0 && <Button size="sm" disabled={blocked} onClick={() => setConfirmConcepts(true)}>Aplicar conceitos aprovados ({conceptLeads.length})</Button>}
      </div>
      <DemoGeneratorStatus />
      {filtered.length ? <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-label="Fila de revisão de mensagens">
        {filtered.map((lead) => {
          const demo = lead.demo!;
          const meta = stageMeta[demoReviewStage(demo, lead.phone)];
          const Icon = meta.icon;
          return <li key={lead.id} className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-seam-strong bg-facade-raised transition-colors hover:border-ink-faint">
            <button type="button" className="relative block w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink" aria-label={`Revisar demo de ${lead.name}`} onClick={() => setReviewId(lead.id)}>
              <DemoCover demo={demo} />
              <span className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/80 px-3 py-1.5 text-[11px] font-semibold text-white"><Eye size={13} aria-hidden /> Visualizar e revisar</span>
            </button>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div><h3 className="text-[15px] font-semibold break-words text-ink">{lead.name}</h3><p className="mt-0.5 text-[12px] text-ink-faint">{segmentMeta[lead.segment].label} · {lead.city}/{lead.uf}</p></div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11.5px]"><span className={`inline-flex items-center gap-1.5 ${meta.color}`}><Icon size={14} aria-hidden />{meta.label}</span><span className="inline-flex items-center gap-1 text-ink-faint"><Monitor size={13} aria-hidden />{demoDesignName(demo)}</span></div>
              <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-soft">{demo.message}</p>
              <Button size="sm" variant="secondary" className="mt-auto w-full justify-center" onClick={() => setReviewId(lead.id)}>Revisar demo e mensagem</Button>
            </div>
          </li>;
        })}
      </ul> : <EmptyState icon={<MessageSquareText size={20} aria-hidden />} title={leads.length ? "Nenhuma demo neste filtro" : "Sua próxima abordagem começa com uma demo"} description={leads.length ? "Ajuste a busca ou alterne entre pendentes, aprovadas e envios registrados." : "Revise os resultados da Prospecção IA e use Gerar prospecção com demo, ou gere pela ficha de um lead. Os cartões aparecerão aqui para revisão."} />}
      <p className="mt-4 text-[11.5px] text-ink-faint">A meta de 10 é uma referência diária. Os registros são manuais; abrir o WhatsApp não confirma envio ou entrega.</p>
    </DashboardCard>
    <DemoReview lead={reviewLead} onClose={() => setReviewId(null)} onOpenLead={onOpenLead} />
    <ConfirmDialog open={confirmConcepts} onOpenChange={setConfirmConcepts} title="Aplicar os conceitos aprovados?" description={`As ${conceptLeads.length} demos receberão imagem, textos e direção próprios. Mensagens editadas por você e o histórico de envio serão conservados. As demos voltarão à revisão.`} confirmLabel="Aplicar conceitos" destructive={false} onConfirm={() => {
      try {
        const count = upgradeLeadDemoDesigns(conceptLeads.map((lead) => lead.id));
        notify({ kind: "success", title: `${count} conceitos aplicados para revisão` });
      } catch (error) {
        notify({ kind: "error", title: "Não foi possível aplicar", description: error instanceof Error ? error.message : "Tente novamente." });
      }
    }} />
    <ConfirmDialog open={confirmUpgrade} onOpenChange={setConfirmUpgrade} title="Personalizar demos antigas?" description={`Cada uma das ${legacyLeads.length} demos antigas receberá uma composição por negócio. As mensagens voltarão para aprovação. O histórico de contatos será mantido.`} confirmLabel="Personalizar demos" destructive={false} onConfirm={() => {
      try {
        const count = upgradeLeadDemoDesigns(legacyLeads.map((lead) => lead.id));
        notify({ kind: "success", title: `${count} demos personalizadas para revisão` });
      } catch (error) {
        notify({ kind: "error", title: "Não foi possível personalizar", description: error instanceof Error ? error.message : "Tente novamente." });
      }
    }} />
  </>;
}
