import { AnimatedCounter } from "@/components/ui/states";
import { cn, formatBRL, formatBRLCompact, moneyColor } from "@/lib/utils";

/** A cor acompanha o sinal do valor; despesas e descontos recebem valor negativo. */
export function Money({ value, compact = false, animated = false, showPlus = false, className }: {
  value: number;
  compact?: boolean;
  animated?: boolean;
  showPlus?: boolean;
  className?: string;
}) {
  const format = compact ? formatBRLCompact : formatBRL;
  // -0 (ex.: saída zero exibida como negativa) vira 0: nunca mostra "−R$ 0,00".
  value = value || 0;
  return (
    <span className={cn("tnum", className)} style={{ color: moneyColor(value) }}>
      {showPlus && value > 0 ? "+ " : ""}
      {animated ? <AnimatedCounter value={value} format={format} /> : format(value)}
    </span>
  );
}
