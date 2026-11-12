import { normalizeName, phoneDigits } from "./classify";
import type { ProspectResult } from "./types";

export const SHORTLIST_SIZE = 10;

/** Ranking da pesquisa atual, com oportunidades qualificadas dentro do raio. */
export function selectTopProspects<T extends ProspectResult & { discarded?: boolean }>(results: T[], radiusKm: number): T[] {
  const confidence = { alta: 0, media: 1, baixa: 2 };
  const ranked = results.filter((result) => !result.discarded && ["HOT", "WARM"].includes(result.classification)
    && Number.isFinite(result.score) && result.distanceKm !== null && result.distanceKm >= 0 && result.distanceKm <= radiusKm)
    .sort((a, b) => b.score - a.score || confidence[a.confidence] - confidence[b.confidence]
      || a.distanceKm! - b.distanceKm! || a.id.localeCompare(b.id));
  const ids = new Set<string>();
  const names = new Set<string>();
  const phones = new Set<string>();
  const top: T[] = [];
  for (const result of ranked) {
    const name = normalizeName(`${result.name} ${result.city} ${result.uf}`);
    const phone = phoneDigits(result.phone);
    if (ids.has(result.id) || names.has(name) || (phone.length >= 10 && phones.has(phone))) continue;
    ids.add(result.id);
    names.add(name);
    if (phone.length >= 10) phones.add(phone);
    top.push(result);
    if (top.length === SHORTLIST_SIZE) break;
  }
  return top;
}
