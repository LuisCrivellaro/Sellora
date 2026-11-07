"use client";

import { motion } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cardEntrance, motionTokens, useMotionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Card grafite do Financeiro (bordas quase imperceptíveis, cantos amplos). */
export function FinCard({ children, className, index = 0, interactive, as = "section", label }: { children: ReactNode; className?: string; index?: number; interactive?: boolean; as?: "section" | "div"; label?: string }) {
  const enabled = useMotionEnabled();
  const Comp = as === "section" ? motion.section : motion.div;
  return (
    <Comp {...cardEntrance(index, enabled)} aria-label={label} className={cn("fin-card flex min-w-0 flex-col p-5", interactive && "fin-card-hover", className)}>
      {children}
    </Comp>
  );
}

export function FinLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[13px] font-medium text-[var(--fin-neutral)]", className)}>{children}</p>;
}

interface PillOption<T extends string> {
  value: T;
  label: ReactNode;
  title?: string;
}

/**
 * Pills mutuamente exclusivas (radiogroup). Selecionada = preenchimento claro;
 * demais = fundo escuro e borda sutil. Navegação por setas.
 */
export function PillGroup<T extends string>({ value, onChange, options, label, size = "md" }: { value: T; onChange: (v: T) => void; options: PillOption<T>[]; label: string; size?: "sm" | "md" }) {
  const layoutId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: KeyboardEvent, i: number) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = (i + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div role="radiogroup" aria-label={label} className="flex max-w-full flex-wrap items-center gap-1.5">
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={o.title}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "focus-inset relative isolate inline-flex items-center justify-center rounded-full border font-semibold whitespace-nowrap transition-[color,border-color,background-color,transform] duration-150 active:scale-[0.96]",
              size === "sm" ? "h-8 px-3.5 text-[12.5px]" : "h-9 px-4.5 text-[13px]",
              active ? "border-transparent text-ink" : "border-[var(--fin-border-strong)] bg-transparent text-ink-soft hover:bg-white/[0.05] hover:text-ink",
            )}
          >
            {active && <motion.span layoutId={layoutId} className="pill-active absolute inset-0 -z-10" transition={{ type: "spring", stiffness: 520, damping: 42 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Indicador circular com significado explícito (rótulo obrigatório). */
export function RingIndicator({ value, label, size = 58, color = "var(--fin-in)", children }: { value: number; label: string; size?: number; color?: string; children?: ReactNode }) {
  const enabled = useMotionEnabled();
  const stroke = 6;
  const r = (size - stroke) / 2;
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          initial={enabled ? { pathLength: 0 } : false}
          animate={{ pathLength: v }}
          transition={{ duration: motionTokens.donut, delay: 0.25, ease: motionTokens.ease }}
        />
      </svg>
      <span className="tnum absolute inset-0 grid place-items-center text-[12px] font-bold text-ink">{children}</span>
    </div>
  );
}

/** Barra horizontal fina que cresce até o valor (0–1). */
export function GrowBar({ value, color, label, valueText }: { value: number; color: string; label: string; valueText: string }) {
  const enabled = useMotionEnabled();
  const v = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-valuetext={valueText} className="h-2 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <motion.div
        className="h-full origin-left rounded-full"
        style={{ background: color }}
        initial={enabled ? { scaleX: 0 } : false}
        animate={{ scaleX: v }}
        transition={{ duration: motionTokens.bars, delay: 0.2, ease: motionTokens.ease }}
      />
    </div>
  );
}

/** Minigráfico de barras com rótulos (valores sempre acessíveis em texto). */
export function MiniBars({ items, format }: { items: { key: string; label: string; value: number; tone?: "danger" | "default" }[]; format: (n: number) => string }) {
  const enabled = useMotionEnabled();
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="grid grid-cols-4 items-end gap-2" aria-label="Valores a receber por vencimento">
      {items.map((it, i) => (
        <li key={it.key} className="flex flex-col items-center gap-1.5" title={`${it.label}: ${format(it.value)}`}>
          <div className="flex h-14 w-full items-end">
            <motion.div
              className="w-full origin-bottom rounded-md"
              style={{
                height: `${Math.max(6, (it.value / max) * 100)}%`,
                background: it.value === 0 ? "rgba(255,255,255,0.07)" : it.tone === "danger" ? "var(--signal-danger)" : "var(--fin-in)",
                opacity: it.value === 0 ? 1 : 0.9,
              }}
              initial={enabled ? { scaleY: 0 } : false}
              animate={{ scaleY: 1 }}
              transition={{ duration: motionTokens.bars, delay: 0.25 + i * 0.06, ease: motionTokens.ease }}
            />
          </div>
          <span className="text-[11px] text-[var(--fin-neutral)]">{it.label}</span>
          <span className="sr-only">{format(it.value)}</span>
        </li>
      ))}
    </ul>
  );
}
