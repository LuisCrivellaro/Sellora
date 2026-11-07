/** Utilitários de data (fuso local do navegador). */

export const DAY = 86_400_000;

export function startOfDay(d: Date | string | number): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date | string, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function addMonths(d: Date | string, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

/** Diferença em dias de calendário (b - a). */
export function daysBetween(a: Date | string, b: Date | string): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY);
}

export function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Converte "AAAA-MM-DD" (input date) para ISO ao meio-dia local, evitando deslocamento de fuso. */
export function fromInputDate(value: string): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0).toISOString();
}

export function toInputDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return isoDate(new Date(iso));
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const shortFmt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "short" });
const monthYearFmt = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" });

const clean = (s: string) => s.replace(".", "").replace(" de ", " ");

export const formatDate = (iso: string | null | undefined) => (iso ? dateFmt.format(new Date(iso)) : "—");
export const formatShort = (d: Date | string) => clean(shortFmt.format(new Date(d)));
export const formatMonth = (d: Date | string) => clean(monthFmt.format(new Date(d)));
export const formatMonthYear = (d: Date | string) => clean(monthYearFmt.format(new Date(d)));

/** "hoje", "ontem", "há 3 dias", "em 2 dias", "amanhã". */
export function formatRelative(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const diff = daysBetween(now, iso);
  if (diff === 0) return "hoje";
  if (diff === -1) return "ontem";
  if (diff === 1) return "amanhã";
  if (diff < 0) {
    const n = -diff;
    if (n < 30) return `há ${n} dias`;
    const months = Math.round(n / 30);
    return months <= 1 ? "há 1 mês" : `há ${months} meses`;
  }
  if (diff < 30) return `em ${diff} dias`;
  const months = Math.round(diff / 30);
  return months <= 1 ? "em 1 mês" : `em ${months} meses`;
}

export type RangeKey = "7d" | "30d" | "90d" | "1a";

export const RANGE_OPTIONS: { value: RangeKey; label: string; description: string }[] = [
  { value: "7d", label: "7D", description: "Últimos 7 dias, por dia" },
  { value: "30d", label: "30D", description: "Últimos 30 dias, por dia" },
  { value: "90d", label: "90D", description: "Últimas 13 semanas, por semana" },
  { value: "1a", label: "1A", description: "Últimos 12 meses, por mês" },
];

export interface Bucket {
  start: number;
  end: number;
  label: string;
  longLabel: string;
}

/** Janelas de tempo contíguas que terminam hoje. */
export function buildBuckets(range: RangeKey, now: Date = new Date()): Bucket[] {
  const today = startOfDay(now);
  const out: Bucket[] = [];
  if (range === "7d" || range === "30d") {
    const n = range === "7d" ? 7 : 30;
    for (let i = n - 1; i >= 0; i--) {
      const s = addDays(today, -i);
      out.push({ start: s.getTime(), end: addDays(s, 1).getTime(), label: formatShort(s), longLabel: formatDate(s.toISOString()) });
    }
    return out;
  }
  if (range === "90d") {
    for (let i = 12; i >= 0; i--) {
      const end = addDays(today, 1 - i * 7);
      const s = addDays(end, -7);
      out.push({
        start: s.getTime(),
        end: end.getTime(),
        label: formatShort(s),
        longLabel: `Semana de ${formatShort(s)} a ${formatShort(addDays(end, -1))}`,
      });
    }
    return out;
  }
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  for (let i = 11; i >= 0; i--) {
    const s = addMonths(firstOfMonth, -i);
    const e = addMonths(s, 1);
    out.push({ start: s.getTime(), end: e.getTime(), label: formatMonth(s), longLabel: formatMonthYear(s) });
  }
  return out;
}

/** Conta ocorrências por janela. */
export function countByBucket(buckets: Bucket[], dates: (string | null | undefined)[]): number[] {
  const counts = buckets.map(() => 0);
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    const idx = buckets.findIndex((b) => t >= b.start && t < b.end);
    if (idx >= 0) counts[idx]++;
  }
  return counts;
}

/** Soma valores por janela. */
export function sumByBucket(buckets: Bucket[], entries: { date: string | null | undefined; value: number }[]): number[] {
  const totals = buckets.map(() => 0);
  for (const e of entries) {
    if (!e.date) continue;
    const t = new Date(e.date).getTime();
    const idx = buckets.findIndex((b) => t >= b.start && t < b.end);
    if (idx >= 0) totals[idx] += e.value;
  }
  return totals;
}
