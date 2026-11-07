import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Identificador único (UUID v4) — mesmo formato das chaves do Postgres.
 * O parâmetro antigo de prefixo é ignorado de propósito para manter as chamadas.
 */
export function uid(_prefix?: string): string {
  void _prefix;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Contextos sem randomUUID (http fora de localhost): v4 a partir de getRandomValues.
  const b = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") crypto.getRandomValues(b);
  else for (let i = 0; i < 16; i++) b[i] = Math.floor(Math.random() * 256);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
export const moneyColor = (value: number) =>
  value > 0 ? "var(--money-positive)" : value < 0 ? "var(--money-negative)" : "var(--data-muted)";
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
