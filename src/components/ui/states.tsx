"use client";

import { animate, useInView } from "motion/react";
import { CircleAlert, Inbox } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motionTokens, useMotionEnabled } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function EmptyState({ title, description, action, icon, className }: { title: string; description?: string; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <div className="tile mb-1 grid size-11 place-items-center text-interactive">{icon ?? <Inbox className="size-5" aria-hidden />}</div>
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {description && <p className="max-w-[360px] text-[13px] text-ink-faint">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Algo deu errado", description, action }: { title?: string; description?: string; action?: ReactNode }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <CircleAlert className="size-6 text-danger" aria-hidden />
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {description && <p className="max-w-[420px] text-[13px] text-ink-soft">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-white/[0.045]", className)} aria-hidden />;
}

/** Esqueleto de página: mesma grade dos cards reais (sem salto de layout). */
export function PageSkeleton({ rows = [["col-span-12 lg:col-span-8 h-[300px]", "col-span-12 lg:col-span-4 h-[300px]"], ["col-span-12 h-[420px]"]] }: { rows?: string[][] }) {
  return (
    <div role="status" aria-label="Carregando dados" className="grid grid-cols-12 gap-3.5">
      {rows.flat().map((cls, i) => (
        <div key={i} className={cn("facade p-5", cls)}>
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-5 h-[calc(100%-40px)] w-full" />
        </div>
      ))}
      <span className="sr-only">Carregando…</span>
    </div>
  );
}

/** Número que conta até o valor real (só quando visível e com movimento habilitado). */
export function AnimatedCounter({ value, format = (n) => Math.round(n).toLocaleString("pt-BR"), className }: { value: number; format?: (n: number) => string; className?: string }) {
  const enabled = useMotionEnabled();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const [display, setDisplay] = useState(enabled ? 0 : value);
  const from = useRef(0);

  useEffect(() => {
    if (!enabled) {
      from.current = value;
      return;
    }
    if (!inView) return;
    const controls = animate(from.current, value, {
      duration: motionTokens.counter,
      ease: motionTokens.ease,
      onUpdate: setDisplay,
      onComplete: () => (from.current = value),
    });
    return () => controls.stop();
  }, [value, inView, enabled]);

  return (
    <span ref={ref} className={cn("tnum", className)}>
      {format(enabled ? display : value)}
    </span>
  );
}
