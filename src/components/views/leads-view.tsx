"use client";

import { Eye, Kanban, MoreHorizontal, Pencil, Plus, Radar, Rows3, Trash2, X } from "lucide-react";
import { ProspectingTab } from "@/components/prospecting/prospecting-tab";
import { useMemo, useState } from "react";
import { CapsuleBarChart } from "@/components/charts/bar-charts";
import { DonutChart } from "@/components/charts/donut";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { LeadDetail } from "@/components/leads/lead-detail";
import { LeadForm } from "@/components/leads/lead-form";
import { LeadKanban } from "@/components/leads/lead-kanban";
import { SourceIcon } from "@/components/shared/source-icon";
import { useUrlParams } from "@/components/shared/use-url-state";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge, TonePill } from "@/components/ui/dashboard-badge";
import { Button } from "@/components/ui/button";
import { DashboardCard, LegendStat } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput, Select } from "@/components/ui/field";
import { FilterPopover, type FilterValue } from "@/components/ui/filter-popover";
import { ConfirmDialog, Menu } from "@/components/ui/overlay";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { LEAD_SOURCES, LEAD_STAGES, leadSourceMeta, leadStageMeta, priorityMeta, SEGMENTS, segmentMeta, temperatureMeta, websiteSituationMeta } from "@/lib/constants";
import { deleteLead, moveLeadStage } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { buildBuckets, countByBucket, formatDate, formatRelative } from "@/lib/dates";
import { leadsWithoutContact, pendingFollowUps, sourceDistribution, temperatureDistribution } from "@/lib/metrics/leads";
import type { Lead, LeadStage, LeadTemperature } from "@/lib/types";
import { cn, matchesQuery, sum } from "@/lib/utils";
import { dashboardTemperatureColors, dashboardTone as tone } from "@/lib/visualization";

const SPECIAL: Record<string, string> = { sem_contato: "Sem contato registrado", follow_up: "Com follow-up pendente" };

export function LeadsView() {
  const { db } = useStore();
  const { params, setParams } = useUrlParams();
  const { notify } = useToast();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterValue>({ stage: [], source: [], priority: [], segment: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(params.get("novo") === "1");
  const [editing, setEditing] = useState<Lead | null>(null);
  const [toDelete, setToDelete] = useState<Lead | null>(null);

  const view = params.get("visao") === "kanban" ? "kanban" : "tabela";
  const tab = params.get("aba") === "prospeccao" ? "prospeccao" : "crm";
  const special = params.get("filtro");
  const detailId = params.get("id");

  const filtered = useMemo(() => {
    if (!db) return [];
    const noContact = new Set(leadsWithoutContact(db.leads).map((l) => l.id));
    const withFollow = new Set(pendingFollowUps(db.activities).map((f) => f.activity.leadId));
    return db.leads.filter(
      (l) =>
        matchesQuery(query, l.name, l.city, l.email, l.instagram, l.phone, l.nextAction) &&
        (!filters.stage.length || filters.stage.includes(l.stage)) &&
        (!filters.source.length || filters.source.includes(l.source)) &&
        (!filters.priority.length || filters.priority.includes(l.priority)) &&
        (!filters.segment.length || filters.segment.includes(l.segment)) &&
        (special !== "sem_contato" || noContact.has(l.id)) &&
        (special !== "follow_up" || withFollow.has(l.id)),
    );
  }, [db, query, filters, special]);

  const analytics = useMemo(() => {
    if (!db) return null;
    const buckets = buildBuckets("90d").slice(-8);
    return {
      captured: { buckets, values: countByBucket(buckets, db.leads.map((l) => l.createdAt)) },
      sources: sourceDistribution(db.leads),
      temperature: temperatureDistribution(db.leads),
    };
  }, [db]);

  if (!db || !analytics) return <PageSkeleton rows={[["col-span-12 lg:col-span-4 h-[300px]", "col-span-12 lg:col-span-4 h-[300px]", "col-span-12 lg:col-span-4 h-[300px]"], ["col-span-12 h-[520px]"]]} />;

  const detail = detailId ? (db.leads.find((l) => l.id === detailId) ?? null) : null;
  const tempTotal = sum(Object.values(analytics.temperature));
  const maxSource = Math.max(1, ...analytics.sources.map((s) => s.count));

  const columns: Column<Lead>[] = [
    {
      key: "name",
      header: "Estabelecimento",
      sortValue: (l) => l.name,
      cell: (l) => (
        <span className="flex items-center gap-3">
          <Avatar name={l.name} size={32} />
          <span className="min-w-0">
            <span className="block max-w-[220px] truncate font-semibold">{l.name}</span>
            <span className="block text-[11.5px] text-ink-faint xl:hidden">{segmentMeta[l.segment].label}</span>
          </span>
        </span>
      ),
    },
    { key: "segment", header: "Segmento", hideBelow: "xl", sortValue: (l) => segmentMeta[l.segment].label, cell: (l) => segmentMeta[l.segment].label },
    { key: "city", header: "Cidade", hideBelow: "lg", sortValue: (l) => l.city, cell: (l) => `${l.city}/${l.uf}` },
    {
      key: "source",
      header: "Origem",
      sortValue: (l) => leadSourceMeta[l.source].label,
      cell: (l) => (
        <span className="tile inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] whitespace-nowrap">
          <span style={{ color: tone[leadSourceMeta[l.source].tone] }} className="contents"><SourceIcon source={l.source} className="size-3.5" /></span>
          {leadSourceMeta[l.source].label}
        </span>
      ),
    },
    {
      key: "website",
      header: "Website",
      hideBelow: "xl",
      sortValue: (l) => l.websiteSituation,
      cell: (l) => <StatusBadge size="sm" tone={websiteSituationMeta[l.websiteSituation].tone} label={websiteSituationMeta[l.websiteSituation].label} />,
    },
    { key: "stage", header: "Status", sortValue: (l) => LEAD_STAGES.indexOf(l.stage), cell: (l) => <StatusBadge tone={leadStageMeta[l.stage].tone} label={leadStageMeta[l.stage].label} /> },
    { key: "priority", header: "Prioridade", sortValue: (l) => priorityMeta[l.priority].rank, cell: (l) => <TonePill tone={priorityMeta[l.priority].tone}>{priorityMeta[l.priority].label}</TonePill> },
    {
      key: "last",
      header: "Último contato",
      hideBelow: "lg",
      sortValue: (l) => l.lastContactAt ?? "",
      cell: (l) => <span className="tnum whitespace-nowrap">{l.lastContactAt ? formatRelative(l.lastContactAt) : <span className="text-ink-faint">Sem contato</span>}</span>,
    },
    {
      key: "next",
      header: "Próxima ação",
      sortValue: (l) => l.nextActionAt ?? "9999",
      cell: (l) =>
        l.nextActionAt ? (
          <span className="block max-w-[200px]">
            <span className="block truncate text-ink">{l.nextAction || "—"}</span>
            <span className={cn("tnum text-[11.5px]", new Date(l.nextActionAt) < new Date(new Date().toDateString()) ? "text-danger" : "text-ink-faint")}>
              {formatDate(l.nextActionAt)} · {formatRelative(l.nextActionAt)}
            </span>
          </span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
  ];

  const openDetail = (l: Lead) => setParams({ id: l.id });

  return (
    <>
      <PageHeader
        title="Leads"
        description={tab === "prospeccao" ? "Prospecção IA: encontre estabelecimentos sem presença digital adequada e leve ao CRM." : "CRM de estabelecimentos: pesquise, qualifique e mova no funil."}
        actions={
          <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden /> Novo lead
          </Button>
        }
      />
      <Segmented
        label="Seção de leads"
        size="md"
        className="mb-4"
        value={tab}
        onChange={(v) => setParams({ aba: v === "prospeccao" ? "prospeccao" : null })}
        options={[
          { value: "crm", label: <><Rows3 className="size-4" aria-hidden /> CRM</> },
          { value: "prospeccao", label: <><Radar className="size-4" aria-hidden /> Prospecção IA</> },
        ]}
      />
      {tab === "prospeccao" ? (
        <ProspectingTab onOpenLead={(id) => setParams({ aba: null, id })} />
      ) : (
      <div className="grid grid-cols-12 gap-3.5">
        <DashboardCard index={0} className="col-span-12 md:col-span-6 xl:col-span-4" title="Captação de leads" description="Novos leads por semana · 8 semanas">
          <div className="mb-2 flex gap-5">
            <LegendStat color={tone.magenta} label="No período" value={sum(analytics.captured.values)} />
          </div>
          <CapsuleBarChart
            height={210}
            data={analytics.captured.buckets.map((b, i) => ({ label: b.label, longLabel: b.longLabel, value: analytics.captured.values[i] }))}
            summary={`Leads captados por semana nas últimas 8 semanas, total ${sum(analytics.captured.values)}`}
            unit=" leads"
          />
        </DashboardCard>

        <DashboardCard index={1} className="col-span-12 md:col-span-6 xl:col-span-4" title="Origem dos leads" description="Quantidade por canal de captação">
          <ul className="flex flex-1 flex-col justify-around gap-4">
            {analytics.sources.map((s) => {
              const meta = leadSourceMeta[s.source];
              return (
                <li key={s.source}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      <SourceIcon source={s.source} className="size-4 text-ink-soft" />
                      {meta.label}
                    </span>
                    <span className="tnum text-[13.5px] font-bold text-ink">{s.count}</span>
                  </div>
                  <SegmentedBar value={s.count / maxSource} color={tone[meta.tone]} label={`${meta.label}`} valueText={`${s.count} leads`} />
                </li>
              );
            })}
          </ul>
        </DashboardCard>

        <DashboardCard index={2} className="col-span-12 xl:col-span-4" title="Temperatura dos leads" description="Derivada da etapa do funil">
          <div className="flex flex-1 items-center">
            <DonutChart
              size={200}
              centerLabel="leads no funil"
              summary={`Temperatura: ${(Object.keys(analytics.temperature) as LeadTemperature[]).map((k) => `${temperatureMeta[k].label} ${analytics.temperature[k]}`).join(", ")}`}
              slices={(Object.keys(analytics.temperature) as LeadTemperature[]).map((k) => ({
                key: k,
                label: temperatureMeta[k].label,
                value: analytics.temperature[k],
                color: dashboardTemperatureColors[k],
              }))}
              centerValue={String(tempTotal)}
            />
          </div>
          <p className="mt-3 text-[11.5px] text-ink-faint">Frio: novo/qualificado · Morno: contatado/respondeu · Quente: diagnóstico a negociação · Perdidos não entram.</p>
        </DashboardCard>

        <DashboardCard
          index={3}
          className="col-span-12"
          title="CRM de leads"
          description={`${filtered.length} de ${db.leads.length} leads`}
          actions={
            <Segmented
              label="Visualização"
              value={view}
              onChange={(v) => setParams({ visao: v === "kanban" ? "kanban" : null })}
              options={[
                { value: "tabela", label: <><Rows3 className="size-3.5" aria-hidden /> Tabela</> },
                { value: "kanban", label: <><Kanban className="size-3.5" aria-hidden /> Kanban</> },
              ]}
            />
          }
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput label="Buscar leads" value={query} onChange={setQuery} placeholder="Buscar por nome, cidade, contato…" className="w-full sm:w-[320px]" />
            <FilterPopover
              value={filters}
              onChange={setFilters}
              groups={[
                { key: "stage", label: "Etapa", options: LEAD_STAGES.map((s) => ({ value: s, label: leadStageMeta[s].label })) },
                { key: "source", label: "Origem", options: LEAD_SOURCES.map((s) => ({ value: s, label: leadSourceMeta[s].label })) },
                { key: "priority", label: "Prioridade", options: (["alta", "media", "baixa"] as const).map((s) => ({ value: s, label: priorityMeta[s].label })) },
                { key: "segment", label: "Segmento", options: SEGMENTS.map((s) => ({ value: s, label: segmentMeta[s].label })) },
              ]}
            />
            {special && SPECIAL[special] && (
              <button type="button" onClick={() => setParams({ filtro: null })} className="pill-active inline-flex h-8 items-center gap-1.5 px-3 text-[12.5px] font-semibold text-ink" aria-label={`Remover filtro: ${SPECIAL[special]}`}>
                {SPECIAL[special]} <X className="size-3.5" aria-hidden />
              </button>
            )}
            {selected.size > 0 && view === "tabela" && (
              <div className="ml-auto flex flex-wrap items-center gap-2 rounded-full border border-seam-strong bg-selected py-1 pr-1 pl-3.5">
                <span className="tnum text-[12.5px] font-semibold text-ink">{selected.size} selecionados</span>
                <div className="w-[190px]">
                  <Select<LeadStage | "">
                    size="sm"
                    aria-label="Mover selecionados para etapa"
                    value=""
                    placeholder="Mover para…"
                    onValueChange={(s) => {
                      if (!s) return;
                      selected.forEach((id) => moveLeadStage(id, s));
                      notify({ kind: "success", title: `${selected.size} leads movidos para ${leadStageMeta[s].label}` });
                      setSelected(new Set());
                    }}
                    options={LEAD_STAGES.map((s) => ({ value: s, label: leadStageMeta[s].label }))}
                  />
                </div>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Limpar seleção
                </Button>
              </div>
            )}
          </div>

          {view === "kanban" ? (
            filtered.length ? <LeadKanban leads={filtered} onOpen={openDetail} /> : <EmptyState title="Nenhum lead com esses filtros" description="Ajuste a busca ou limpe os filtros." />
          ) : (
            <DataTable
              key={`${query}|${JSON.stringify(filters)}|${special}`}
              rows={filtered}
              columns={columns}
              getRowId={(l) => l.id}
              getRowLabel={(l) => l.name}
              onOpen={openDetail}
              selectable
              selected={selected}
              onSelectedChange={setSelected}
              caption="Leads cadastrados"
              initialSort={{ key: "next", dir: "asc" }}
              rowActions={(l) => (
                <Menu
                  label={`Ações de ${l.name}`}
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${l.name}`}>
                      <MoreHorizontal aria-hidden />
                    </Button>
                  }
                  items={[
                    { label: "Ver detalhes e atividades", icon: <Eye />, onSelect: () => openDetail(l) },
                    { label: "Editar", icon: <Pencil />, onSelect: () => { setEditing(l); setFormOpen(true); } },
                    "separator",
                    { label: "Excluir", icon: <Trash2 />, destructive: true, onSelect: () => setToDelete(l) },
                  ]}
                />
              )}
              mobileCard={(l) => (
                <span className="flex flex-col gap-2">
                  <span className="flex items-center gap-2.5">
                    <Avatar name={l.name} size={30} />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-ink">{l.name}</span>
                      <span className="block text-[12px] text-ink-faint">
                        {segmentMeta[l.segment].label} · {l.city}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StatusBadge size="sm" tone={leadStageMeta[l.stage].tone} label={leadStageMeta[l.stage].label} />
                    <TonePill tone={priorityMeta[l.priority].tone}>{priorityMeta[l.priority].label}</TonePill>
                    <span className="text-[12px] text-ink-faint">{leadSourceMeta[l.source].label}</span>
                  </span>
                  {l.nextActionAt && (
                    <span className="text-[12px] text-ink-soft">
                      {l.nextAction} · {formatRelative(l.nextActionAt)}
                    </span>
                  )}
                </span>
              )}
              empty={
                <EmptyState
                  title={db.leads.length ? "Nenhum lead com esses filtros" : "Nenhum lead cadastrado"}
                  description={db.leads.length ? "Ajuste a busca ou limpe os filtros." : "Cadastre o primeiro estabelecimento encontrado na prospecção."}
                  action={
                    !db.leads.length && (
                      <Button variant="primary" onClick={() => setFormOpen(true)}>
                        <Plus aria-hidden /> Cadastrar lead
                      </Button>
                    )
                  }
                />
              }
            />
          )}
        </DashboardCard>
      </div>
      )}

      <LeadForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setEditing(null);
            if (params.get("novo")) setParams({ novo: null });
          }
        }}
        lead={editing}
        onSaved={(l) => !editing && setParams({ id: l.id, novo: null })}
      />
      <LeadDetail
        lead={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setParams({ id: null })}
        onEdit={(l) => {
          setEditing(l);
          setFormOpen(true);
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Excluir ${toDelete?.name ?? "lead"}?`}
        description="O lead e o histórico dele serão removidos deste navegador. Esta ação não pode ser desfeita."
        confirmLabel="Excluir lead"
        onConfirm={() => {
          if (toDelete) deleteLead(toDelete.id);
          notify({ kind: "success", title: "Lead excluído" });
          setToDelete(null);
        }}
      />
    </>
  );
}
