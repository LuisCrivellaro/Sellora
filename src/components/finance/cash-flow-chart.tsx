"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import { labelEvery, smoothPath, useElementSize } from "@/components/charts/chart-utils";
import type { Bucket } from "@/lib/dates";
import { motionTokens, useMotionEnabled } from "@/lib/motion";
import { formatBRL, formatBRLCompact, moneyColor } from "@/lib/utils";
import { Money } from "@/components/ui/money";

export type FlowMode = "tudo" | "entradas" | "saidas" | "saldo";

interface Props {
  buckets: Bucket[];
  inflow: number[];
  outflow: number[];
  balance: number[];
  mode: FlowMode;
  /** Muda a cada troca de período/modo para reanimar o desenho. */
  animationKey: string;
  height?: number;
  /** Rótulo da série "saldo": saldo de caixa (com saldo inicial) ou movimentação líquida acumulada. */
  balanceLabel?: string;
  /** Estado vazio (com ações reais) quando não há movimentação no período. */
  emptyState?: ReactNode;
}

const PAD = { top: 18, right: 14, bottom: 30, left: 62 };
const GREEN = "var(--fin-in)";
const RED = "var(--fin-out)";

function scaleFor(values: number[]) {
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  // Sem valores (tudo zero): escala neutra em reais inteiros, em vez de frações de real.
  const span = max - min || 1000;
  const rawStep = span / 4;
  const pow = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * pow).find((s) => s >= rawStep) ?? 10 * pow;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step || step * 4;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

/**
 * Fluxo financeiro: área com linha suave (entradas em verde, saídas em vermelho)
 * ou saldo acumulado isolado — séries de natureza diferente não se misturam.
 */
export function CashFlowChart({ buckets, inflow, outflow, balance, mode, animationKey, height = 330, balanceLabel = "Saldo de caixa acumulado", emptyState }: Props) {
  const uid = useId().replace(/:/g, "");
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const enabled = useMotionEnabled();
  const [active, setActive] = useState<number | null>(null);

  const series = useMemo(() => {
    if (mode === "saldo") return [{ key: "saldo", label: balanceLabel, color: GREEN, values: balance, fill: 0.12 }];
    const out = [];
    if (mode !== "saidas") out.push({ key: "entradas", label: "Entradas", color: GREEN, values: inflow, fill: 0.2 });
    if (mode !== "entradas") out.push({ key: "saidas", label: "Saídas", color: RED, values: outflow, fill: 0.1 });
    return out;
  }, [mode, inflow, outflow, balance, balanceLabel]);

  const n = buckets.length;
  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const scale = scaleFor(series.flatMap((s) => s.values));
  const x = (i: number) => PAD.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - ((v - scale.lo) / (scale.hi - scale.lo || 1)) * innerH;
  const baseY = y(Math.max(scale.lo, 0));
  const every = labelEvery(n, innerW, 64);
  const empty = series.every((s) => s.values.every((v) => v === 0));

  const paths = series.map((s) => {
    const pts = s.values.map((v, i) => ({ x: x(i), y: y(v) }));
    const line = smoothPath(pts);
    const area = pts.length ? `${line} L${pts.at(-1)!.x},${baseY} L${pts[0].x},${baseY} Z` : "";
    return { line, area };
  });

  const onKey = (e: KeyboardEvent) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End", "Escape"].includes(e.key)) return;
    e.preventDefault();
    if (e.key === "Escape") return setActive(null);
    const cur = active ?? n - 1;
    setActive(e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === "ArrowRight" ? Math.min(n - 1, cur + 1) : Math.max(0, cur - 1));
  };

  // Tooltip: acompanha o ponto, presa aos limites do gráfico; vira para baixo perto do topo.
  const TIP_W = 212;
  const anchorY = active !== null ? Math.min(...series.map((s) => y(s.values[active]))) : 0;
  const tipLeft = active !== null ? Math.min(Math.max(x(active) - TIP_W / 2, 0), Math.max(0, width - TIP_W)) : 0;
  const below = anchorY < 150;
  const tipTop = below ? anchorY + 16 : anchorY - 16;
  const net = active !== null ? inflow[active] - outflow[active] : 0;

  return (
    <div className="relative w-full" style={{ height }}>
      <div
        ref={ref}
        role="group"
        tabIndex={0}
        aria-label={`Fluxo financeiro, ${series.map((s) => s.label).join(" e ")}, ${buckets.length} períodos. Use as setas para percorrer.`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="absolute inset-0 rounded-2xl"
      >
        {width > 0 && (
          <svg width={width} height={height} aria-hidden className="block overflow-visible">
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`${uid}-g-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={s.fill} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
              <clipPath id={`${uid}-reveal`}>
                <motion.rect
                  key={animationKey}
                  x={PAD.left}
                  y={0}
                  height={height}
                  initial={enabled ? { width: 0 } : false}
                  animate={{ width: innerW + PAD.right }}
                  transition={{ duration: motionTokens.draw, ease: motionTokens.ease }}
                />
              </clipPath>
            </defs>

            {scale.ticks.map((v) => (
              <g key={v}>
                <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke={v === 0 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.05)"} strokeDasharray={v === 0 ? undefined : "2 6"} />
                <text x={PAD.left - 12} y={y(v)} dy="0.32em" textAnchor="end" className="tnum text-[11px]" fill={moneyColor(mode === "saidas" ? -v : v)}>
                  {formatBRLCompact(mode === "saidas" ? -v : v).replace(",00", "")}
                </text>
              </g>
            ))}
            {buckets.map((b, i) =>
              i % every === 0 || i === n - 1 ? (
                <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"} className="fill-[var(--fin-neutral)] text-[11px]">
                  {b.label}
                </text>
              ) : null,
            )}

            <g clipPath={`url(#${uid}-reveal)`}>
              {series.map((s, si) => (
                <g key={`${animationKey}-${s.key}`}>
                  <path d={paths[si].area} fill={`url(#${uid}-g-${s.key})`} />
                  <motion.path
                    d={paths[si].line}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.key === "saidas" ? 1.8 : 2.4}
                    strokeLinecap="round"
                    initial={enabled ? { pathLength: 0 } : false}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: motionTokens.draw, delay: si * 0.08, ease: motionTokens.ease }}
                  />
                </g>
              ))}
            </g>

            {active !== null && (
              <g>
                <line x1={x(active)} x2={x(active)} y1={PAD.top - 6} y2={PAD.top + innerH} stroke="rgba(255,255,255,0.35)" strokeDasharray="3 4" />
                {series.map((s) => (
                  <circle key={s.key} cx={x(active)} cy={y(s.values[active])} r={s.color === GREEN ? 6 : 4.5} fill="#0e0f10" stroke={s.color} strokeWidth={2.5} />
                ))}
              </g>
            )}

            <rect
              x={PAD.left}
              y={0}
              width={innerW}
              height={height - PAD.bottom}
              fill="transparent"
              onPointerMove={(e) => {
                const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
                const rel = e.clientX - rect.left - PAD.left;
                setActive(Math.max(0, Math.min(n - 1, Math.round((rel / (innerW || 1)) * (n - 1)))));
              }}
              onPointerLeave={() => setActive(null)}
            />
          </svg>
        )}
        {empty && width > 0 && (emptyState ?? <p className="pointer-events-none absolute inset-x-0 top-[40%] text-center text-[13px] text-[var(--fin-neutral)]">Nenhuma movimentação financeira registrada neste período.</p>)}
      </div>

      <AnimatePresence>
        {active !== null && (
          <motion.div
            key="tip"
            initial={enabled ? { opacity: 0, y: below ? -6 : 6, scale: 0.97 } : false}
            animate={{ opacity: 1, y: 0, scale: 1, left: tipLeft, top: tipTop }}
            exit={{ opacity: 0, transition: { duration: 0.1 } }}
            transition={{ duration: 0.18, ease: motionTokens.ease }}
            className="pointer-events-none absolute z-10 rounded-[18px] border border-seam-strong bg-facade-raised px-4 py-3.5 text-ink shadow-[0_18px_40px_-16px_rgba(0,0,0,0.85)]"
            style={{ width: TIP_W, translateY: below ? 0 : "-100%" }}
          >
            <p className="text-[11.5px] font-semibold opacity-75">{buckets[active].longLabel}</p>
            {mode === "saldo" ? (
              <p className="tnum mt-1 text-[20px] leading-tight font-extrabold"><Money value={balance[active]} /></p>
            ) : (
              <p className="tnum mt-1 text-[20px] leading-tight font-extrabold"><Money value={net} /></p>
            )}
            <p className="text-[11px] font-semibold opacity-70">{mode === "saldo" ? balanceLabel : "Resultado líquido do período"}</p>
            <dl className="mt-2.5 space-y-1 border-t border-seam-strong pt-2 text-[12px]">
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[var(--fin-in)]" aria-hidden /> Recebido
                </dt>
                <dd className="tnum font-bold"><Money value={inflow[active]} /></dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[var(--fin-out)]" aria-hidden /> Pago
                </dt>
                <dd className="tnum font-bold"><Money value={-outflow[active]} /></dd>
              </div>
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
      <p className="sr-only" aria-live="polite">
        {active !== null ? `${buckets[active].longLabel}: recebido ${formatBRL(inflow[active])}, pago ${formatBRL(outflow[active])}, líquido ${formatBRL(net)}${mode === "saldo" ? `, ${balanceLabel.toLowerCase()} ${formatBRL(balance[active])}` : ""}` : ""}
      </p>
    </div>
  );
}
