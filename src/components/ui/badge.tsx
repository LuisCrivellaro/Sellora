import { tone as toneVar, type Tone } from "@/lib/constants";
import { cn } from "@/lib/utils";

/** Status com ponto luminoso + texto (nunca só cor). */
export function StatusBadge({ tone, label, className, size = "md" }: { tone: Tone; label: React.ReactNode; className?: string; size?: "sm" | "md" }) {
  const color = toneVar[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap font-medium text-ink", size === "sm" ? "text-[12px]" : "text-[13px]", className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: color, boxShadow: tone === "ghost" ? undefined : `0 0 4px ${color}` }} aria-hidden />
      {label}
    </span>
  );
}

/** Etiqueta em pill com contorno tingido. */
export function TonePill({ tone, children, className }: { tone: Tone; children: React.ReactNode; className?: string }) {
  const color = toneVar[tone];
  return (
    <span
      className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11.5px] font-semibold whitespace-nowrap", className)}
      // Texto clareado (mistura com branco) para manter contraste AA mesmo nos tons violeta/índigo.
      style={{ color: `color-mix(in oklab, ${color} 62%, white)`, borderColor: `color-mix(in oklab, ${color} 45%, transparent)`, background: `color-mix(in oklab, ${color} 12%, transparent)` }}
    >
      {children}
    </span>
  );
}

/** Selo permanente da origem dos dados: demonstração, local ou banco (Supabase). */
export function DemoBadge({ demo, remote = false }: { demo: boolean; remote?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap",
        demo ? "border-[rgba(216,167,90,0.45)] bg-[rgba(216,167,90,0.1)] text-warn" : "border-seam-strong text-ink-soft",
      )}
    >
      <span className={cn("size-1.5 rounded-full", demo ? "bg-warn" : remote ? "bg-mint" : "bg-[var(--data-muted)]")} aria-hidden />
      {demo ? "Demonstração" : remote ? "Banco Supabase" : "Dados locais"}
    </span>
  );
}
