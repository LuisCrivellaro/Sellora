"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Ban, Database, Download, ExternalLink, Eye, Flame, History, Monitor, MoreHorizontal, PlugZap, Radar, RefreshCw, Thermometer, UserPlus, type LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardCard } from "@/components/ui/card";
import { DataTable, type Column } from "@/components/ui/data-table";
import { SearchInput } from "@/components/ui/field";
import { FilterPopover, type FilterValue } from "@/components/ui/filter-popover";
import { Menu } from "@/components/ui/overlay";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { SEGMENTS, segmentMeta } from "@/lib/constants";
import { importProspects } from "@/lib/data/repository";
import { enqueueDemoGeneration } from "@/lib/demos/generation-client";
import { getDb, useStore } from "@/lib/data/store";
import { formatDate, formatRelative } from "@/lib/dates";
import { cardEntrance, useMotionEnabled } from "@/lib/motion";
import { opportunityMeta } from "@/lib/prospecting/catalog";
import { classificationMeta } from "@/lib/prospecting/classify";
import { downloadFile, toCsv, toJson } from "@/lib/prospecting/export";
import { loadProspects, markImported, setDiscarded, useProspects, type StoredProspect } from "@/lib/prospecting/store";
import { findCrmDuplicate, type CrmMatch } from "@/lib/prospecting/to-lead";
import type { Classification, ProspectParams } from "@/lib/prospecting/types";
import { cn, formatInt, matchesQuery } from "@/lib/utils";
import { ProspectDetail } from "./prospect-detail";
import { ProspectForm } from "./prospect-form";
import { ClassBadge, JobPanel, ScoreMeter, segmentLabel } from "./prospect-ui";
import { useProspectJob } from "./use-prospect-job";
import { DemoGeneratorStatus } from "@/components/demos/demo-generator-status";
import { selectTopProspects } from "@/lib/prospecting/shortlist";

const CLASSES: Classification[] = ["HOT", "WARM", "LOW", "SKIP"];
type CrmState = { kind: "imported"; leadId: string } | { kind: "duplicate"; match: CrmMatch } | null;

function Kpi({ title, value, note, icon: Icon, index, featured }: { title: string; value: number; note: string; icon: LucideIcon; index: number; featured?: boolean }) {
  const enabled = useMotionEnabled();
  return (
    <motion.section
      {...cardEntrance(index, enabled)}
      className={cn("facade flex min-w-0 flex-col p-4", featured && "border-[color-mix(in_oklab,#C94B55_38%,var(--seam-strong))] bg-[linear-gradient(145deg,color-mix(in_oklab,#C94B55_24%,var(--facade))_0%,color-mix(in_oklab,#C94B55_8%,var(--facade))_60%,var(--facade)_100%)]")}
      aria-label={`${title}: ${value}`}
    >
      <span className={cn("grid size-8 place-items-center rounded-[10px] border border-seam-strong bg-facade-raised text-ink-soft", featured && "text-[#D97981]")}>
        <Icon size={16} strokeWidth={1.8} aria-hidden />
      </span>
      <h3 className="mt-3 text-[12px] font-medium text-ink-soft">{title}</h3>
      <p className="tnum mt-0.5 text-[28px] leading-tight font-bold tracking-[-0.03em] text-ink">{formatInt(value)}</p>
      <p className="mt-auto pt-1 text-[11px] leading-snug text-ink-faint">{note}</p>
    </motion.section>
  );
}

export function ProspectingTab({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const { db, mode, account } = useStore();
  const prospects = useProspects();
  const { notify } = useToast();
  const jobApi = useProspectJob();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<FilterValue>({ classification: [], segment: [], situation: [] });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState<ProspectParams | null>(null);
  const [reviewSearchId, setReviewSearchId] = useState<string | null>(null);
  const [demosRequested, setDemosRequested] = useState(false);

  const scope = mode === "supabase" ? `conta:${account?.email ?? "?"}` : "local";
  useEffect(() => {
    if (mode === "local" || account) loadProspects(scope);
  }, [scope, mode, account]);

  const crmState = useMemo(() => {
    const map = new Map<string, CrmState>();
    if (!db) return map;
    const ids = new Set(db.leads.map((l) => l.id));
    for (const r of prospects.results) {
      if (r.importedLeadId && ids.has(r.importedLeadId)) map.set(r.id, { kind: "imported", leadId: r.importedLeadId });
      else {
        const match = findCrmDuplicate(r, db.leads);
        map.set(r.id, match ? { kind: "duplicate", match } : null);
      }
    }
    return map;
  }, [db, prospects.results]);

  const reviewSearch = prospects.searches.find((search) => search.id === (reviewSearchId ?? jobApi.job?.id)) ?? prospects.searches[0];
  const currentResults = useMemo(() => reviewSearch ? selectTopProspects(prospects.results.filter((result) => result.searchId === reviewSearch.id), reviewSearch.params.radiusKm) : [], [prospects.results, reviewSearch]);
  const filtered = useMemo(
    () =>
      currentResults.filter(
        (r) =>
          matchesQuery(query, r.name, r.category, r.city, r.phone, r.instagram, r.website) &&
          (!filters.classification.length || filters.classification.includes(r.classification)) &&
          (!filters.segment.length || filters.segment.includes(r.segment)) &&
          (!filters.situation.length || filters.situation.includes(r.discarded ? "descartado" : crmState.get(r.id) ? "no_crm" : "novo")),
      ),
    [currentResults, query, filters, crmState],
  );

  if (!db || !prospects.ready) {
    return (
      <div role="status" aria-label="Carregando prospecção" className="grid grid-cols-12 gap-3.5">
        <Skeleton className="col-span-12 h-[132px]" />
        <Skeleton className="col-span-12 h-[380px] lg:col-span-5" />
        <Skeleton className="col-span-12 h-[380px] lg:col-span-7" />
      </div>
    );
  }

  const results = currentResults;
  const count = (c: Classification) => results.filter((r) => r.classification === c && !r.discarded).length;
  const importedCount = db.leads.filter((l) => l.source === "prospeccao_ia").length;
  const completed = prospects.searches.filter((s) => s.status === "completed").length;
  const otherSearches = prospects.searches.filter((s) => s.status === "failed" || s.status === "cancelled").length;
  const detail = detailId ? (results.find((r) => r.id === detailId) ?? null) : null;
  const status = jobApi.status;
  const configured = status.state === "ready" && status.status.configured;
  const exportName = (ext: string) => `sellora-prospeccao-${new Date().toLocaleDateString("sv-SE")}.${ext}`;

  const doImport = (items: StoredProspect[]) => {
    const eligible = items.filter((r) => r.classification !== "SKIP" && !r.discarded && crmState.get(r.id)?.kind !== "imported");
    if (!eligible.length) {
      notify({ kind: "info", title: "Nada para importar", description: "Itens SKIP, descartados ou já importados ficam de fora." });
      return;
    }
    try {
      const report = importProspects(eligible);
      markImported(report.created.map((c) => ({ resultId: c.resultId, leadId: c.lead.id })));
      const parts = [
        report.duplicates.length ? `${report.duplicates.length} já estava(m) no CRM e não foram alterados` : "",
        report.invalid.length ? `${report.invalid.length} com dados inválidos: ${report.invalid[0].message}` : "",
        items.length > eligible.length ? `${items.length - eligible.length} ignorado(s) (SKIP, descartado ou já importado)` : "",
      ].filter(Boolean);
      notify({
        kind: report.created.length ? "success" : "info",
        title: report.created.length ? `${report.created.length} lead(s) adicionados ao CRM` : "Nenhum lead novo adicionado",
        description: parts.join(" · ") || "Origem: Prospecção IA · etapa Novo.",
      });
      setSelected(new Set());
    } catch (e) {
      notify({ kind: "error", title: "Não foi possível importar", description: e instanceof Error ? e.message : "Tente novamente." });
    }
  };

  const doExport = (items: StoredProspect[], format: "csv" | "json") => {
    if (!items.length) return;
    if (format === "csv") downloadFile(exportName("csv"), toCsv(items), "text/csv;charset=utf-8");
    else downloadFile(exportName("json"), toJson(items, { fonte: "Sellora · Prospecção IA", atribuicao: "Dados © colaboradores do OpenStreetMap (ODbL)" }), "application/json");
    notify({ kind: "success", title: `${items.length} registro(s) exportados em ${format.toUpperCase()}` });
  };

  const prepareDemos = (items: StoredProspect[]) => {
    try {
      const report = importProspects(items, { generateDemos: true });
      setDemosRequested(true);
      enqueueDemoGeneration(report.demos.filter((item) => {
        const demo = getDb().leads.find((lead) => lead.id === item.leadId)?.demo;
        return demo && demo.version < 4 && demo.status === "pending";
      }).map((item) => item.leadId));
      markImported(report.demos);
      const generated = report.demos.filter((d) => !d.reused).length;
      const reused = report.demos.filter((d) => d.reused).length;
      notify({ kind: generated ? "success" : "info", title: `${generated} prospecção(ões) preparada(s) · ${reused} reaproveitada(s)`, description: "A geração solicitada está na fila. Acompanhe o progresso e revise o resultado em Leads → Demos." });
      setSelected(new Set());
    } catch (e) { notify({ kind: "error", title: "Não foi possível preparar as demos", description: e instanceof Error ? e.message : "Tente novamente." }); }
  };

  const discard = (ids: string[], value: boolean) => {
    setDiscarded(ids, value);
    notify({ kind: "success", title: value ? `${ids.length} marcado(s) como descartado` : "Restaurado" });
  };

  const siteHref = (r: StoredProspect) => (r.website ? (r.siteCheck?.finalUrl ?? (/^https?:\/\//.test(r.website) ? r.website : `https://${r.website}`)) : null);

  const crmBadge = (r: StoredProspect) => {
    const s = crmState.get(r.id);
    if (r.discarded) return <span className="text-[11px] text-ink-faint">Descartado</span>;
    if (s?.kind === "imported") return <span className="text-[11px] text-mint">No CRM</span>;
    if (s?.kind === "duplicate") return <span className="text-[11px] text-ink-faint">Já no CRM</span>;
    return null;
  };

  const columns: Column<StoredProspect>[] = [
    {
      key: "name",
      header: "Estabelecimento",
      sortValue: (r) => r.name,
      cell: (r) => (
        <span className={cn("block min-w-0", r.discarded && "opacity-55")}>
          <span className="block max-w-[220px] truncate font-semibold">{r.name}</span>
          <span className="flex items-center gap-2 text-[11.5px] text-ink-faint">
            <span className="truncate">{r.category}</span>
            {crmBadge(r)}
          </span>
        </span>
      ),
    },
    { key: "segment", header: "Segmento", hideBelow: "2xl", sortValue: (r) => segmentMeta[r.segment].label, cell: (r) => segmentMeta[r.segment].label },
    { key: "city", header: "Cidade", hideBelow: "xl", sortValue: (r) => r.city, cell: (r) => <span className="whitespace-nowrap">{r.city}/{r.uf}</span> },
    { key: "phone", header: "Telefone", hideBelow: "lg", sortValue: (r) => r.phone || null, cell: (r) => (r.phone ? <span className="tnum whitespace-nowrap">{r.phone}</span> : <span className="text-ink-faint">—</span>) },
    {
      key: "website",
      header: "Website",
      hideBelow: "xl",
      sortValue: (r) => r.website || null,
      cell: (r) => {
        const href = siteHref(r);
        return href ? (
          <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex max-w-[160px] items-center gap-1 text-interactive hover:text-ink" aria-label={`Abrir site de ${r.name} em nova aba`}>
            <span className="truncate">{href.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</span>
            <ExternalLink className="size-3 shrink-0" aria-hidden />
          </a>
        ) : (
          <span className="text-ink-faint">Não encontrado</span>
        );
      },
    },
    { key: "instagram", header: "Instagram", hideBelow: "2xl", sortValue: (r) => r.instagram || null, cell: (r) => r.instagram || <span className="text-ink-faint">—</span> },
    { key: "class", header: "Temperatura", sortValue: (r) => CLASSES.indexOf(r.classification), cell: (r) => <ClassBadge value={r.classification} size="sm" /> },
    { key: "score", header: "Score", sortValue: (r) => r.score, cell: (r) => <ScoreMeter score={r.score} /> },
    { key: "diagnosis", header: "Diagnóstico", hideBelow: "lg", cell: (r) => <span className="block max-w-[260px] truncate" title={r.diagnosis}>{r.diagnosis}</span> },
    { key: "date", header: "Pesquisa", hideBelow: "2xl", sortValue: (r) => r.checkedAt, cell: (r) => <span className="tnum whitespace-nowrap">{formatDate(r.checkedAt)}</span> },
  ];

  const selectedItems = filtered.filter((r) => selected.has(r.id));

  return (
    <div className="grid grid-cols-12 gap-3.5">
      <div className="col-span-12 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi index={0} featured title="Melhores leads" value={results.length} note="Até 10 qualificados da pesquisa selecionada" icon={Radar} />
        <Kpi index={1} title="HOT" value={count("HOT")} note="Sem site próprio (sem descartados)" icon={Flame} />
        <Kpi index={2} title="WARM" value={count("WARM")} note="Site com problemas verificáveis" icon={Thermometer} />
        <Kpi index={3} title="Importados ao CRM" value={importedCount} note="Leads com origem Prospecção IA" icon={Database} />
        <Kpi index={4} title="Pesquisas realizadas" value={completed} note={otherSearches ? `${otherSearches} cancelada(s) ou com falha` : "Concluídas com o executor real"} icon={History} />
      </div>

      <DashboardCard index={5} className="col-span-12 lg:col-span-5" title="Nova pesquisa" description={configured && status.state === "ready" ? `Executor: ${status.status.label}` : "Busca de estabelecimentos por cidade e segmento"}>
        {status.state === "loading" ? (
          <div role="status" aria-label="Verificando integração" className="flex flex-col gap-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </div>
        ) : status.state === "error" ? (
          <ErrorState title="Prospecção indisponível" description={status.message} action={<Button size="sm" variant="secondary" onClick={() => void jobApi.reloadStatus()}><RefreshCw aria-hidden /> Tentar de novo</Button>} />
        ) : !status.status.configured ? (
          <div className="flex flex-col gap-3" role="status">
            <div className="flex items-center gap-3">
              <span className="tile grid size-9 place-items-center text-ink-soft"><PlugZap className="size-4.5" aria-hidden /></span>
              <div>
                <p className="text-[14px] font-semibold text-ink">Integração não configurada</p>
                <p className="text-[12.5px] text-ink-faint">Nenhuma pesquisa é executada nem simulada até o executor ser ativado.</p>
              </div>
            </div>
            <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[13px] text-ink-soft">
              {status.status.instructions.map((i) => (
                <li key={i}>{i.includes("PROSPECCAO_EXECUTOR") ? <>Adicione a linha <code className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[12px] text-ink">PROSPECCAO_EXECUTOR=osm</code></> : i}</li>
              ))}
            </ol>
            <Button size="sm" variant="secondary" className="self-start" onClick={() => void jobApi.reloadStatus()}>
              <RefreshCw aria-hidden /> Verificar novamente
            </Button>
          </div>
        ) : (
          <>
            <ProspectForm
              disabled={jobApi.running || jobApi.starting}
              busy={jobApi.starting}
              onSubmit={(p) => {
                setLastParams(p);
                setReviewSearchId(null);
                setSelected(new Set());
                setQuery("");
                setFilters({ classification: [], segment: [], situation: [] });
                void jobApi.start(p);
              }}
            />
            {jobApi.requestError && !jobApi.job && (
              <p role="alert" className="mt-3 text-[12.5px] font-medium text-danger">
                {jobApi.requestError}
              </p>
            )}
          </>
        )}
      </DashboardCard>

      <DashboardCard index={6} className="col-span-12 lg:col-span-7" title="Execução" description="Acompanhamento em tempo real e histórico das pesquisas">
        {jobApi.job ? (
          <>
            <JobPanel job={jobApi.job} onCancel={() => void jobApi.cancel()} onDismiss={jobApi.dismiss} onRetry={() => void jobApi.start(lastParams ?? jobApi.job!.params)} />
            {jobApi.requestError && (
              <p role="alert" className="mt-3 text-[12.5px] font-medium text-danger">
                {jobApi.requestError}
              </p>
            )}
          </>
        ) : prospects.searches.length ? (
          <ul className="flex flex-col divide-y divide-[var(--seam)]" aria-label="Pesquisas recentes">
            {prospects.searches.slice(0, 6).map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 first:pt-0">
                <span className="min-w-0 flex-1">
                  <button type="button" className="block max-w-full truncate text-left text-[13px] font-semibold text-ink underline-offset-4 hover:underline focus-visible:outline-2" onClick={() => { setReviewSearchId(s.id); setSelected(new Set()); setQuery(""); setFilters({ classification: [], segment: [], situation: [] }); }}>{s.params.city}/{s.params.uf} · {segmentLabel(s.params.segment)}</button>
                  <span className="block text-[11.5px] text-ink-faint">
                    {s.params.radiusKm} km · até {s.params.maxResults} · {opportunityMeta[s.params.opportunity].label} · {formatRelative(s.startedAt)}
                  </span>
                </span>
                <span className={cn("text-[12px] font-semibold whitespace-nowrap", s.status === "completed" ? "text-ink" : s.status === "failed" ? "text-danger" : "text-ink-faint")}>
                  {s.status === "completed" ? `${s.found} oportunidade(s)` : s.status === "failed" ? "Falhou" : s.status === "cancelled" ? "Cancelada" : "Em andamento"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={<Radar className="size-5" aria-hidden />} title="Nenhuma pesquisa ainda" description={configured ? "Escolha cidade, segmento e raio para buscar os 10 melhores leads. O progresso aparece aqui." : "Ative o executor para começar. Nada é simulado."} />
        )}
        {prospects.storageError && <p className="mt-3 text-[12px] text-warn">{prospects.storageError}</p>}
      </DashboardCard>

      <DashboardCard
        index={7}
        className="col-span-12"
        title="10 melhores leads para revisão"
        description={reviewSearch ? `${reviewSearch.params.city}/${reviewSearch.params.uf} · raio de ${reviewSearch.params.radiusKm} km · ${filtered.length} de ${results.length} qualificados` : "Escolha uma região para encontrar oportunidades"}
        actions={
          <Menu
            label="Exportar resultados filtrados"
            trigger={
              <Button size="sm" variant="secondary" disabled={!filtered.length}>
                <Download aria-hidden /> Exportar
              </Button>
            }
            items={[
              { heading: `${filtered.length} resultado(s) filtrado(s)` },
              { label: "CSV (planilha)", icon: <Download />, onSelect: () => doExport(filtered, "csv") },
              { label: "JSON", icon: <Download />, onSelect: () => doExport(filtered, "json") },
            ]}
          />
        }
      >
        <p className="mb-4 text-[12.5px] leading-relaxed text-ink-soft">Ranking por pontuação comercial, com desempate por confiança dos dados e proximidade. Abra o diagnóstico para conferir as evidências. A prospecção com demo começa quando você apertar o botão abaixo.</p>
        {reviewSearch?.status === "completed" && results.length < 10 && <p role="status" className="mb-4 text-[12px] text-ink-faint">Esta pesquisa encontrou {results.length} lead(s) qualificado(s) dentro do raio selecionado.</p>}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <SearchInput label="Buscar por nome" value={query} onChange={(value) => { setQuery(value); setSelected(new Set()); }} placeholder="Buscar por nome, categoria, telefone…" className="w-full sm:w-[320px]" />
          <FilterPopover
            value={filters}
            onChange={(value) => { setFilters(value); setSelected(new Set()); }}
            groups={[
              { key: "classification", label: "Temperatura", options: CLASSES.map((c) => ({ value: c, label: `${c} · ${classificationMeta[c].description}` })) },
              { key: "segment", label: "Segmento", options: SEGMENTS.map((s) => ({ value: s, label: segmentMeta[s].label })) },
              { key: "situation", label: "Situação", options: [{ value: "novo", label: "Fora do CRM" }, { value: "no_crm", label: "No CRM" }, { value: "descartado", label: "Descartados" }] },
            ]}
          />
          <Button size="sm" variant="primary" disabled={!(selectedItems.length || filtered.length)} onClick={() => prepareDemos(selectedItems.length ? selectedItems : filtered)}><Monitor aria-hidden />Gerar prospecção com demo ({selectedItems.length || filtered.length})</Button>
          {selected.size > 0 && (
            <div className="ml-auto flex flex-wrap items-center gap-1.5 rounded-full border border-seam-strong bg-selected py-1 pr-1 pl-3.5">
              <span className="tnum text-[12.5px] font-semibold text-ink">{selected.size} selecionados</span>
              <Button size="sm" variant="primary" onClick={() => doImport(selectedItems)}>
                <UserPlus aria-hidden /> Adicionar ao CRM
              </Button>
              <Menu
                label="Exportar selecionados"
                trigger={
                  <Button size="sm" variant="ghost">
                    <Download aria-hidden /> Exportar
                  </Button>
                }
                items={[
                  { label: "CSV (planilha)", icon: <Download />, onSelect: () => doExport(selectedItems, "csv") },
                  { label: "JSON", icon: <Download />, onSelect: () => doExport(selectedItems, "json") },
                ]}
              />
              <Button size="sm" variant="ghost" onClick={() => discard([...selected], true)}>
                <Ban aria-hidden /> Descartar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Limpar seleção
              </Button>
            </div>
          )}
        </div>

        <DataTable
          key={`${query}|${JSON.stringify(filters)}`}
          rows={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          getRowLabel={(r) => r.name}
          onOpen={(r) => setDetailId(r.id)}
          selectable
          selected={selected}
          onSelectedChange={setSelected}
          caption="Oportunidades da Prospecção IA"
          initialSort={{ key: "score", dir: "desc" }}
          rowActions={(r) => {
            const s = crmState.get(r.id);
            const href = siteHref(r);
            return (
              <Menu
                label={`Ações de ${r.name}`}
                trigger={
                  <Button variant="ghost" size="icon-sm" aria-label={`Ações de ${r.name}`}>
                    <MoreHorizontal aria-hidden />
                  </Button>
                }
                items={[
                  { label: "Ver diagnóstico", icon: <Eye />, onSelect: () => setDetailId(r.id) },
                  { label: "Gerar prospecção com demo", icon: <Monitor />, disabled: r.discarded || !["HOT", "WARM"].includes(r.classification), onSelect: () => prepareDemos([r]) },
                  s
                    ? { label: "Ver no CRM", icon: <Database />, onSelect: () => onOpenLead(s.kind === "imported" ? s.leadId : s.match.leadId) }
                    : { label: "Adicionar ao CRM", icon: <UserPlus />, disabled: r.classification === "SKIP" || r.discarded, onSelect: () => doImport([r]) },
                  ...(href ? [{ label: "Abrir site em nova aba", icon: <ExternalLink />, onSelect: () => window.open(href, "_blank", "noopener,noreferrer") }] : []),
                  { label: "Exportar JSON", icon: <Download />, onSelect: () => doExport([r], "json") },
                  "separator" as const,
                  { label: r.discarded ? "Restaurar" : "Marcar como descartado", icon: <Ban />, onSelect: () => discard([r.id], !r.discarded) },
                ]}
              />
            );
          }}
          mobileCard={(r) => (
            <span className={cn("flex flex-col gap-2", r.discarded && "opacity-55")}>
              <span className="flex items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-ink">{r.name}</span>
                  <span className="block text-[12px] text-ink-faint">
                    {r.category} · {r.city}/{r.uf}
                  </span>
                </span>
                <ClassBadge value={r.classification} size="sm" />
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px]">
                <ScoreMeter score={r.score} />
                {r.phone && <span className="tnum text-ink-soft">{r.phone}</span>}
                {crmBadge(r)}
              </span>
              <span className="text-[12px] text-ink-soft">{r.diagnosis}</span>
            </span>
          )}
          empty={
            <EmptyState
              icon={<Radar className="size-5" aria-hidden />}
              title={results.length ? "Nenhum resultado com esses filtros" : "Nenhuma oportunidade ainda"}
              description={results.length ? "Ajuste a busca ou limpe os filtros." : "Os resultados da pesquisa aparecem aqui, com classificação, score e diagnóstico."}
            />
          }
        />
        {results.length > 0 && <p className="mt-3 text-[11.5px] text-ink-faint">Dados © colaboradores do OpenStreetMap (ODbL). Telefones, sites e perfis são dados comerciais públicos da fonte; confira antes do contato. Nenhuma mensagem é enviada automaticamente.</p>}
        {demosRequested && <div className="mt-4"><DemoGeneratorStatus /><Link href="/leads?aba=demos" className="text-[13px] font-semibold text-ink underline underline-offset-4">Abrir fila de demos para revisão</Link></div>}
      </DashboardCard>

      <ProspectDetail
        item={detail}
        open={!!detail}
        onOpenChange={(o) => !o && setDetailId(null)}
        onImport={(r) => doImport([r])}
        onDiscard={(r, v) => discard([r.id], v)}
        onExport={(r) => doExport([r], "json")}
        onOpenLead={(id) => {
          setDetailId(null);
          onOpenLead(id);
        }}
      />
    </div>
  );
}
