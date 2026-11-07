"use client";

import { motion } from "motion/react";
import { useId, useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string; disabled?: boolean }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}

/** Alternativas mutuamente exclusivas (radiogroup) com indicador deslizante. */
export function Segmented<T extends string>({ value, onChange, options, label, size = "sm", className }: SegmentedProps<T>) {
  const layoutId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKey = (e: KeyboardEvent, idx: number) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    const pos = enabled.indexOf(idx);
    const next =
      e.key === "Home" ? enabled[0] : e.key === "End" ? enabled.at(-1)! : enabled[(pos + (e.key === "ArrowRight" ? 1 : -1) + enabled.length) % enabled.length];
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} className={cn("pill-group inline-flex max-w-full items-center overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
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
            title={o.title}
            disabled={o.disabled}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => onKey(e, i)}
            className={cn(
              "focus-inset relative isolate inline-flex items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap transition-colors duration-150 disabled:opacity-40",
              size === "sm" ? "h-7 min-w-11 px-3 text-[12.5px]" : "h-9 min-w-14 px-4 text-[13px]",
              active ? "text-ink" : "text-ink-faint hover:text-ink-soft",
            )}
          >
            {active && <motion.span layoutId={layoutId} className="pill-active absolute inset-0 -z-10" transition={{ type: "spring", stiffness: 500, damping: 40 }} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
