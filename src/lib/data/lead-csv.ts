import { SEGMENTS, segmentMeta } from "../constants";
import { leadInputSchema, type LeadInput } from "../schemas";
import type { LeadSource, Priority, Segment, WebsiteSituation } from "../types";

/**
 * Importação de leads por arquivo CSV (funções puras, testadas).
 * Aceita o formato da skill `local-client-prospector` / exportação da aba
 * Prospecção IA (`assets/lead-template.csv`) e também planilhas simples com
 * colunas nome, segmento, cidade, uf, telefone, email, website, instagram,
 * origem, prioridade, observacoes. Nada é inventado: campo ausente fica vazio.
 */

export const LEAD_CSV_MAX_ROWS = 500;

/** Lê CSV com vírgula ou ponto e vírgula, aspas duplas e quebras de linha dentro de aspas. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const firstLine = src.split(/\r?\n/, 1)[0] ?? "";
  const sep = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const ALIASES: Record<string, string[]> = {
  name: ["nome", "estabelecimento", "empresa", "name"],
  segment: ["segmento", "categoria", "segment"],
  city: ["cidade", "city"],
  uf: ["uf", "estado"],
  phone: ["telefone", "fone", "celular", "whatsapp", "phone"],
  email: ["email", "e_mail"],
  website: ["website", "site", "url"],
  instagram: ["instagram"],
  source: ["origem", "fonte_do_lead", "source"],
  priority: ["prioridade", "priority"],
  notes: ["observacoes", "observacao", "notas", "notes", "diagnostico"],
  classification: ["classificacao"],
  score: ["score"],
  confidence: ["confianca"],
  presence: ["presenca"],
  problems: ["problemas"],
  justification: ["justificativa"],
  sources: ["fontes"],
  checkedAt: ["data_pesquisa"],
};

function segmentOf(raw: string): Segment {
  const v = norm(raw);
  if (!v) return "outros";
  const direct = SEGMENTS.find((s) => s === v || norm(segmentMeta[s].label) === v);
  if (direct) return direct;
  if (/restaur|lanch|pizz|bar|cafe|padar|food|hamburg|acai|sorvet/.test(v)) return "restaurantes";
  if (/saude|clinic|odont|dent|medic|fisio|psico|veterin|farmac|academ/.test(v)) return "saude";
  if (/belez|salao|barbe|estetic|manicure|spa/.test(v)) return "beleza";
  if (/servic|escritor|advoc|contab|oficina|mecan|imobil/.test(v)) return "servicos";
  if (/comerc|loja|mercad|pet|moda|roupa/.test(v)) return "comercio";
  return "outros";
}

function sourceOf(raw: string, fromProspector: boolean): LeadSource {
  const v = norm(raw);
  if (/prospec/.test(v) || (!v && fromProspector)) return "prospeccao_ia";
  if (/maps|google/.test(v)) return "google_maps";
  if (/insta/.test(v)) return "instagram";
  if (/indic/.test(v)) return "indicacao";
  if (/manual|pesquisa/.test(v) || !v) return "manual";
  return "outros";
}

function priorityOf(raw: string, classification: string): Priority {
  const v = norm(raw);
  if (v === "alta" || v === "media" || v === "baixa") return v;
  const c = classification.toUpperCase();
  return c === "HOT" ? "alta" : c === "WARM" ? "media" : c ? "baixa" : "media";
}

function situationOf(presence: string, classification: string, website: string, problems: string): WebsiteSituation {
  const p = norm(presence);
  const c = classification.toUpperCase();
  if (c === "LOW" || /adequad/.test(p)) return "adequado";
  if (/viewport|mobile/.test(norm(problems))) return "sem_mobile";
  if (/desatualiz|problema|fora_do_ar/.test(p) || c === "WARM") return "desatualizado";
  if (!website || /sem_site|so_redes|redes/.test(p) || c === "HOT") return "sem_site";
  return "desatualizado";
}

export interface CsvLeadRow {
  line: number;
  input: LeadInput;
}

export interface CsvLeadParse {
  ok: boolean;
  message?: string;
  rows: CsvLeadRow[];
  invalid: { line: number; name: string; message: string }[];
  /** Linhas além do limite, ignoradas. */
  skipped: number;
}

export function parseLeadCsv(text: string): CsvLeadParse {
  const table = parseCsv(text);
  const empty: CsvLeadParse = { ok: false, rows: [], invalid: [], skipped: 0 };
  if (table.length < 2) return { ...empty, message: "Arquivo sem linhas de dados. A primeira linha deve ter os nomes das colunas." };
  const header = table[0].map(norm);
  const col = (key: string) => header.findIndex((h) => ALIASES[key].includes(h));
  const idx = Object.fromEntries(Object.keys(ALIASES).map((k) => [k, col(k)])) as Record<string, number>;
  if (idx.name < 0 || idx.city < 0) return { ...empty, message: "Colunas obrigatórias ausentes: “nome” e “cidade”. Use o modelo da skill de prospecção ou uma planilha com esses títulos." };
  const fromProspector = idx.classification >= 0;

  const body = table.slice(1);
  const rows: CsvLeadRow[] = [];
  const invalid: CsvLeadParse["invalid"] = [];
  body.slice(0, LEAD_CSV_MAX_ROWS).forEach((cells, i) => {
    // Remove o apóstrofo que a exportação coloca para neutralizar fórmulas de planilha.
    const get = (key: string) => (idx[key] >= 0 ? (cells[idx[key]] ?? "").trim().replace(/^'(?=[=+\-@])/, "") : "");
    const line = i + 2;
    const classification = get("classification");
    const website = get("website");
    const safe = <K extends "website" | "email" | "phone">(key: K, value: string) => (leadInputSchema.shape[key].safeParse(value).success ? value : "");
    const cityRaw = get("city");
    const cityUf = cityRaw.match(/^(.*?)[\s/,-]+([A-Za-z]{2})$/);
    const uf = (get("uf") || cityUf?.[2] || "").toUpperCase();
    const notes = [
      get("notes"),
      classification ? `Prospecção (arquivo) · ${classification}${get("score") ? ` · score ${get("score")}/100` : ""}${get("confidence") ? ` · confiança ${get("confidence")}` : ""}` : "",
      get("presence") ? `Presença digital: ${get("presence")}` : "",
      get("problems") ? `Problemas verificados: ${get("problems")}` : "",
      get("justification") ? `Justificativa: ${get("justification")}` : "",
      get("sources") ? `Fontes: ${get("sources")}` : "",
      get("checkedAt") ? `Data da pesquisa: ${get("checkedAt")}` : "",
      website && !safe("website", website) ? `Site informado (fora do formato): ${website}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 2000);
    const parsed = leadInputSchema.safeParse({
      name: get("name").slice(0, 120),
      segment: segmentOf(get("segment")),
      city: (get("uf") ? cityRaw : (cityUf?.[1] ?? cityRaw)).trim().slice(0, 60),
      uf,
      source: sourceOf(get("source"), fromProspector),
      website: safe("website", website),
      websiteSituation: situationOf(get("presence"), classification, website, get("problems")),
      stage: "novo",
      priority: priorityOf(get("priority"), classification),
      phone: safe("phone", get("phone")),
      email: safe("email", get("email")),
      instagram: get("instagram").slice(0, 60),
      potentialValue: 0,
      nextAction: "Revisar dados importados e qualificar",
      nextActionAt: null,
      notes,
    });
    if (parsed.success) rows.push({ line, input: parsed.data });
    else invalid.push({ line, name: get("name") || "(sem nome)", message: parsed.error.issues[0]?.message ?? "Dados inválidos." });
  });
  return { ok: true, rows, invalid, skipped: Math.max(0, body.length - LEAD_CSV_MAX_ROWS) };
}
