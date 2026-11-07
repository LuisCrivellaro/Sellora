"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface HeatCell {
  count: number;
  label: string;
  future?: boolean;
}

interface Props {
  rows: string[];
  columns: string[];
  /** grid[linha][coluna] */
  grid: HeatCell[][];
  max: number;
  unit: string;
  summary: string;
  /** Mostra rótulo de coluna a cada N colunas. */
  columnEvery?: number;
}

function cellStyle(count: number, max: number, future?: boolean) {
  if (future) return { background: "transparent", border: "1px dashed rgba(236,228,255,0.06)" };
  if (count === 0 || max === 0) return { background: "rgba(122,80,200,0.10)" };
  const t = count / max;
  // violeta escuro → violeta neon → lilás brilhante
  const alpha = 0.25 + t * 0.75;
  const color = t > 0.66 ? `rgba(206,128,255,${alpha})` : t > 0.33 ? `rgba(160,90,255,${alpha})` : `rgba(130,70,230,${alpha})`;
  return {
    background: color,
    boxShadow: t > 0.5 ? `0 0 ${6 + t * 10}px -2px rgba(200,120,255,${0.35 + t * 0.4}), inset 0 1px 0 rgba(255,255,255,0.18)` : "inset 0 1px 0 rgba(255,255,255,0.06)",
  };
}

/** Heatmap navegável por setas; cada célula anuncia data e contagem. */
export function Heatmap({ rows, columns, grid, max, unit, summary, columnEvery = 2 }: Props) {
  const [focus, setFocus] = useState<{ r: number; c: number } | null>(null);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const cur = hover ?? focus;

  const move = (e: KeyboardEvent, r: number, c: number) => {
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = delta[e.key];
    if (!d) return;
    e.preventDefault();
    const nr = Math.max(0, Math.min(rows.length - 1, r + d[0]));
    const nc = Math.max(0, Math.min(columns.length - 1, c + d[1]));
    cellRefs.current.get(`${nr}-${nc}`)?.focus();
  };

  return (
    <div className="flex w-full flex-col">
      <div role="grid" aria-label={summary} className="grid w-full items-center gap-x-2.5" style={{ gridTemplateColumns: "auto 1fr" }}>
        {rows.map((rowLabel, r) => (
          <div role="row" key={rowLabel} className="contents">
            <span role="rowheader" className="pr-1 text-right text-[11.5px] whitespace-nowrap text-ink-faint">
              {rowLabel}
            </span>
            <div className="grid gap-[5px] py-[2.5px]" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
              {grid[r].map((cell, c) => (
                <button
                  key={c}
                  type="button"
                  role="gridcell"
                  ref={(el) => {
                    if (el) cellRefs.current.set(`${r}-${c}`, el);
                  }}
                  tabIndex={r === 0 && c === columns.length - 1 ? 0 : -1}
                  aria-label={cell.future ? `${cell.label}: ainda não ocorreu` : `${cell.label}: ${cell.count} ${unit}`}
                  onFocus={() => setFocus({ r, c })}
                  onBlur={() => setFocus(null)}
                  onPointerEnter={() => setHover({ r, c })}
                  onPointerLeave={() => setHover(null)}
                  onKeyDown={(e) => move(e, r, c)}
                  className={cn(
                    "aspect-[1.6/1] min-h-3 cursor-default rounded-[5px] transition-[transform,filter] duration-150 hover:brightness-125 focus-visible:brightness-125",
                    cur?.r === r && cur?.c === c && "ring-1 ring-white/70",
                  )}
                  style={cellStyle(cell.count, max, cell.future)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 grid gap-x-2.5" style={{ gridTemplateColumns: "auto 1fr" }}>
        <span className="invisible text-[11.5px]">{rows.reduce((a, b) => (a.length > b.length ? a : b), "")}</span>
        <div className="grid gap-[5px]" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
          {columns.map((c, i) => (
            <span key={i} className="overflow-visible text-left text-[11px] whitespace-nowrap text-ink-faint">
              {i % columnEvery === 0 ? c : ""}
            </span>
          ))}
        </div>
      </div>
      <p className="mt-2 min-h-[18px] text-[12px] text-ink-soft" aria-live="polite">
        {cur ? (grid[cur.r][cur.c].future ? `${grid[cur.r][cur.c].label}: ainda não ocorreu` : `${grid[cur.r][cur.c].label}: ${grid[cur.r][cur.c].count} ${unit}`) : <span className="text-ink-faint">Passe o cursor ou use as setas para ver cada dia.</span>}
      </p>
    </div>
  );
}
