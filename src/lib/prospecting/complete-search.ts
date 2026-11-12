"use client";

import { finishSearch } from "./store";
import type { JobView } from "./types";
import { selectTopProspects } from "./shortlist";

/** Concluir ou retomar uma pesquisa salva apenas candidatos para revisão. */
export function completeProspectSearch(job: JobView) {
  const results = job.status === "completed" && job.results ? selectTopProspects(job.results, job.params.radiusKm) : job.results;
  finishSearch({ ...job, results, found: job.status === "completed" ? results?.length ?? 0 : job.found });
}
