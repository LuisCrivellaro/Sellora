"use client";

import { motion } from "motion/react";
import { useId, useState, type KeyboardEvent } from "react";
import { motionTokens, useMotionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { labelEvery, niceScale, useElementSize } from "./chart-utils";

interface BarDatum {
  label: string;
  longLabel?: string;
  value: number;
}

/**
 * Barras em cápsula: as barras comuns têm textura pontilhada escura; a barra
 * em destaque (maior valor ou selecionada) acende em gradiente violeta→magenta.
 */
export function CapsuleBarChart({
  data,
  height = 220,
  format = (n) => String(Math.round(n)),
  summary,
  unit = "",
}: {
  data: BarDatum[];
  height?: number;
  format?: (n: number) => string;
  summary: string;
  unit?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const enabled = useMotionEnabled();
  const [active, setActive] = useState<number | null>(null);
  const pad = { top: 18, bottom: 26, left: 38, right: 4 };
  const innerH = height - pad.top - pad.bottom;
  const innerW = Math.max(0, width - pad.left - pad.right);
  const max = Math.max(0, ...data.map((d) => d.value));
  const scale = niceScale(max, 5);
  const slot = data.length ? innerW / data.length : 0;
  const barW = Math.max(6, Math.min(44, slot * 0.62));
  const peak = data.findIndex((d) => d.value === max && max > 0);
  const hi = active ?? peak;
  const every = labelEvery(data.length, innerW, 40);

  const onKey = (e: KeyboardEvent) => {
    if (!["ArrowRight", "ArrowLeft", "Escape"].includes(e.key)) return;
    e.preventDefault();
    if (e.key === "Escape") return setActive(null);
    const cur = active ?? (peak >= 0 ? peak : 0);
    setActive(e.key === "ArrowRight" ? Math.min(data.length - 1, cur + 1) : Math.max(0, cur - 1));
  };

  return (
    <div
      ref={ref}
      role="group"
      tabIndex={0}
      aria-label={`${summary}. Use as setas para percorrer as barras.`}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
      className="relative w-full rounded-xl"
      style={{ height }}
    >
      {width > 0 && (
        <svg width={width} height={height} aria-hidden className="block overflow-visible">
          <defs>
            <linearGradient id={`${uid}-hi`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#9b6bc9" />
              <stop offset="55%" stopColor="#bb6ba5" />
              <stop offset="100%" stopColor="#bb6ba5" stopOpacity={0.85} />
            </linearGradient>
            <pattern id={`${uid}-dots`} width="5" height="5" patternUnits="userSpaceOnUse">
              <circle cx="1.2" cy="1.2" r="0.9" fill="rgba(255,255,255,0.14)" />
            </pattern>
            <linearGradient id={`${uid}-base`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#2a2338" />
              <stop offset="100%" stopColor="#1a1524" />
            </linearGradient>
          </defs>
          {scale.values.map((v) => {
            const yy = pad.top + innerH - (v / scale.max) * innerH;
            return (
              <g key={v}>
                <line x1={pad.left} x2={width - pad.right} y1={yy} y2={yy} stroke="rgba(236,228,255,0.05)" />
                <text x={pad.left - 10} y={yy} dy="0.32em" textAnchor="end" className="fill-ink-faint text-[11px] tnum">
                  {format(v)}
                </text>
              </g>
            );
          })}
          {data.map((d, i) => {
            const h = scale.max > 0 ? (d.value / scale.max) * innerH : 0;
            const cx = pad.left + slot * i + slot / 2;
            const isHi = i === hi;
            const bh = Math.max(h, d.value > 0 ? barW : 0);
            const top = pad.top + innerH - bh;
            return (
              <g key={i} onPointerEnter={() => setActive(i)} onPointerLeave={() => setActive(null)}>
                <rect x={cx - slot / 2} y={pad.top} width={slot} height={innerH} fill="transparent" />
                <motion.g
                  style={{ transformOrigin: `${cx}px ${pad.top + innerH}px` }}
                  initial={enabled ? { scaleY: 0 } : false}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: motionTokens.bars, delay: 0.1 + i * 0.035, ease: motionTokens.ease }}
                >
                  <rect x={cx - barW / 2} y={top} width={barW} height={bh} rx={barW / 2} fill={isHi ? `url(#${uid}-hi)` : `url(#${uid}-base)`} />
                  {!isHi && <rect x={cx - barW / 2} y={top} width={barW} height={bh} rx={barW / 2} fill={`url(#${uid}-dots)`} />}
                  {isHi && <rect x={cx - barW / 2} y={top} width={barW} height={bh} rx={barW / 2} fill="none" stroke="rgba(255,255,255,0.35)" />}
                </motion.g>
                {d.value > 0 && (
                  <circle cx={cx} cy={top - 7} r={3.4} fill={isHi ? "#b08fd6" : "#c27ab0"} style={{ filter: "drop-shadow(0 0 2px rgba(187,107,165,0.5))" }} />
                )}
                {(i % every === 0 || isHi) && (
                  <text x={cx} y={height - 8} textAnchor="middle" className={cn("text-[11px]", isHi ? "fill-ink" : "fill-ink-faint")}>
                    {d.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {active !== null && data[active] && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-xl border border-seam-strong bg-facade-raised px-3 py-1.5 text-[12px] shadow-xl"
          style={{ left: Math.min(Math.max(pad.left + slot * active + slot / 2, 60), width - 60), top: 0 }}
        >
          <span className="text-ink-faint">{data[active].longLabel ?? data[active].label}: </span>
          <span className="tnum font-bold text-ink">
            {format(data[active].value)}
            {unit}
          </span>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {active !== null && data[active] ? `${data[active].longLabel ?? data[active].label}: ${format(data[active].value)}${unit}` : ""}
      </p>
    </div>
  );
}

/**
 * Colunas com textura hachurada e contorno neon, com etiqueta luminosa no topo
 * (linguagem do card "status" da referência 3).
 */
export function HatchedColumns({
  data,
  height = 240,
  colors,
  summary,
  format = (n) => String(n),
}: {
  data: BarDatum[];
  height?: number;
  colors: string[];
  summary: string;
  format?: (n: number) => string;
}) {
  const enabled = useMotionEnabled();
  const max = Math.max(1, ...data.map((d) => d.value));
  const peak = data.findIndex((d) => d.value === max);
  return (
    <figure className="flex w-full flex-col" style={{ height }} aria-label={summary}>
      <div className="flex min-h-0 flex-1 items-end gap-2.5 sm:gap-3.5">
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          const color = colors[i % colors.length];
          const isPeak = i === peak;
          return (
            <div key={d.label} className="flex h-full min-w-0 flex-1 flex-col justify-end">
              <motion.div
                className="relative flex flex-col justify-end"
                style={{ height: `${Math.max(pct, 6)}%`, transformOrigin: "bottom" }}
                initial={enabled ? { scaleY: 0, opacity: 0 } : false}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ duration: motionTokens.bars, delay: 0.1 + i * 0.06, ease: motionTokens.ease }}
              >
                <span
                  className="tnum absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap text-white"
                  style={{ background: `linear-gradient(180deg, ${color}, color-mix(in oklab, ${color} 70%, #000))`, boxShadow: `0 0 6px -2px ${color}` }}
                >
                  {format(d.value)}
                </span>
                <div
                  className={cn("h-full w-full rounded-[14px] border", isPeak ? "hatch" : "dots")}
                  style={{
                    borderColor: `color-mix(in oklab, ${color} ${isPeak ? 85 : 55}%, transparent)`,
                    background: isPeak ? `linear-gradient(180deg, color-mix(in oklab, ${color} 40%, #1b1526), #16111f)` : "linear-gradient(180deg,#221c2e,#15111d)",
                    boxShadow: isPeak ? `0 0 12px -8px ${color}, inset 0 1px 0 rgba(255,255,255,0.12)` : "inset 0 1px 0 rgba(255,255,255,0.05)",
                  }}
                />
              </motion.div>
            </div>
          );
        })}
      </div>
      <figcaption className="mt-2.5 flex gap-2.5 sm:gap-3.5">
        {data.map((d) => (
          <span key={d.label} className="min-w-0 flex-1 truncate text-center text-[11.5px] text-ink-faint" title={d.label}>
            {d.label}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

interface StackedColumn {
  label: string;
  segments: { key: string; value: number }[];
}

/** Barras empilhadas com "fitas" translúcidas ligando os segmentos entre colunas. */
export function StackedRibbonChart({
  columns,
  keys,
  height = 220,
  summary,
}: {
  columns: StackedColumn[];
  keys: { key: string; label: string; color: string }[];
  height?: number;
  summary: string;
}) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const enabled = useMotionEnabled();
  const pad = { top: 22, bottom: 30 };
  const innerH = height - pad.top - pad.bottom;
  const totals = columns.map((c) => c.segments.reduce((s, x) => s + x.value, 0));
  const max = Math.max(1, ...totals);
  const n = columns.length;
  const colW = Math.min(46, (width / Math.max(1, n)) * 0.36);
  const cx = (i: number) => (n <= 1 ? width / 2 : colW / 2 + 8 + (i * (width - colW - 16)) / (n - 1));

  const layout = columns.map((c) => {
    let acc = 0;
    return keys.map((k) => {
      const v = c.segments.find((s) => s.key === k.key)?.value ?? 0;
      const y1 = pad.top + innerH - (acc / max) * innerH;
      acc += v;
      const y0 = pad.top + innerH - (acc / max) * innerH;
      return { key: k.key, y0, y1, v };
    });
  });

  return (
    <div ref={ref} className="relative w-full" style={{ height }} role="img" aria-label={summary}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden className="block overflow-visible">
          {columns.slice(0, -1).map((_, i) =>
            keys.map((k, ki) => {
              const a = layout[i][ki];
              const b = layout[i + 1][ki];
              if (a.v === 0 || b.v === 0) return null;
              const xa = cx(i) + colW / 2;
              const xb = cx(i + 1) - colW / 2;
              const mid = (xa + xb) / 2;
              const d = `M${xa},${a.y0} C${mid},${a.y0} ${mid},${b.y0} ${xb},${b.y0} L${xb},${b.y1} C${mid},${b.y1} ${mid},${a.y1} ${xa},${a.y1} Z`;
              return (
                <motion.path
                  key={`${i}-${k.key}`}
                  d={d}
                  fill={k.color}
                  initial={enabled ? { opacity: 0 } : false}
                  animate={{ opacity: 0.09 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                />
              );
            }),
          )}
          {columns.map((c, i) => (
            <motion.g
              key={c.label}
              style={{ transformOrigin: `${cx(i)}px ${pad.top + innerH}px` }}
              initial={enabled ? { scaleY: 0 } : false}
              animate={{ scaleY: 1 }}
              transition={{ duration: motionTokens.bars, delay: 0.1 + i * 0.08, ease: motionTokens.ease }}
            >
              {layout[i].map((seg, ki) =>
                seg.v > 0 ? (
                  <rect
                    key={seg.key}
                    x={cx(i) - colW / 2}
                    y={seg.y0 + 1}
                    width={colW}
                    height={Math.max(2, seg.y1 - seg.y0 - 2)}
                    rx={5}
                    fill={keys[ki].color}
                    opacity={0.92}
                    style={{ filter: `drop-shadow(0 0 2px ${keys[ki].color})` }}
                  >
                    <title>{`${c.label} · ${keys[ki].label}: ${seg.v}`}</title>
                  </rect>
                ) : null,
              )}
              <text x={cx(i)} y={(layout[i].at(-1)?.y0 ?? pad.top) - 8} textAnchor="middle" className="fill-ink text-[12.5px] font-bold tnum">
                {totals[i]}
              </text>
              <text x={cx(i)} y={height - 8} textAnchor="middle" className="fill-ink-faint text-[11.5px]">
                {c.label}
              </text>
            </motion.g>
          ))}
        </svg>
      )}
    </div>
  );
}
