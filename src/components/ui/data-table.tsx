"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  className?: string;
  headerClassName?: string;
  /** Esconde a coluna abaixo do breakpoint (tabela continua legível). */
  hideBelow?: "lg" | "xl" | "2xl";
  align?: "left" | "right";
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  /** Rótulo da linha para leitores de tela e para o botão de abrir. */
  getRowLabel: (row: T) => string;
  onOpen?: (row: T) => void;
  selectable?: boolean;
  selected?: Set<string>;
  onSelectedChange?: (ids: Set<string>) => void;
  pageSize?: number;
  empty: ReactNode;
  caption: string;
  mobileCard: (row: T) => ReactNode;
  initialSort?: { key: string; dir: "asc" | "desc" };
  rowActions?: (row: T) => ReactNode;
}

const hideCls = { lg: "hidden lg:table-cell", xl: "hidden xl:table-cell", "2xl": "hidden 2xl:table-cell" };

export function DataTable<T>({
  rows,
  columns,
  getRowId,
  getRowLabel,
  onOpen,
  selectable,
  selected,
  onSelectedChange,
  pageSize = 10,
  empty,
  caption,
  mobileCard,
  initialSort,
  rowActions,
}: Props<T>) {
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === vb) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return (typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR")) * dir;
    });
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = sorted.slice(current * pageSize, current * pageSize + pageSize);
  const visibleIds = visible.map(getRowId);
  const allSelected = selectable && visibleIds.length > 0 && visibleIds.every((id) => selected?.has(id));

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }));

  const toggleRow = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange?.(next);
  };
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) visibleIds.forEach((id) => next.delete(id));
    else visibleIds.forEach((id) => next.add(id));
    onSelectedChange?.(next);
  };

  if (rows.length === 0) return <>{empty}</>;

  return (
    <div className="flex min-w-0 flex-col">
      {/* Desktop/tablet */}
      <div className="relative hidden min-w-0 max-w-full overflow-x-auto md:block">
        <table className="w-full border-separate border-spacing-0 text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="text-[12.5px] text-ink-faint">
              {selectable && (
                <th scope="col" className="w-10 rounded-l-xl border-y border-l border-table-line bg-facade-raised/70 py-2.5 pl-4">
                  <input type="checkbox" checked={!!allSelected} onChange={toggleAll} aria-label="Selecionar todos desta página" className="size-4 accent-[var(--primary)]" />
                </th>
              )}
              {columns.map((c, i) => {
                const isSorted = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={isSorted ? (sort!.dir === "asc" ? "ascending" : "descending") : c.sortValue ? "none" : undefined}
                    className={cn(
                      "border-y border-table-line bg-facade-raised/70 px-3 py-2.5 font-medium whitespace-nowrap first:pl-4",
                      i === 0 && !selectable && "rounded-l-xl border-l",
                      i === columns.length - 1 && !rowActions && "rounded-r-xl border-r pr-4",
                      c.align === "right" && "text-right",
                      c.hideBelow && hideCls[c.hideBelow],
                      c.headerClassName,
                    )}
                  >
                    {c.sortValue ? (
                      <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 rounded-md hover:text-ink", isSorted && "text-ink")}>
                        {c.header}
                        {isSorted ? sort!.dir === "asc" ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden /> : <ArrowUpDown className="size-3.5 opacity-50" aria-hidden />}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
              {rowActions && (
                <th scope="col" className="w-12 rounded-r-xl border-y border-r border-table-line bg-facade-raised/70 pr-3">
                  <span className="sr-only">Ações</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const id = getRowId(row);
              const isSel = selected?.has(id);
              return (
                <tr
                  key={id}
                  onClick={(e) => {
                    if (!onOpen) return;
                    const target = e.target as HTMLElement;
                    if (target.closest("button, a, input, [role=menuitem]")) return;
                    onOpen(row);
                  }}
                  className={cn("group text-[13.5px] transition-colors", onOpen && "cursor-pointer", isSel ? "bg-selected" : "hover:bg-white/[0.025]")}
                >
                  {selectable && (
                    <td className="border-b border-table-line py-3 pl-4">
                      <input type="checkbox" checked={!!isSel} onChange={() => toggleRow(id)} aria-label={`Selecionar ${getRowLabel(row)}`} className="size-4 accent-[var(--primary)]" />
                    </td>
                  )}
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        "border-b border-table-line px-3 py-3 align-middle text-ink-soft first:pl-4",
                        i === 0 && "text-ink",
                        c.align === "right" && "text-right",
                        c.hideBelow && hideCls[c.hideBelow],
                        c.className,
                      )}
                    >
                      {i === 0 && onOpen ? (
                        <button type="button" onClick={() => onOpen(row)} className="max-w-full rounded-md text-left hover:text-white" aria-label={`Abrir detalhes de ${getRowLabel(row)}`}>
                          {c.cell(row)}
                        </button>
                      ) : (
                        c.cell(row)
                      )}
                    </td>
                  ))}
                  {rowActions && <td className="border-b border-table-line pr-3 text-right">{rowActions(row)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile: lista de cartões */}
      <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
        {visible.map((row) => {
          const id = getRowId(row);
          return (
            <li key={id} className="relative rounded-2xl border border-table-line bg-white/[0.02] p-3.5">
              <div className="flex items-start gap-3">
                {selectable && (
                  <input type="checkbox" checked={!!selected?.has(id)} onChange={() => toggleRow(id)} aria-label={`Selecionar ${getRowLabel(row)}`} className="mt-1 size-4 accent-[var(--primary)]" />
                )}
                <div className="min-w-0 flex-1">
                  {onOpen ? (
                    <button type="button" onClick={() => onOpen(row)} className="block w-full text-left" aria-label={`Abrir detalhes de ${getRowLabel(row)}`}>
                      {mobileCard(row)}
                    </button>
                  ) : (
                    mobileCard(row)
                  )}
                </div>
                {rowActions && <div className="shrink-0">{rowActions(row)}</div>}
              </div>
            </li>
          );
        })}
      </ul>

      {pages > 1 && (
        <nav className="mt-3.5 flex items-center justify-between gap-3 text-[12.5px] text-ink-faint" aria-label="Paginação">
          <span className="tnum">
            {current * pageSize + 1}–{Math.min(sorted.length, (current + 1) * pageSize)} de {sorted.length}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
              className="pill-group grid size-8 place-items-center text-ink-soft hover:text-ink disabled:opacity-35"
              aria-label="Página anterior"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <span className="tnum px-1.5 text-ink-soft" aria-current="page">
              {current + 1} / {pages}
            </span>
            <button
              type="button"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
              className="pill-group grid size-8 place-items-center text-ink-soft hover:text-ink disabled:opacity-35"
              aria-label="Próxima página"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>
        </nav>
      )}
    </div>
  );
}
