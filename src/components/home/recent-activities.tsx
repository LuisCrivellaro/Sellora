"use client";

import { ArrowUpRight, Eye, FilePlus2, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SourceIcon } from "@/components/shared/source-icon";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/card";
import { StatusBadge, TonePill } from "@/components/ui/dashboard-badge";
import { DataTable, type Column } from "@/components/ui/data-table";
import { FilterPopover, type FilterValue } from "@/components/ui/filter-popover";
import { SearchInput } from "@/components/ui/field";
import { Menu } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/states";
import { LEAD_SOURCES, LEAD_STAGES, leadSourceMeta, leadStageMeta, priorityMeta } from "@/lib/constants";
import { formatDate, formatRelative, startOfDay, type RangeKey } from "@/lib/dates";
import type { RecentCommercialLead } from "@/lib/metrics/home-overview";
import { cn, matchesQuery } from "@/lib/utils";

export function RecentCommercialActivities({ rows, range }: { rows: RecentCommercialLead[]; range: RangeKey }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterValue>({ stage: [], source: [], priority: [] });
  const filtered = useMemo(() => rows.filter(({ lead, activity }) =>
    matchesQuery(query, lead.name, lead.city, activity, lead.nextAction, leadSourceMeta[lead.source].label) &&
    (!filters.stage.length || filters.stage.includes(lead.stage)) &&
    (!filters.source.length || filters.source.includes(lead.source)) &&
    (!filters.priority.length || filters.priority.includes(lead.priority)),
  ), [rows, query, filters]);
  const open = (row: RecentCommercialLead) => router.push(`/leads?id=${row.lead.id}`);
  const columns: Column<RecentCommercialLead>[] = [
    { key: "name", header: "Estabelecimento", sortValue: (row) => row.lead.name, cell: (row) => (
      <span className="flex items-center gap-2.5">
        <Avatar name={row.lead.name} size={28} />
        <span className="block min-w-0">
          <span className="block max-w-[190px] truncate font-semibold text-ink">{row.lead.name}</span>
          <span className="block max-w-[190px] truncate text-[11px] text-ink-faint" title={`${row.activity} · ${formatDate(row.recentAt)}`}>{row.activity}</span>
        </span>
      </span>
    ) },
    { key: "source", header: "Origem", sortValue: (row) => leadSourceMeta[row.lead.source].label, cell: (row) => <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px]"><SourceIcon source={row.lead.source} className="size-3.5" />{leadSourceMeta[row.lead.source].label}</span> },
    { key: "stage", header: "Status do funil", sortValue: (row) => LEAD_STAGES.indexOf(row.lead.stage), cell: (row) => <StatusBadge size="sm" tone={leadStageMeta[row.lead.stage].tone} label={leadStageMeta[row.lead.stage].label} /> },
    { key: "priority", header: "Prioridade", sortValue: (row) => priorityMeta[row.lead.priority].rank, cell: (row) => <TonePill tone={priorityMeta[row.lead.priority].tone}>{priorityMeta[row.lead.priority].label}</TonePill> },
    { key: "last", header: "Último contato", sortValue: (row) => row.lastContactAt, cell: (row) => row.lastContactAt ? <span className="block whitespace-nowrap text-[12px] text-ink">{formatDate(row.lastContactAt)}<span className="block text-[11px] text-ink-faint">{formatRelative(row.lastContactAt)}</span></span> : <span className="whitespace-nowrap text-[12px] text-ink-faint">Sem contato</span> },
    { key: "next", header: "Próxima ação", sortValue: (row) => row.lead.nextActionAt, cell: ({ lead }) => (
      <span className="block min-w-[150px] max-w-[200px]">
        <span className="block truncate text-[12px] text-ink" title={lead.nextAction}>{lead.nextAction || "Sem ação registrada"}</span>
        <span className={cn("block whitespace-nowrap text-[11px]", lead.nextActionAt && new Date(lead.nextActionAt) < startOfDay(new Date()) ? "text-danger" : "text-ink-faint")}>{lead.nextActionAt ? `${formatDate(lead.nextActionAt)} · ${formatRelative(lead.nextActionAt)}` : "Sem data agendada"}</span>
      </span>
    ) },
  ];

  return (
    <DashboardCard index={6} title="Atividades comerciais recentes" description={`${rows.length} estabelecimentos com movimentação no período · mais recentes primeiro`} className="home-activity-card" actions={<Button variant="secondary" size="sm" asChild><Link href="/leads">Ver CRM <ArrowUpRight aria-hidden /></Link></Button>}>
      <div className="home-activity-tools">
        <SearchInput label="Buscar atividades comerciais" value={query} onChange={setQuery} placeholder="Buscar estabelecimento ou atividade…" className="w-full sm:w-[320px]" />
        <FilterPopover value={filters} onChange={setFilters} groups={[
          { key: "stage", label: "Etapa", options: LEAD_STAGES.map((stage) => ({ value: stage, label: leadStageMeta[stage].label })) },
          { key: "source", label: "Origem", options: LEAD_SOURCES.map((source) => ({ value: source, label: leadSourceMeta[source].label })) },
          { key: "priority", label: "Prioridade", options: ["alta", "media", "baixa"].map((priority) => ({ value: priority, label: priorityMeta[priority as keyof typeof priorityMeta].label })) },
        ]} />
        {(query || Object.values(filters).some((values) => values.length > 0)) && <span className="text-[12px] text-ink-faint">{filtered.length} resultados</span>}
      </div>
      <div className="home-activity-table">
        <DataTable
          key={`${range}|${query}|${JSON.stringify(filters)}`}
          rows={filtered}
          columns={columns}
          caption="Atividades comerciais recentes"
          getRowId={(row) => row.lead.id}
          getRowLabel={(row) => row.lead.name}
          onOpen={open}
          pageSize={6}
          mobileLayout="table"
          mobileCard={(row) => row.lead.name}
          rowActions={(row) => <Menu label={`Ações de ${row.lead.name}`} trigger={<Button variant="ghost" size="icon-sm" aria-label={`Ações de ${row.lead.name}`}><MoreHorizontal aria-hidden /></Button>} items={[
            { label: "Ver lead e atividades", icon: <Eye />, onSelect: () => open(row) },
            { label: "Criar proposta", icon: <FilePlus2 />, onSelect: () => router.push(`/propostas?novo=1&lead=${row.lead.id}`) },
          ]} />}
          empty={<EmptyState title={rows.length ? "Nenhuma atividade com esses filtros" : "Nenhuma movimentação neste período"} description={rows.length ? "Ajuste a busca ou os filtros para ver outros registros." : "Leads cadastrados e atividades registradas no CRM aparecerão aqui."} action={<Button variant="secondary" size="sm" asChild><Link href="/leads">Abrir CRM <ArrowUpRight aria-hidden /></Link></Button>} />}
        />
      </div>
    </DashboardCard>
  );
}
