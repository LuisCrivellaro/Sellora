"use client";

import { Dialog } from "radix-ui";
import { CornerDownLeft, FileText, FolderKanban, Search, Store, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { leadStageMeta, projectStageMeta, proposalStatusMeta } from "@/lib/constants";
import { useStore } from "@/lib/data/store";
import { cn, matchesQuery } from "@/lib/utils";

interface Result {
  id: string;
  group: string;
  title: string;
  meta: string;
  href: string;
  icon: typeof Search;
}

/** Busca global (Ctrl/⌘ + K) em leads, clientes, projetos e propostas. */
export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { db } = useStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const listId = useId();

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  const results = useMemo<Result[]>(() => {
    if (!db || !query.trim()) return [];
    const clientName = (id: string) => db.clients.find((c) => c.id === id)?.name ?? "";
    return [
      ...db.leads
        .filter((l) => matchesQuery(query, l.name, l.city, l.segment, l.email, l.instagram))
        .slice(0, 6)
        .map((l) => ({ id: l.id, group: "Leads", title: l.name, meta: `${leadStageMeta[l.stage].label} · ${l.city}`, href: `/leads?id=${l.id}`, icon: UsersRound })),
      ...db.clients
        .filter((c) => matchesQuery(query, c.name, c.city, c.contactName, c.email))
        .slice(0, 5)
        .map((c) => ({ id: c.id, group: "Clientes", title: c.name, meta: c.city, href: `/clientes?id=${c.id}`, icon: Store })),
      ...db.projects
        .filter((p) => matchesQuery(query, p.title, clientName(p.clientId)))
        .slice(0, 5)
        .map((p) => ({ id: p.id, group: "Projetos", title: p.title, meta: projectStageMeta[p.stage].label, href: `/projetos?id=${p.id}`, icon: FolderKanban })),
      ...db.proposals
        .filter((p) => matchesQuery(query, p.title, p.recipientName))
        .slice(0, 5)
        .map((p) => ({ id: p.id, group: "Propostas", title: p.title, meta: proposalStatusMeta[p.status].label, href: `/propostas?id=${p.id}`, icon: FileText })),
    ];
  }, [db, query]);

  const go = (r: Result) => {
    onOpenChange(false);
    setQuery("");
    router.push(r.href);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(results.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter" && results[cursor]) {
      e.preventDefault();
      go(results[cursor]);
    }
  };

  let lastGroup = "";
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setQuery("");
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-[3px] data-[state=open]:animate-[fade-in_160ms_var(--ease-out)]" />
        <Dialog.Content className="facade fixed top-[12vh] left-1/2 z-[70] w-[min(620px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden border-seam-strong outline-none data-[state=open]:animate-[pop-in_180ms_var(--ease-out)]">
          <Dialog.Title className="sr-only">Busca global</Dialog.Title>
          <Dialog.Description className="sr-only">Pesquise leads, clientes, projetos e propostas. Use as setas e Enter para abrir.</Dialog.Description>
          <div className="flex items-center gap-3 border-b border-seam px-4 focus-within:shadow-[inset_0_-2px_0_var(--focus)]">
            <Search className="size-5 text-ink-faint" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setCursor(0);
              }}
              onKeyDown={onKey}
              placeholder="Buscar estabelecimento, cliente, projeto ou proposta…"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls={listId}
              aria-activedescendant={results[cursor] ? `${listId}-${results[cursor].id}` : undefined}
              aria-label="Termo de busca"
              className="h-14 min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
            />
            <Dialog.Close
              type="button"
              aria-label="Fechar busca"
              className="grid size-9 shrink-0 place-items-center rounded-full text-ink-faint transition-colors hover:bg-white/[0.06] hover:text-ink"
            >
              <X className="size-[18px]" aria-hidden />
            </Dialog.Close>
          </div>
          <ul id={listId} role="listbox" aria-label="Resultados" className="max-h-[52vh] overflow-y-auto p-2">
            {!query.trim() && <li className="px-3 py-6 text-center text-[13px] text-ink-faint">Digite para buscar em todos os módulos.</li>}
            {query.trim() && results.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-faint">Nada encontrado para “{query}”.</li>}
            {results.map((r, i) => {
              const header = r.group !== lastGroup ? r.group : null;
              lastGroup = r.group;
              const Icon = r.icon;
              return (
                <li key={`${r.group}-${r.id}`} role="presentation">
                  {header && <p className="px-3 pt-2.5 pb-1 text-[11.5px] font-semibold text-ink-faint">{header}</p>}
                  <div
                    id={`${listId}-${r.id}`}
                    role="option"
                    aria-selected={i === cursor}
                    onClick={() => go(r)}
                    onPointerMove={() => setCursor(i)}
                    className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5", i === cursor ? "bg-selected" : "")}
                  >
                    <span className="tile grid size-8 place-items-center">
                      <Icon className="size-4 text-interactive" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-semibold text-ink">{r.title}</span>
                      <span className="block truncate text-[12px] text-ink-faint">{r.meta}</span>
                    </span>
                    {i === cursor && <CornerDownLeft className="size-4 text-ink-faint" aria-hidden />}
                  </div>
                </li>
              );
            })}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
