import { crmSegmentFromTags, UF_NAMES, type ProspectSegment } from "./catalog";
import { instagramHandle, normalizeName, type Candidate } from "./classify";
import { USER_AGENT } from "./site-check";
import type { ProspectParams } from "./types";

/**
 * Cliente do OpenStreetMap (somente servidor): Nominatim para localizar a
 * cidade e Overpass para listar estabelecimentos no raio. Serviços públicos e
 * gratuitos, sem chave; respeitamos as políticas de uso (1 req/s no Nominatim,
 * User-Agent identificado, cache e consultas sequenciais no Overpass).
 * Dados © colaboradores do OpenStreetMap, licença ODbL.
 */

export const OSM_ATTRIBUTION = "Dados © colaboradores do OpenStreetMap (ODbL)";
const NOMINATIM_URL = process.env.PROSPECCAO_NOMINATIM_URL || "https://nominatim.openstreetmap.org/search";
const OVERPASS_URL = process.env.PROSPECCAO_OVERPASS_URL || "https://overpass-api.de/api/interpreter";

export class SourceError extends Error {}

/* ───────── Controle de ritmo e cache, compartilhados no processo ───────── */

interface OsmGlobals {
  nominatimChain: Promise<unknown>;
  overpassChain: Promise<unknown>;
  geocodeCache: Map<string, { at: number; value: GeoPoint }>;
}
const g = globalThis as typeof globalThis & { __selloraOsm?: OsmGlobals };
const osm: OsmGlobals = (g.__selloraOsm ??= { nominatimChain: Promise.resolve(), overpassChain: Promise.resolve(), geocodeCache: new Map() });

/** Encadeia chamadas para nunca rodar duas ao mesmo tempo, com intervalo mínimo. */
function serialize<T>(key: "nominatimChain" | "overpassChain", gapMs: number, task: () => Promise<T>): Promise<T> {
  const run = osm[key].catch(() => undefined).then(task);
  osm[key] = run.catch(() => undefined).then(() => new Promise((r) => setTimeout(r, gapMs)));
  return run;
}

export interface GeoPoint {
  lat: number;
  lon: number;
  label: string;
}

export async function geocodeCity(city: string, uf: keyof typeof UF_NAMES, signal: AbortSignal): Promise<GeoPoint> {
  const key = `${normalizeName(city)}|${uf}`;
  const cached = osm.geocodeCache.get(key);
  if (cached && Date.now() - cached.at < 24 * 3600_000) return cached.value;
  const url = new URL(NOMINATIM_URL);
  url.search = new URLSearchParams({ format: "jsonv2", limit: "5", countrycodes: "br", city, state: UF_NAMES[uf], "accept-language": "pt-BR" }).toString();
  const data = await serialize("nominatimChain", 1100, async () => {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
    if (!res.ok) throw new SourceError(res.status === 429 ? "O serviço de mapas limitou as consultas. Tente de novo em alguns minutos." : `Falha ao localizar a cidade (HTTP ${res.status}).`);
    return (await res.json()) as { lat: string; lon: string; display_name: string; addresstype?: string }[];
  });
  const preferred = ["municipality", "city", "town", "village"];
  const hit = data.find((d) => preferred.includes(d.addresstype ?? "")) ?? data[0];
  if (!hit) throw new SourceError(`Cidade "${city}/${uf}" não encontrada no OpenStreetMap. Confira a grafia e a UF.`);
  const value = { lat: Number(hit.lat), lon: Number(hit.lon), label: hit.display_name };
  osm.geocodeCache.set(key, { at: Date.now(), value });
  return value;
}

/** Consulta Overpass (função pura, testada). */
export function buildOverpassQuery(segments: ProspectSegment[], point: GeoPoint, radiusKm: number, limit: number): string {
  const around = `(around:${Math.round(radiusKm * 1000)},${point.lat.toFixed(6)},${point.lon.toFixed(6)})`;
  const lines: string[] = [];
  for (const s of segments) {
    for (const [key, values] of Object.entries(s.tags)) {
      lines.push(`  nwr["${key}"~"^(${values.join("|")})$"]["name"]${around};`);
    }
  }
  return `[out:json][timeout:50];\n(\n${[...new Set(lines)].join("\n")}\n);\nout center tags ${limit};`;
}

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function fetchOverpass(query: string, signal: AbortSignal): Promise<OsmElement[]> {
  const attempt = () =>
    serialize("overpassChain", 1000, async () => {
      const res = await fetch(OVERPASS_URL, {
        method: "POST",
        cache: "no-store",
        signal: AbortSignal.any([signal, AbortSignal.timeout(70_000)]),
        headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({ data: query }).toString(),
      });
      return res;
    });
  let res = await attempt();
  if (res.status === 429 || res.status === 504 || res.status === 503) {
    await res.body?.cancel().catch(() => undefined);
    await new Promise((r) => setTimeout(r, 4000));
    if (signal.aborted) throw new SourceError("Pesquisa cancelada.");
    res = await attempt();
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => undefined);
    throw new SourceError(res.status === 429 || res.status === 504 || res.status === 503 ? "O OpenStreetMap (Overpass) está ocupado. Tente de novo em alguns minutos." : `Falha na busca de estabelecimentos (HTTP ${res.status}).`);
  }
  const json = (await res.json()) as { elements?: OsmElement[]; remark?: string };
  if (json.remark && /timed out|out of memory/i.test(json.remark)) throw new SourceError("A busca ficou grande demais para o OpenStreetMap. Reduza o raio ou escolha um segmento.");
  return json.elements ?? [];
}

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const first = (v: string | undefined) => (v ?? "").split(";")[0].trim();

function socialUrl(value: string, base: string): string {
  const v = value.trim();
  if (!v) return "";
  if (/^https?:\/\//i.test(v)) return v;
  return `${base}${v.replace(/^@/, "")}`;
}

/** Converte um elemento OSM em candidato (função pura, testada). */
export function toCandidate(el: OsmElement, params: Pick<ProspectParams, "city" | "uf">, center: GeoPoint): Candidate | null {
  const t = el.tags ?? {};
  const name = (t.name ?? "").trim();
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (!name || lat === undefined || lon === undefined) return null;
  const { segment, category } = crmSegmentFromTags(t);
  const phone = first(t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? t.mobile);
  const whatsapp = first(t["contact:whatsapp"] ?? t.whatsapp);
  const website = first(t.website ?? t["contact:website"] ?? t.url);
  const instagramRaw = first(t["contact:instagram"] ?? t.instagram);
  const facebook = first(t["contact:facebook"] ?? t.facebook);
  const emailRaw = first(t.email ?? t["contact:email"]);
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw) ? emailRaw.toLowerCase() : "";
  const street = t["addr:street"] ?? "";
  const number = t["addr:housenumber"] ?? "";
  const suburb = t["addr:suburb"] ?? t["addr:neighbourhood"] ?? "";
  const city = (t["addr:city"] ?? "").trim() || params.city;
  const address = [street && `${street}${number ? `, ${number}` : ""}`, suburb, city !== params.city ? city : ""].filter(Boolean).join(" — ");
  const otherSocials = [facebook && socialUrl(facebook, "https://www.facebook.com/"), whatsapp && `https://wa.me/${whatsapp.replace(/\D/g, "")}`].filter(Boolean) as string[];
  const closed = ["closed", "off"].includes((t.opening_hours ?? "").trim().toLowerCase()) || !!t.end_date || t.disused === "yes" || t.abandoned === "yes";
  return {
    id: `osm:${el.type}/${el.id}`,
    name,
    category,
    segment,
    city,
    uf: params.uf,
    address,
    addressComplete: Boolean(street && number),
    distanceKm: Math.round(haversineKm(center, { lat, lon }) * 10) / 10,
    phone: phone || (whatsapp ? whatsapp : ""),
    email,
    website: website && !/^(no|none|não)$/i.test(website) ? website : "",
    instagram: instagramHandle(instagramRaw),
    otherSocials,
    openingHours: (t.opening_hours ?? "").slice(0, 120),
    brand: t["brand:wikidata"] ? t.brand ?? name : null,
    closed,
    sourceLabel: "OpenStreetMap",
    sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
  };
}
