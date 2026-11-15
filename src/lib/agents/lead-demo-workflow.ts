"use client";

import { importProspects } from "../data/repository";
import { getDb } from "../data/store";
import { enqueueDemoGeneration } from "../demos/generation-client";
import { completeProspectSearch } from "../prospecting/complete-search";
import { getProspectState, markImported, recordSearchDemos, type StoredProspect } from "../prospecting/store";
import type { JobView } from "../prospecting/types";

/** Integração explícita: importar leads não cria demos nem inicia o gerador. */
export function sendProspectsToDemoGenerator(items: StoredProspect[], automatic = false, prepareForSend = false) {
  const eligible = items.filter((item) => !item.discarded && ["HOT", "WARM"].includes(item.classification));
  const report = importProspects(eligible);
  const links = [...report.created.map((item) => ({ resultId: item.resultId, leadId: item.lead.id })), ...report.duplicates.map((item) => ({ resultId: item.resultId, leadId: item.match.leadId }))];
  markImported(links);
  const ids = new Set(links.map((item) => item.leadId));
  const leads = getDb().leads.filter((lead) => ids.has(lead.id) && !lead.demo && !["ganho", "perdido"].includes(lead.stage));
  enqueueDemoGeneration(leads.map((lead) => lead.id), { start: automatic, ...(prepareForSend ? { prepareForSend: true } : {}) });
  return { generated: leads.length, reused: links.length - leads.length, ignored: items.length - eligible.length, invalid: report.invalid.length };
}

/** Só uma intenção NOVA e explícita permite automação; flags antigas não iniciam IA. */
export function completeProspectingWorkflow(job: JobView) {
  completeProspectSearch(job);
  const state = getProspectState();
  const search = state.searches.find((item) => item.id === job.id);
  if (job.status !== "completed" || !search || !["automatic", "prepare"].includes(search.demoMode ?? "manual") || search.demoSummary || search.demoError) return;
  try {
    const summary = sendProspectsToDemoGenerator(state.results.filter((item) => item.searchId === job.id), true, search.demoMode === "prepare");
    recordSearchDemos(job.id, summary);
  } catch (error) {
    recordSearchDemos(job.id, null, error instanceof Error ? error.message : "Falha ao enviar ao gerador. Os resultados da pesquisa foram preservados.");
  }
}
