"use client";

import { cn } from "@/lib/utils";
import { useElementSize } from "./chart-utils";

interface Props {
  /** Fração 0–1. */
  value: number;
  color: string;
  label: string;
  valueText?: string;
  size?: "sm" | "md";
  /** Mostra o marcador branco na fronteira (assinatura visual). */
  marker?: boolean;
  className?: string;
}

/**
 * Barra segmentada "acendendo": segmentos se acendem até o valor; o marcador
 * branco indica a posição exata. Assinatura visual da Sellora.
 */
export function SegmentedBar({ value, color, label, valueText, size = "md", marker = true, className }: Props) {
  const [ref, { width }] = useElementSize<HTMLDivElement>();
  const seg = size === "sm" ? 5 : 7;
  const gap = size === "sm" ? 2 : 3;
  const count = Math.max(8, Math.floor((width + gap) / (seg + gap)));
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const lit = Math.round(v * count);
  const pct = Math.round(v * 100);

  return (
    <div
      ref={ref}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={valueText ?? `${pct}%`}
      className={cn("flex w-full items-center overflow-hidden", size === "sm" ? "h-2.5" : "h-3", className)}
      style={{ gap }}
    >
      {width > 0 &&
        Array.from({ length: count }, (_, i) => {
          const on = i < lit;
          const isMarker = marker && lit > 0 && lit < count && i === lit;
          return (
            <span
              key={i}
              aria-hidden
              className="h-full shrink-0 rounded-full"
              style={{
                width: seg,
                background: isMarker ? "#fff" : on ? color : "rgba(236,228,255,0.09)",
                boxShadow: on || isMarker ? `0 0 3px ${isMarker ? "rgba(255,255,255,0.4)" : color}` : undefined,
                opacity: on ? 0.55 + 0.45 * (i / Math.max(1, lit)) : 1,
                animation: on || isMarker ? `segment-on 420ms ${i * 9}ms both var(--ease-out)` : undefined,
              }}
            />
          );
        })}
    </div>
  );
}
