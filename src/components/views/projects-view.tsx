"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { StackedRibbonChart } from "@/components/charts/bar-charts";
import { DonutChart } from "@/components/charts/donut";
import { Heatmap } from "@/components/charts/heatmap";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { ProjectDetail } from "@/components/projects/project-detail";
import { ProjectForm } from "@/components/projects/project-form";
import { useUrlParams } from "@/components/shared/use-url-state";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/field";
import { FilterPopover, type FilterValue } from "@/components/ui/filter-popover";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { PROJECT_STAGES, projectStageMeta, projectStatusMeta, siteTypeMeta, tone } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { addMonths, formatDate, formatMonth, formatRelative, formatShort } from "@/lib/dates";
import { activityHeatmap } from "@/lib/metrics/leads";
import { projectDeadline, projectProgress, projectStatus, statusCounts } from "@/lib/metrics/projects";
import type { Project, ProjectStatus } from "@/lib/types";
import { cn, matchesQuery } from "@/lib/utils";

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function ProjectsView() {
  const { db } = useStore();
  const { params, setParams } = useUrlParams();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterValue>({ stage: [], status: [], siteType: [] });
  const [formOpen, setFormOpen] = useState(params.get("novo") === "1");
  const [editing, setEditing] = useState<Project | null>(null);
  const special = params.get("filtro");

  const data = useMemo(() => {
    if (!db) return null;
    const now = new Date();
    // Coortes por mês de início (últimos 6 meses), empilhadas pela etapa atual.
    const months = Array.from({ length: 6 }, (_, i) => {
      const start = addMonths(new Date(now.getFullYear(), now.getMonth(), 1), i - 5);
      return { start, end: addMonths(start, 1) };
    });
    const columns = months.map((m) => {
      const inMonth = db.projects.filter((p) => {
        const t = new Date(p.startDate).getTime();
        return t >= m.start.getTime() && t < m.end.getTime();
      });
      return { label: formatMonth(m.start), segments: PROJECT_STAGES.map((s) => ({ key: s, value: inMonth.filter((p) => p.stage === s).length })) };
    });
    const heat = activityHeatmap(db.activities, 12, now, (a) => !!a.projectId && a.description.startsWith("Tarefa concluída"));
    return { columns, heat, status: statusCounts(db.projects) };
  }, [db]);

  if (!db || !data) return <PageSkeleton />;

  const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? "—";
  const rows = db.projects.filter((p) => {
    const d = projectDeadline(p);
    return (
      matchesQuery(query, p.title, clientName(p.clientId)) &&
      (!filters.stage.length || filters.stage.includes(p.stage)) &&
      (!filters.status.length || filters.status.includes(projectStatus(p))) &&
      (!filters.siteType.length || filters.siteType.includes(p.siteType)) &&
      (special !== "prazo" || d.soon || d.overdue)
    );
  });
  const detailId = params.get("id");
  const detail = detailId ? (db.projects.find((p) => p.id === detailId) ?? null) : null;
  const totalProjects = db.projects.length;

  const columns: Column<Project>[] = [
    {
      key: "title",
      header: "Projeto",
      sortValue: (p) => p.title,
      cell: (p) => <span className="block max-w-[240px] truncate font-semibold">{p.title}</span>,
    },
    {
      key: "client",
      header: "Cliente",
      sortValue: (p) => clientName(p.clientId),
      cell: (p) => (
        <span className="flex items-center gap-2">
          <Avatar name={clientName(p.clientId)} size={24} />
          <span className="max-w-[160px] truncate">{clientName(p.clientId)}</span>
        </span>
      ),
    },
    { key: "type", header: "Tipo de site", hideBelow: "xl", sortValue: (p) => p.siteType, cell: (p) => siteTypeMeta[p.siteType].label },
    { key: "start", header: "Início", hideBelow: "xl", sortValue: (p) => p.startDate, cell: (p) => <span className="tnum">{formatDate(p.startDate)}</span> },
    {
      key: "due",
      header: "Prazo",
      sortValue: (p) => p.dueDate,
      cell: (p) => {
        const d = projectDeadline(p);
        return (
          <span className="tnum whitespace-nowrap">
            {formatDate(p.dueDate)}
            <span className={cn("block text-[11.5px]", d.overdue ? "text-danger" : d.soon ? "text-warn" : "text-ink-faint")}>{d.done ? "entregue" : formatRelative(p.dueDate)}</span>
          </span>
        );
      },
    },
    { key: "stage", header: "Etapa", hideBelow: "lg", sortValue: (p) => PROJECT_STAGES.indexOf(p.stage), cell: (p) => projectStageMeta[p.stage].label },
    {
      key: "progress",
      header: "Progresso",
      sortValue: (p) => projectProgress(p),
      cell: (p) => (
        <span className="flex w-[150px] items-center gap-2.5">
          <SegmentedBar size="sm" value={projectProgress(p) / 100} color={tone.violet} label={`Progresso ${p.title}`} />
          <span className="tnum w-9 text-right text-[12px] font-bold text-ink">{projectProgress(p)}%</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortValue: (p) => projectStatus(p),
      cell: (p) => <StatusBadge tone={projectStatusMeta[projectStatus(p)].tone} label={projectStatusMeta[projectStatus(p)].label} />,
    },
  ];

  const statusKeys = Object.keys(projectStatusMeta) as ProjectStatus[];
  const statusColors: Record<ProjectStatus, string> = { nao_iniciado: "#6f6cff", em_desenvolvimento: "#8f4bff", em_revisao: "#f230d6", concluido: "#1de9b6" };

  return (
    <>
      <PageHeader
        title="Projetos"
        description="Produção e entrega dos sites contratados."
        actions={
          <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden /> Novo projeto
          </Button>
        }
      />
      <div className="grid grid-cols-12 gap-3.5">
        <DashboardCard index={0} className="col-span-12 md:col-span-6 xl:col-span-4" title="Projetos por etapa" description="Por mês de início · cor = etapa atual">
          <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1">
            {PROJECT_STAGES.map((s) => (
              <span key={s} className="flex items-center gap-1.5 text-[11.5px] text-ink-soft">
                <span className="size-2 rounded-full" style={{ background: tone[projectStageMeta[s].tone] }} aria-hidden />
                {projectStageMeta[s].label}
              </span>
            ))}
          </div>
          <StackedRibbonChart
            height={220}
            columns={data.columns}
            keys={PROJECT_STAGES.map((s) => ({ key: s, label: projectStageMeta[s].label, color: tone[projectStageMeta[s].tone] }))}
            summary={`Projetos iniciados por mês: ${data.columns.map((c) => `${c.label} ${c.segments.reduce((a, b) => a + b.value, 0)}`).join(", ")}`}
          />
        </DashboardCard>

        <DashboardCard index={1} className="col-span-12 md:col-span-6 xl:col-span-4" title="Atividade de produção" description="Tarefas concluídas por dia · 12 semanas">
          <Heatmap
            rows={DAYS}
            columns={data.heat.weekStarts.map((d) => formatShort(d))}
            grid={data.heat.grid.map((row) => row.map((c) => ({ count: c.count, future: c.future, label: formatDate(c.date.toISOString()) })))}
            max={data.heat.max}
            unit="tarefas concluídas"
            columnEvery={3}
            summary={`Tarefas concluídas por dia nas últimas 12 semanas. Máximo diário: ${data.heat.max}`}
          />
        </DashboardCard>

        <DashboardCard index={2} className="col-span-12 xl:col-span-4" title="Status dos projetos" description="Derivado da etapa e das tarefas">
          <div className="flex flex-1 items-center">
            <DonutChart
              variant="ticks"
              size={200}
              legendPosition="right"
              centerLabel="projetos"
              summary={`Status: ${statusKeys.map((k) => `${projectStatusMeta[k].label} ${data.status[k]}`).join(", ")}`}
              slices={statusKeys.map((k) => ({ key: k, label: projectStatusMeta[k].label, value: data.status[k], color: statusColors[k] }))}
            />
          </div>
        </DashboardCard>

        <DashboardCard index={3} className="col-span-12" title="Lista de projetos" description={`${rows.length} de ${totalProjects} projetos · progresso = tarefas concluídas ÷ total`}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput label="Buscar projetos" value={query} onChange={setQuery} placeholder="Buscar por projeto ou cliente…" className="w-full sm:w-[320px]" />
            <FilterPopover
              value={filters}
              onChange={setFilters}
              groups={[
                { key: "stage", label: "Etapa", options: PROJECT_STAGES.map((s) => ({ value: s, label: projectStageMeta[s].label })) },
                { key: "status", label: "Status", options: statusKeys.map((s) => ({ value: s, label: projectStatusMeta[s].label })) },
                { key: "siteType", label: "Tipo de site", options: Object.entries(siteTypeMeta).map(([v, m]) => ({ value: v, label: m.label })) },
              ]}
            />
            {special === "prazo" && (
              <button type="button" onClick={() => setParams({ filtro: null })} className="pill-active inline-flex h-8 items-center gap-1.5 px-3 text-[12.5px] font-semibold text-ink" aria-label="Remover filtro de prazo próximo">
                Prazo em até 7 dias ou atrasado <X className="size-3.5" aria-hidden />
              </button>
            )}
          </div>
          <DataTable
            key={`${query}|${JSON.stringify(filters)}|${special}`}
            rows={rows}
            columns={columns}
            getRowId={(p) => p.id}
            getRowLabel={(p) => p.title}
            onOpen={(p) => setParams({ id: p.id })}
            caption="Projetos"
            initialSort={{ key: "due", dir: "asc" }}
            mobileCard={(p) => (
              <span className="flex flex-col gap-2">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold text-ink">{p.title}</span>
                    <span className="block text-[12px] text-ink-faint">
                      {clientName(p.clientId)} · prazo {formatDate(p.dueDate)}
                    </span>
                  </span>
                  <StatusBadge size="sm" tone={projectStatusMeta[projectStatus(p)].tone} label={projectStatusMeta[projectStatus(p)].label} />
                </span>
                <span className="flex items-center gap-2.5">
                  <SegmentedBar size="sm" value={projectProgress(p) / 100} color={tone.violet} label={`Progresso ${p.title}`} />
                  <span className="tnum text-[12px] font-bold text-ink">{projectProgress(p)}%</span>
                </span>
              </span>
            )}
            empty={
              <EmptyState
                title={totalProjects ? "Nenhum projeto com esses filtros" : "Nenhum projeto ainda"}
                description={totalProjects ? "Ajuste a busca ou os filtros." : "Crie o primeiro projeto a partir de um cliente."}
                action={
                  !totalProjects && (
                    <Button variant="primary" onClick={() => setFormOpen(true)}>
                      <Plus aria-hidden /> Criar projeto
                    </Button>
                  )
                }
              />
            }
          />
        </DashboardCard>
      </div>

      <ProjectForm
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setEditing(null);
            if (params.get("novo")) setParams({ novo: null, cliente: null });
          }
        }}
        project={editing}
        defaultClientId={params.get("cliente")}
        onSaved={(p) => !editing && setParams({ id: p.id, novo: null, cliente: null })}
      />
      <ProjectDetail project={detail} open={!!detail} onOpenChange={(o) => !o && setParams({ id: null })} onEdit={(p) => { setEditing(p); setFormOpen(true); }} />
    </>
  );
}
