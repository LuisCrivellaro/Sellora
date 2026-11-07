"use client";

import { ExternalLink, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { HatchedColumns } from "@/components/charts/bar-charts";
import { NeonLineChart } from "@/components/charts/neon-line-chart";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { ClientDetail } from "@/components/clients/client-detail";
import { ClientForm } from "@/components/clients/client-form";
import { useUrlParams } from "@/components/shared/use-url-state";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/dashboard-badge";
import { Button } from "@/components/ui/button";
import { DashboardCard, LegendStat } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, PageSkeleton } from "@/components/ui/states";
import { clientStatusMeta, SEGMENTS, segmentMeta } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { buildBuckets, countByBucket, formatRelative, RANGE_OPTIONS, type RangeKey } from "@/lib/dates";
import { clientsNeedingAttention } from "@/lib/metrics/clients";
import { siteDelivery } from "@/lib/metrics/projects";
import type { Client, ClientStatus } from "@/lib/types";
import { matchesQuery, sum } from "@/lib/utils";
import { Money } from "@/components/ui/money";
import { dashboardCategoryColors, dashboardColors, dashboardTone as tone } from "@/lib/visualization";

export function ClientsView() {
  const { db } = useStore();
  const { params, setParams } = useUrlParams();
  const [range, setRange] = useState<RangeKey>("1a");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ClientStatus | "todos">("todos");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);

  const data = useMemo(() => {
    if (!db) return null;
    const buckets = buildBuckets(range);
    return {
      buckets,
      newClients: countByBucket(buckets, db.clients.map((c) => c.createdAt)),
      published: countByBucket(buckets, db.projects.map((p) => p.publishedAt)),
      bySegment: SEGMENTS.map((s) => ({ label: segmentMeta[s].label, value: db.clients.filter((c) => c.segment === s).length })).filter((s) => s.value > 0),
      delivery: siteDelivery(db.projects),
      attention: clientsNeedingAttention(db),
    };
  }, [db, range]);

  if (!db || !data) return <PageSkeleton />;

  const rows = db.clients.filter((c) => matchesQuery(query, c.name, c.city, c.contactName, c.email) && (status === "todos" || c.status === status));
  const detailId = params.get("id");
  const detail = detailId ? (db.clients.find((c) => c.id === detailId) ?? null) : null;
  const rangeInfo = RANGE_OPTIONS.find((r) => r.value === range)!;

  const contractedBy = (id: string) => sum(db.projects.filter((p) => p.clientId === id).map((p) => p.contractValue));

  const columns: Column<Client>[] = [
    {
      key: "name",
      header: "Cliente",
      sortValue: (c) => c.name,
      cell: (c) => (
        <span className="flex items-center gap-3">
          <Avatar name={c.name} size={32} />
          <span className="min-w-0">
            <span className="block max-w-[240px] truncate font-semibold">{c.name}</span>
            <span className="block text-[11.5px] text-ink-faint">
              {segmentMeta[c.segment].label} · {c.city}/{c.uf}
            </span>
          </span>
        </span>
      ),
    },
    { key: "contact", header: "Contato", hideBelow: "lg", sortValue: (c) => c.contactName, cell: (c) => c.contactName || <span className="text-ink-faint">—</span> },
    { key: "status", header: "Atendimento", sortValue: (c) => c.status, cell: (c) => <StatusBadge tone={clientStatusMeta[c.status].tone} label={clientStatusMeta[c.status].label} /> },
    { key: "projects", header: "Projetos", align: "right", sortValue: (c) => db.projects.filter((p) => p.clientId === c.id).length, cell: (c) => <span className="tnum">{db.projects.filter((p) => p.clientId === c.id).length}</span> },
    { key: "value", header: "Contratado", align: "right", sortValue: (c) => contractedBy(c.id), cell: (c) => <span className="tnum font-semibold text-ink"><Money value={contractedBy(c.id)} /></span> },
    {
      key: "site",
      header: "Site",
      hideBelow: "xl",
      cell: (c) =>
        c.siteUrl ? (
          <a href={c.siteUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-interactive hover:text-ink">
            {c.siteUrl.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink className="size-3" aria-hidden />
          </a>
        ) : (
          <span className="text-ink-faint">Não publicado</span>
        ),
    },
    { key: "updated", header: "Atualizado", hideBelow: "lg", sortValue: (c) => c.updatedAt, cell: (c) => formatRelative(c.updatedAt) },
  ];

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Estabelecimentos que contrataram a Sellora."
        actions={
          <Button variant="primary" onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus aria-hidden /> Novo cliente
          </Button>
        }
      />
      <div className="grid grid-cols-12 gap-3.5">
        <DashboardCard
          index={0}
          lit
          className="col-span-12 xl:col-span-8"
          title="Evolução de clientes"
          description={rangeInfo.description}
          actions={<Segmented label="Período" value={range} onChange={setRange} options={RANGE_OPTIONS.map((r) => ({ value: r.value, label: r.label, title: r.description }))} />}
        >
          <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1.5">
            <LegendStat color={dashboardColors.red} label="Novos clientes" value={sum(data.newClients)} />
            <LegendStat color={dashboardColors.steel} label="Sites publicados" value={sum(data.published)} />
          </div>
          <NeonLineChart
            height={250}
            labels={data.buckets.map((b) => b.label)}
            longLabels={data.buckets.map((b) => b.longLabel)}
            series={[
              { key: "clientes", label: "Novos clientes", color: dashboardColors.red, values: data.newClients },
              { key: "publicados", label: "Sites publicados", color: dashboardColors.steel, values: data.published },
            ]}
            summary={`Evolução de clientes, ${rangeInfo.description}: ${sum(data.newClients)} novos clientes e ${sum(data.published)} sites publicados`}
          />
        </DashboardCard>

        <DashboardCard index={1} className="col-span-12 xl:col-span-4" title="Clientes por segmento" description={`${db.clients.length} clientes`}>
          {data.bySegment.length ? (
            <HatchedColumns height={270} data={data.bySegment} colors={dashboardCategoryColors} summary={`Clientes por segmento: ${data.bySegment.map((s) => `${s.label} ${s.value}`).join(", ")}`} />
          ) : (
            <EmptyState title="Sem clientes ainda" description="Converta um lead ganho para começar." />
          )}
        </DashboardCard>

        <DashboardCard index={2} className="col-span-12 lg:col-span-5" title="Sites contratados" description={`${data.delivery.total} projetos de site`}>
          <ul className="flex flex-1 flex-col justify-around gap-4">
            {[
              { label: "Em desenvolvimento", value: data.delivery.desenvolvimento, color: dashboardColors.red, hint: "Briefing, design ou desenvolvimento" },
              { label: "Em revisão", value: data.delivery.revisao, color: dashboardColors.steel, hint: "QA e ajustes com o cliente" },
              { label: "Publicados", value: data.delivery.publicados, color: dashboardColors.steelLight, hint: "Com endereço publicado registrado" },
              { label: "Entregues", value: data.delivery.entregues, color: tone.mint, hint: "Etapa de entrega concluída" },
            ].map((row) => (
              <li key={row.label}>
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-ink">
                    {row.label} <span className="text-[11.5px] font-normal text-ink-faint">· {row.hint}</span>
                  </span>
                  <span className="tnum text-[13.5px] font-bold text-ink">
                    {row.value}
                    <span className="font-normal text-ink-faint">/{data.delivery.total}</span>
                  </span>
                </div>
                <SegmentedBar value={data.delivery.total ? row.value / data.delivery.total : 0} color={row.color} label={row.label} valueText={`${row.value} de ${data.delivery.total}`} />
              </li>
            ))}
          </ul>
        </DashboardCard>

        <DashboardCard index={3} className="col-span-12 lg:col-span-7" title={`Clientes que exigem atenção (${data.attention.length})`} description="Pagamentos vencidos, prazos e retornos pendentes">
          {data.attention.length === 0 ? (
            <EmptyState title="Nada pedindo atenção" description="Prazos, pagamentos e retornos estão em dia." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0 text-left text-[13px]">
                <caption className="sr-only">Clientes que exigem atenção</caption>
                <thead>
                  <tr className="text-[12px] text-ink-faint">
                    {["Cliente", "Pendência", "Última atividade", "Próxima ação"].map((h, i) => (
                      <th key={h} scope="col" className={`border-y border-seam bg-facade-raised/70 px-3 py-2.5 font-medium ${i === 0 ? "rounded-l-xl border-l pl-4" : ""} ${i === 3 ? "rounded-r-xl border-r" : ""} ${i === 2 ? "hidden md:table-cell" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.attention.slice(0, 6).map((a, i) => (
                    <tr key={`${a.clientId}-${i}`} className="hover:bg-white/[0.025]">
                      <td className="border-b border-seam py-2.5 pr-3 pl-4">
                        <Link href={a.projectId ? `/projetos?id=${a.projectId}` : `/clientes?id=${a.clientId}`} className="font-semibold text-ink hover:text-white">
                          {a.clientName}
                        </Link>
                        <span className="block max-w-[200px] truncate text-[11.5px] text-ink-faint">{a.projectTitle}</span>
                      </td>
                      <td className="border-b border-seam px-3 py-2.5">
                        <StatusBadge size="sm" tone={a.tone} label={<span>{a.issue}{a.amount !== undefined && <> (<Money value={a.amount} />)</>}</span>} />
                      </td>
                      <td className="hidden border-b border-seam px-3 py-2.5 text-ink-soft md:table-cell">{formatRelative(a.lastActivityAt)}</td>
                      <td className="border-b border-seam px-3 py-2.5 text-ink-soft">{a.nextAction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DashboardCard>

        <DashboardCard index={4} className="col-span-12" title="Gestão de clientes" description={`${rows.length} de ${db.clients.length} clientes`}>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput label="Buscar clientes" value={query} onChange={setQuery} placeholder="Buscar por nome, cidade ou contato…" className="w-full sm:w-[320px]" />
            <Segmented<ClientStatus | "todos">
              label="Status de atendimento"
              value={status}
              onChange={setStatus}
              options={[{ value: "todos", label: "Todos" }, ...(Object.keys(clientStatusMeta) as ClientStatus[]).map((s) => ({ value: s, label: clientStatusMeta[s].label }))]}
              className="max-w-full overflow-x-auto"
            />
          </div>
          <DataTable
            key={`${query}|${status}`}
            rows={rows}
            columns={columns}
            getRowId={(c) => c.id}
            getRowLabel={(c) => c.name}
            onOpen={(c) => setParams({ id: c.id })}
            caption="Clientes"
            initialSort={{ key: "updated", dir: "desc" }}
            mobileCard={(c) => (
              <span className="flex items-center gap-3">
                <Avatar name={c.name} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-ink">{c.name}</span>
                  <span className="block text-[12px] text-ink-faint">
                    {c.city} · <Money value={contractedBy(c.id)} />
                  </span>
                </span>
                <StatusBadge size="sm" tone={clientStatusMeta[c.status].tone} label={clientStatusMeta[c.status].label} />
              </span>
            )}
            empty={
              <EmptyState
                title={db.clients.length ? "Nenhum cliente com esses filtros" : "Nenhum cliente ainda"}
                description={db.clients.length ? "Ajuste a busca ou o status." : "Converta um lead ganho em cliente na página Leads ou cadastre manualmente."}
                action={
                  !db.clients.length && (
                    <Button variant="primary" onClick={() => setFormOpen(true)}>
                      <Plus aria-hidden /> Cadastrar cliente
                    </Button>
                  )
                }
              />
            }
          />
        </DashboardCard>
      </div>

      <ClientForm open={formOpen} onOpenChange={(o) => { setFormOpen(o); if (!o) setEditing(null); }} client={editing} onSaved={(c) => !editing && setParams({ id: c.id })} />
      <ClientDetail client={detail} open={!!detail} onOpenChange={(o) => !o && setParams({ id: null })} onEdit={(c) => { setEditing(c); setFormOpen(true); }} />
    </>
  );
}
