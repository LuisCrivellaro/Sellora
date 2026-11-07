"use client";

import { motion } from "motion/react";
import { useId, useMemo, useState, type KeyboardEvent } from "react";
import { motionTokens, useMotionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { labelEvery, niceScale, smoothPath, useElementSize } from "./chart-utils";

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface Props {
  labels: string[];
  longLabels: string[];
  series: LineSeries[];
  height?: number;
  format?: (n: number) => string;
  /** Resumo textual para leitores de tela. */
  summary: string;
  className?: string;
}

const PAD = { top: 16, right: 12, bottom: 28, left: 40 };

export function NeonLineChart({ labels, longLabels, series, height = 230, format = (n) => String(Math.round(n)), summary, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const enabled = useMotionEnabled();
  const [active, setActive] = useState<number | null>(null);

  const n = labels.length;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const maxVal = Math.max(0, ...series.flatMap((s) => s.values));
  const scale = niceScale(maxVal, 5);
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / scale.max) * innerH;
  const empty = maxVal === 0;

  const paths = useMemo(
    () =>
      series.map((s) => {
        const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
        const line = smoothPath(pts);
        const area = pts.length ? `${line} L${pts.at(-1)!.x},${PAD.top + innerH} L${pts[0].x},${PAD.top + innerH} Z` : "";
        return { line, area };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, height, scale.max],
  );

  const every = labelEvery(n, innerW, 58);
  const idx = active ?? null;

  const onMove = (clientX: number, rect: DOMRect) => {
    if (n === 0 || innerW <= 0) return;
    const rel = clientX - rect.left - PAD.left;
    setActive(Math.max(0, Math.min(n - 1, Math.round((rel / innerW) * (n - 1)))));
  };

  const onKey = (e: KeyboardEvent) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End", "Escape"].includes(e.key)) return;
    e.preventDefault();
    if (e.key === "Escape") return setActive(null);
    const cur = active ?? n - 1;
    const next = e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === "ArrowRight" ? Math.min(n - 1, cur + 1) : Math.max(0, cur - 1);
    setActive(next);
  };

  const tipLeft = idx !== null ? Math.min(Math.max(x(idx), 70), width - 70) : 0;
  const primary = series[0];

  return (
    <div className={cn("relative w-full", className)} style={{ height }}>
      <div
        ref={ref}
        role="group"
        tabIndex={0}
        aria-label={`${summary}. Use as setas para percorrer os períodos.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="absolute inset-0 rounded-xl"
      >
        {width > 0 && (
          <svg width={width} height={height} className="block overflow-visible" aria-hidden>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${uid}-fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.32} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
              <filter id={`${uid}-glow`} x="-10%" y="-30%" width="120%" height="160%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {scale.values.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="rgba(236,228,255,0.06)" />
                <text x={PAD.left - 10} y={y(v)} dy="0.32em" textAnchor="end" className="fill-ink-faint text-[11px] tnum">
                  {format(v)}
                </text>
              </g>
            ))}
            {labels.map((l, i) =>
              i % every === 0 || i === n - 1 ? (
                <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-ink-faint text-[11px]">
                  {l}
                </text>
              ) : null,
            )}

            {series.map((s, si) => (
              <g key={s.key}>
                <motion.path
                  d={paths[si].area}
                  fill={`url(#${uid}-fill-${s.key})`}
                  initial={enabled ? { opacity: 0 } : false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.35 + si * 0.08, ease: motionTokens.ease }}
                />
                <motion.path
                  d={paths[si].line}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  filter={`url(#${uid}-glow)`}
                  initial={enabled ? { pathLength: 0, opacity: 0.4 } : false}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: motionTokens.draw, delay: 0.12 + si * 0.1, ease: motionTokens.ease }}
                />
              </g>
            ))}

            {idx !== null && (
              <g>
                <line x1={x(idx)} x2={x(idx)} y1={PAD.top - 6} y2={PAD.top + innerH} stroke="rgba(255,255,255,0.55)" strokeDasharray="3 4" />
                {series.map((s) => (
                  <circle key={s.key} cx={x(idx)} cy={y(s.values[idx])} r={s.key === primary?.key ? 5 : 3.5} fill={s.key === primary?.key ? "#fff" : s.color} stroke={s.color} strokeWidth={2} />
                ))}
              </g>
            )}

            <rect
              x={PAD.left}
              y={0}
              width={innerW}
              height={height}
              fill="transparent"
              onPointerMove={(e) => onMove(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
        )}
        {empty && width > 0 && (
          <p className="pointer-events-none absolute inset-x-0 top-[38%] text-center text-[13px] text-ink-faint">Sem registros neste período</p>
        )}
      </div>

      {idx !== null && (
        <div
          className="pointer-events-none absolute z-10 min-w-[120px] -translate-x-1/2 rounded-xl border border-seam-strong bg-[rgba(22,18,31,0.92)] px-3 py-2 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.9)] backdrop-blur-sm"
          style={{ left: tipLeft, top: 0 }}
        >
          <p className="text-[11.5px] text-ink-faint">{longLabels[idx]}</p>
          <ul className="mt-1 space-y-0.5">
            {series.map((s) => (
              <li key={s.key} className="flex items-center justify-between gap-3 text-[12.5px]">
                <span className="flex items-center gap-1.5 text-ink-soft">
                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="tnum font-bold text-ink">{format(s.values[idx])}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {idx !== null ? `${longLabels[idx]}: ${series.map((s) => `${s.label} ${format(s.values[idx])}`).join(", ")}` : ""}
      </p>
    </div>
  );
}
