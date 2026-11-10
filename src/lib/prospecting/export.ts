import { segmentMeta } from "../constants";
import { presenceLabel } from "./classify";
import type { ProspectResult } from "./types";

/** Exportação CSV/JSON dos resultados (mesmas colunas da skill). */

export const CSV_COLUMNS = ["classificacao", "score", "confianca", "nome", "segmento", "cidade", "uf", "distancia_km", "presenca", "website", "instagram", "outras_redes", "telefone", "problemas", "justificativa", "fontes", "data_pesquisa"] as const;

/** Aspas duplas + neutraliza fórmulas de planilha (=, +, -, @) vindas de dados externos. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: ProspectResult[]): string {
  const lines = rows.map((r) =>
    [
      r.classification,
      r.score,
      r.confidence,
      r.name,
      segmentMeta[r.segment].label,
      r.city,
      r.uf,
      r.distanceKm ?? "",
      presenceLabel[r.presence],
      r.website,
      r.instagram,
      r.otherSocials.join(" | "),
      r.phone,
      r.problems.join(" | "),
      r.justification,
      r.sources.map((s) => s.url).join(" | "),
      r.checkedAt,
    ]
      .map(csvCell)
      .join(","),
  );
  return `﻿${[CSV_COLUMNS.join(","), ...lines].join("\r\n")}\r\n`;
}

export function toJson(rows: ProspectResult[], meta: Record<string, unknown> = {}): string {
  return JSON.stringify({ exportedAt: new Date().toISOString(), ...meta, count: rows.length, results: rows }, null, 2);
}

export function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
