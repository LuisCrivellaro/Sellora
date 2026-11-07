"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { motionTokens, useMotionEnabled } from "@/lib/motion";
import { cn, formatPercent, ratio } from "@/lib/utils";

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color: string;
}

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos(a - Math.PI / 2), cy + r * Math.sin(a - Math.PI / 2)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
}

interface Props {
  slices: DonutSlice[];
  centerLabel: string;
  centerValue?: string;
  size?: number;
  /** "solid" = segmentos grossos com folgas; "ticks" = anel de marcas radiais. */
  variant?: "solid" | "ticks";
  summary: string;
  format?: (n: number) => string;
  legendPosition?: "left" | "right" | "bottom";
}

/** Donut com legenda sincronizada (hover/foco na legenda destaca o segmento). */
export function DonutChart({ slices, centerLabel, centerValue, size = 190, variant = "solid", summary, format = (n) => String(n), legendPosition = "left" }: Props) {
  const enabled = useMotionEnabled();
  const [hi, setHi] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + x.value, 0);
  const cx = size / 2;
  const stroke = size * 0.15;
  const r = size / 2 - stroke / 2 - 6;
  const gap = total > 0 && slices.filter((s) => s.value > 0).length > 1 ? 0.07 : 0;

  const starts = slices.map((_, i) => slices.slice(0, i).reduce((s, x) => s + x.value, 0));
  const arcs = slices.map((s, i) => {
    const a0 = total ? (starts[i] / total) * Math.PI * 2 : 0;
    const a1 = total ? ((starts[i] + s.value) / total) * Math.PI * 2 : 0;
    return { ...s, a0: a0 + gap / 2, a1: Math.max(a0 + gap / 2, a1 - gap / 2) };
  });

  const ticks = 64;
  const tickColor = (i: number) => {
    if (!total) return "rgba(236,228,255,0.08)";
    const a = (i / ticks) * Math.PI * 2 + 0.0001;
    return arcs.find((x) => a >= x.a0 - gap / 2 && a <= x.a1 + gap / 2)?.color ?? "rgba(236,228,255,0.08)";
  };
  const tickSlice = (i: number) => {
    const a = (i / ticks) * Math.PI * 2 + 0.0001;
    return arcs.find((x) => a >= x.a0 - gap / 2 && a <= x.a1 + gap / 2)?.key;
  };

  const legend = (
    <ul className="flex min-w-0 flex-col gap-2.5" aria-label="Legenda">
      {slices.map((s) => (
        <li key={s.key}>
          <button
            type="button"
            onPointerEnter={() => setHi(s.key)}
            onPointerLeave={() => setHi(null)}
            onFocus={() => setHi(s.key)}
            onBlur={() => setHi(null)}
            aria-label={`${s.label}: ${format(s.value)} (${formatPercent(ratio(s.value, total))})`}
            className={cn("flex w-full items-center gap-2.5 rounded-lg px-1 py-0.5 text-left transition-opacity", hi && hi !== s.key && "opacity-45")}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.color, boxShadow: `0 0 4px ${s.color}` }} aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink-soft">{s.label}</span>
            <span className="tnum text-[13.5px] font-bold text-ink">{format(s.value)}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  const chart = (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={summary}>
      <svg width={size} height={size} aria-hidden className="overflow-visible">
        {variant === "solid" ? (
          <>
            <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(236,228,255,0.05)" strokeWidth={stroke} />
            {arcs.map((s, i) =>
              s.value > 0 ? (
                <motion.path
                  key={s.key}
                  d={arc(cx, cx, r, s.a0, s.a1)}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={hi === s.key ? stroke + 6 : stroke}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 ${hi === s.key ? 5 : 2}px ${s.color})`, transition: "stroke-width 160ms var(--ease-out)" }}
                  opacity={hi && hi !== s.key ? 0.4 : 1}
                  initial={enabled ? { pathLength: 0 } : false}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: motionTokens.donut, delay: 0.15 + i * 0.12, ease: motionTokens.ease }}
                />
              ) : null,
            )}
          </>
        ) : (
          Array.from({ length: ticks }, (_, i) => {
            const a = (i / ticks) * Math.PI * 2 - Math.PI / 2;
            const r0 = size / 2 - stroke - 4;
            const r1 = size / 2 - 4;
            const key = tickSlice(i);
            return (
              <motion.line
                key={i}
                x1={cx + r0 * Math.cos(a)}
                y1={cx + r0 * Math.sin(a)}
                x2={cx + r1 * Math.cos(a)}
                y2={cx + r1 * Math.sin(a)}
                stroke={tickColor(i)}
                strokeWidth={3.2}
                strokeLinecap="round"
                opacity={hi && key !== hi ? 0.25 : 1}
                style={{ filter: key ? `drop-shadow(0 0 1px ${tickColor(i)})` : undefined }}
                initial={enabled ? { opacity: 0 } : false}
                animate={{ opacity: hi && key !== hi ? 0.25 : 1 }}
                transition={{ duration: 0.25, delay: enabled ? 0.1 + i * 0.012 : 0 }}
              />
            );
          })
        )}
        <circle cx={cx} cy={cx} r={variant === "solid" ? r - stroke / 2 - 8 : size / 2 - stroke - 14} fill="url(#donut-core)" stroke="rgba(236,228,255,0.1)" />
        <defs>
          <radialGradient id="donut-core">
            <stop offset="0%" stopColor="var(--facade-raised)" />
            <stop offset="100%" stopColor="var(--facade-inset)" />
          </radialGradient>
        </defs>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className={cn("tnum leading-none font-bold text-ink", (centerValue ?? format(total)).length > 7 ? "text-[17px]" : "text-[26px]")}>{centerValue ?? format(total)}</span>
        <span className="mt-1 max-w-[70%] text-[11.5px] leading-tight text-ink-faint">{centerLabel}</span>
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex w-full items-center gap-6",
        legendPosition === "bottom" ? "flex-col" : "flex-col-reverse justify-between sm:flex-row",
        legendPosition === "right" && "sm:flex-row-reverse",
      )}
    >
      {legendPosition === "bottom" ? (
        <>
          {chart}
          <div className="w-full">{legend}</div>
        </>
      ) : (
        <>
          <div className="w-full min-w-0 sm:max-w-[200px]">{legend}</div>
          {chart}
        </>
      )}
    </div>
  );
}
