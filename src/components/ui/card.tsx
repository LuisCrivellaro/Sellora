"use client";

import { motion } from "motion/react";
import { useId, type ReactNode } from "react";
import { cardEntrance, useMotionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** Fachada iluminada (gráfico principal). */
  lit?: boolean;
  index?: number;
  className?: string;
  bodyClassName?: string;
  as?: "section" | "div";
}

export function DashboardCard({ title, description, actions, children, lit, index = 0, className, bodyClassName, as = "section" }: DashboardCardProps) {
  const enabled = useMotionEnabled();
  const id = useId();
  const Comp = as === "section" ? motion.section : motion.div;
  return (
    <Comp
      {...cardEntrance(index, enabled)}
      aria-labelledby={title ? `${id}-title` : undefined}
      className={cn("facade flex min-w-0 flex-col", lit && "facade-lit", className)}
    >
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-4.5">
          <div className="min-w-0">
            {title && (
              <h2 id={`${id}-title`} className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
                {title}
              </h2>
            )}
            {description && <p className="mt-0.5 text-[12.5px] text-ink-faint">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("flex min-h-0 flex-1 flex-col px-5 pt-3.5 pb-5", bodyClassName)}>{children}</div>
    </Comp>
  );
}

/** Legenda com ponto colorido + rótulo + valor em destaque (padrão das referências). */
export function LegendStat({ color, label, value, className }: { color: string; label: string; value?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[14px]", className)}>
      <span className="size-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} aria-hidden />
      <span className="text-ink-soft">{label}</span>
      {value !== undefined && <span className="tnum font-bold text-ink">{value}</span>}
    </span>
  );
}
