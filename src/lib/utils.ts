import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = ""): string {
  const raw =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return prefix ? `${prefix}_${raw}` : raw;
}

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlCompact = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});
const intFmt = new Intl.NumberFormat("pt-BR");

export const formatBRL = (value: number) => brl.format(value);
export const formatBRLCompact = (value: number) => (Math.abs(value) < 10000 ? brl.format(value) : brlCompact.format(value));
export const formatInt = (value: number) => intFmt.format(Math.round(value));
export const formatPercent = (value: number | null, digits = 0) =>
  value === null || Number.isNaN(value) ? "—" : `${value.toFixed(digits).replace(".", ",")}%`;

/** Percentual seguro: retorna null quando o denominador é zero. */
export function ratio(part: number, total: number): number | null {
  return total > 0 ? (part / total) * 100 : null;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function normalizeText(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function matchesQuery(query: string, ...fields: (string | null | undefined)[]) {
  const q = normalizeText(query.trim());
  if (!q) return true;
  return fields.some((f) => f && normalizeText(f).includes(q));
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

export function round2(n: number) {
  return Math.round(n * 100) / 100;
}
