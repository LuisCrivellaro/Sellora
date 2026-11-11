"use client";

import { importProspects } from "../data/repository";
import { finishSearch, getProspectState, markImported, recordSearchDemos } from "./store";
import type { JobView } from "./types";

/** Chamado ao receber o resultado terminal, inclusive após retomar uma pesquisa. */
export function completeProspectSearch(job: JobView) {
  finishSearch(job);
  const state = getProspectState();
  const search = state.searches.find((s) => s.id === job.id);
  if (job.status !== "completed" || !search?.generateDemos || search.demoSummary) return;
  try {
    const items = state.results.filter((r) => r.searchId === job.id);
    const report = importProspects(items, { generateDemos: true });
    markImported(report.demos);
    const unique = [...new Map(report.demos.map((d) => [d.leadId, d])).values()];
    recordSearchDemos(job.id, {
      generated: unique.filter((d) => !d.reused).length,
      reused: unique.filter((d) => d.reused).length,
      ignored: items.length - report.demos.length - report.invalid.length,
      invalid: report.invalid.length,
    });
  } catch (e) {
    recordSearchDemos(job.id, null, e instanceof Error ? e.message : "Não foi possível preparar as demos. Tente gerar pelos resultados.");
  }
}
