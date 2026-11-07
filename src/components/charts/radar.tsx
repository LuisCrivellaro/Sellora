"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { motionTokens, useMotionEnabled } from "@/lib/motion";
import type { RadarAxis } from "@/lib/metrics/home";
import { useElementSize } from "./chart-utils";

/** Radar com eixos normalizados 0–100; cada eixo é focável e explica a fórmula. */
export function RadarChart({ axes, color = "#bb6ba5", summary }: { axes: RadarAxis[]; color?: string; summary: string }) {
  const enabled = useMotionEnabled();
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const size = Math.min(width, 300);
  const cx = width / 2;
  const cy = size / 2 + 4;
  const R = size / 2 - 44;
  const n = axes.length;
  const ang = (i: number) => (i / n) * Math.PI * 2 - Math.PI / 2;
  const pt = (i: number, v: number) => [cx + R * (v / 100) * Math.cos(ang(i)), cy + R * (v / 100) * Math.sin(ang(i))] as const;
  const poly = axes.map((a, i) => pt(i, a.value ?? 0).join(",")).join(" ");
  const cur = active !== null ? axes[active] : null;

  return (
    <div className="flex w-full flex-col">
      <div ref={ref} className="relative w-full" style={{ height: size + 8 }} role="img" aria-label={summary}>
        {width > 0 && R > 10 && (
          <svg width={width} height={size + 8} aria-hidden className="block overflow-visible">
            {[25, 50, 75, 100].map((lv) => (
              <polygon key={lv} points={axes.map((_, i) => pt(i, lv).join(",")).join(" ")} fill="none" stroke="rgba(236,228,255,0.09)" />
            ))}
            {axes.map((_, i) => {
              const [x, y] = pt(i, 100);
              return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(236,228,255,0.07)" />;
            })}
            <motion.g
              style={{ transformOrigin: `${cx}px ${cy}px` }}
              initial={enabled ? { scale: 0.2, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.25, ease: motionTokens.ease }}
            >
              <polygon points={poly} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} style={{ filter: `drop-shadow(0 0 3px ${color})` }} />
              {axes.map((a, i) => {
                const [x, y] = pt(i, a.value ?? 0);
                return <circle key={a.key} cx={x} cy={y} r={active === i ? 5.5 : 3.6} fill={active === i ? "#fff" : color} stroke={color} strokeWidth={2} />;
              })}
            </motion.g>
            {axes.map((a, i) => {
              const [x, y] = pt(i, 122);
              const anchor = Math.abs(x - cx) < 6 ? "middle" : x > cx ? "start" : "end";
              return (
                <text key={a.key} x={x} y={y} dy="0.32em" textAnchor={anchor} className={active === i ? "fill-ink text-[12px] font-semibold" : "fill-ink-soft text-[12px]"}>
                  {a.label}
                </text>
              );
            })}
          </svg>
        )}
      </div>
      <ul className="mt-1 flex flex-wrap justify-center gap-1.5" aria-label="Eixos do radar">
        {axes.map((a, i) => (
          <li key={a.key}>
            <button
              type="button"
              onPointerEnter={() => setActive(i)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="tnum rounded-full border border-seam px-2 py-0.5 text-[11.5px] text-ink-soft hover:border-seam-strong hover:text-ink"
              aria-label={`${a.label}: ${a.value === null ? "sem base" : `${a.value} de 100`}. ${a.formula}: ${a.detail}`}
            >
              {a.label} <span className="font-bold text-ink">{a.value === null ? "—" : a.value}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 min-h-[34px] text-center text-[12px] leading-snug text-ink-faint" aria-live="polite">
        {cur ? (
          <>
            <span className="font-semibold text-ink">
              {cur.label}: {cur.value === null ? "sem base" : `${cur.value}/100`}
            </span>{" "}
            — {cur.formula} ({cur.detail})
          </>
        ) : (
          "Índices 0–100 dos últimos 30 dias. Passe o cursor ou foque um eixo para ver a fórmula."
        )}
      </p>
    </div>
  );
}
