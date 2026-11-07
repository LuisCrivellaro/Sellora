"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "./button";
import { Popover } from "./overlay";

export interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

export type FilterValue = Record<string, string[]>;

export function activeFilterCount(v: FilterValue) {
  return Object.values(v).reduce((s, arr) => s + arr.length, 0);
}

/** Filtros por grupos de checkboxes, com contagem e limpar. */
export function FilterPopover({ groups, value, onChange }: { groups: FilterGroup[]; value: FilterValue; onChange: (v: FilterValue) => void }) {
  const count = activeFilterCount(value);
  const toggle = (group: string, option: string) => {
    const cur = value[group] ?? [];
    onChange({ ...value, [group]: cur.includes(option) ? cur.filter((x) => x !== option) : [...cur, option] });
  };
  return (
    <Popover
      className="w-[min(520px,calc(100vw-24px))]"
      trigger={
        <Button variant="secondary" aria-label={count ? `Filtros: ${count} ativos` : "Filtros"}>
          <SlidersHorizontal aria-hidden />
          Filtrar
          {count > 0 && <span className="tnum grid size-5 place-items-center rounded-full bg-violet text-[11px] font-bold text-white">{count}</span>}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 p-1 sm:grid-cols-2">
        {groups.map((g) => (
          <fieldset key={g.key} className="min-w-0">
            <legend className="mb-1.5 text-[12px] font-semibold text-ink-faint">{g.label}</legend>
            <div className="flex flex-col gap-0.5">
              {g.options.map((o) => {
                const checked = (value[g.key] ?? []).includes(o.value);
                return (
                  <label key={o.value} className="flex h-8 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 text-[13px] text-ink-soft hover:bg-white/[0.04] hover:text-ink">
                    <input type="checkbox" checked={checked} onChange={() => toggle(g.key, o.value)} className="size-4 accent-[var(--neon-violet)]" />
                    {o.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-3 flex justify-end border-t border-seam pt-3">
        <Button variant="ghost" size="sm" disabled={count === 0} onClick={() => onChange(Object.fromEntries(groups.map((g) => [g.key, []])))}>
          Limpar filtros
        </Button>
      </div>
    </Popover>
  );
}
