import { segmentsFor } from "./catalog";
import { classify, normalizeName, phoneDigits, socialPlatform, type Candidate } from "./classify";
import { buildOverpassQuery, fetchOverpass, geocodeCity, OSM_ATTRIBUTION, SourceError, toCandidate } from "./osm";
import { checkSite } from "./site-check";
import type { JobPhase, ProspectParams, ProspectResult, SiteCheck } from "./types";

/**
 * Executor "osm": implementa o fluxo da skill local-client-prospector
 * (pesquisa → verificação de presença → classificação) com fontes abertas.
 * Recebe um AbortSignal (cancelamento) e reporta progresso real.
 */

export interface Progress {
  phase?: JobPhase;
  message?: string;
  candidates?: number;
  analyzed?: number;
  planned?: number;
  found?: number;
  warning?: string;
}

export interface ExecutorOutput {
  results: ProspectResult[];
  attribution: string;
}

const SITE_CONCURRENCY = 4;
const MAX_SITE_CHECKS = 150;


type Kind = "none" | "social" | "own";
function kindOf(c: Candidate): Kind {
  if (!c.website) return c.instagram || c.otherSocials.length ? "social" : "none";
  return socialPlatform(c.website) ? "social" : "own";
}

export async function runOsmProspecting(params: ProspectParams, signal: AbortSignal, report: (p: Progress) => void): Promise<ExecutorOutput> {
  const now = new Date();
  report({ phase: "geocoding", message: `Localizando ${params.city}/${params.uf}…` });
  const center = await geocodeCity(params.city, params.uf as Parameters<typeof geocodeCity>[1], signal);
  if (signal.aborted) throw new SourceError("Pesquisa cancelada.");

  report({ phase: "discovering", message: `Buscando estabelecimentos em até ${params.radiusKm} km…` });
  const limit = Math.min(1500, Math.max(300, params.maxResults * 15));
  const elements = await fetchOverpass(buildOverpassQuery(segmentsFor(params.segment), center, params.radiusKm, limit), signal);
  if (elements.length >= limit) report({ warning: `O OpenStreetMap devolveu o limite de ${limit} registros; parte do raio pode ter ficado de fora.` });

  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const el of elements) {
    const c = toCandidate(el, params, center);
    if (c && !seen.has(c.id)) {
      seen.add(c.id);
      candidates.push(c);
    }
  }
  report({ candidates: candidates.length, message: `${candidates.length} estabelecimentos com nome encontrados.` });

  // Prioridade: contato comercial publicado, depois proximidade.
  candidates.sort((a, b) => Number(!!b.phone) - Number(!!a.phone) || (a.distanceKm ?? 99) - (b.distanceKm ?? 99));

  const wanted = (c: Candidate) => {
    const k = kindOf(c);
    if (params.opportunity === "sem_site") return k === "none";
    if (params.opportunity === "so_redes") return k === "social";
    if (params.opportunity === "desatualizado") return k === "own";
    return true;
  };
  const pool1 = candidates.filter(wanted);

  // Duplicados dentro da pesquisa: mesmo nome normalizado + cidade, ou mesmo telefone.
  const byName = new Map<string, string>();
  const byPhone = new Map<string, string>();
  const duplicateOf = new Map<string, string>();
  for (const c of candidates) {
    const nameKey = `${normalizeName(c.name)}|${normalizeName(c.city)}`;
    const phoneKey = phoneDigits(c.phone);
    const prev = byName.get(nameKey) ?? (phoneKey.length >= 10 ? byPhone.get(phoneKey) : undefined);
    if (prev) duplicateOf.set(c.id, prev);
    else {
      byName.set(nameKey, c.name);
      if (phoneKey.length >= 10) byPhone.set(phoneKey, c.name);
    }
  }

  const results: ProspectResult[] = [];
  const maxSkips = Math.ceil(params.maxResults / 2);
  let skips = 0;
  let analyzed = 0;
  let blocked = 0;
  let failedChecks = 0;
  const countable = () => results.filter((r) => r.classification !== "SKIP").length;

  const accept = (r: ProspectResult): boolean => {
    if (r.classification === "SKIP") {
      if (skips >= maxSkips) return false;
      skips++;
    } else if (countable() >= params.maxResults) return false;
    if (params.opportunity === "desatualizado" && r.classification !== "WARM" && r.classification !== "SKIP") return false;
    results.push(r);
    return true;
  };

  const needsCheck = params.opportunity === "desatualizado";
  const planned = needsCheck ? Math.min(pool1.length, MAX_SITE_CHECKS, params.maxResults * 4) : Math.min(pool1.length, params.maxResults + maxSkips);
  report({ phase: "verifying", planned, analyzed: 0, found: 0, message: pool1.length ? "Verificando presença digital…" : "Nenhum estabelecimento corresponde ao filtro." });

  // Lotes na ordem de prioridade: os sites do lote são conferidos em paralelo e
  // os resultados entram na ordem original (resultado determinístico).
  const queue = pool1.slice(0, needsCheck ? planned : pool1.length);
  let checks = 0;
  for (let i = 0; i < queue.length && countable() < params.maxResults && !signal.aborted; i += SITE_CONCURRENCY) {
    const batch = queue.slice(i, i + SITE_CONCURRENCY);
    const checked = await Promise.all(
      batch.map(async (c) => {
        const dup = duplicateOf.get(c.id) ?? null;
        if (dup || kindOf(c) !== "own") return { c, dup, check: null as SiteCheck | null, skipped: false };
        if (checks >= MAX_SITE_CHECKS) return { c, dup, check: null, skipped: true };
        checks++;
        const check = await checkSite(c.website, signal, now);
        if (check.blocked) blocked++;
        if (!check.reachable && !signal.aborted) failedChecks++;
        return { c, dup, check, skipped: false };
      }),
    );
    if (signal.aborted) break;
    for (const { c, dup, check, skipped } of checked) {
      if (skipped || countable() >= params.maxResults) continue;
      analyzed++;
      accept(classify(c, check, { radiusKm: params.radiusKm, now, duplicateOf: dup }));
    }
    report({ analyzed: Math.min(analyzed, planned), found: countable() });
  }
  if (signal.aborted) throw new SourceError("Pesquisa cancelada.");

  report({ phase: "classifying", message: "Classificando e ordenando…" });
  if (blocked) report({ warning: `${blocked} site(s) recusaram a verificação automática; ficaram como LOW com confiança baixa.` });
  if (failedChecks) report({ warning: `${failedChecks} site(s) não responderam durante a verificação (registrado como problema verificável).` });
  const order = { HOT: 0, WARM: 1, LOW: 2, SKIP: 3 } as const;
  results.sort((a, b) => order[a.classification] - order[b.classification] || b.score - a.score);
  return { results, attribution: OSM_ATTRIBUTION };
}
