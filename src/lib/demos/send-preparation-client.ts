"use client";

import { applyDemoPublication, approveLeadDemoAutomatically } from "../data/repository";
import { getDb, getStoreState } from "../data/store";
import { z } from "zod";
import { publicationRecordSchema, type PublicationView } from "../publishing/types";
import { demoBusinessSchema, demoRevision, type LeadDemo } from "./model";
import { automaticReviewIssues, sendPreparationState } from "./send-preparation";

export type PreparationOutcome = { status: "ready" | "needs_review" | "awaiting_publication"; message: string };
const viewSchema = publicationRecordSchema.omit({ owner: true }).extend({ active: z.boolean() });

/** A fila chama este fluxo apenas após uma escolha explícita. Nenhum envio de mensagem ocorre aqui. */
export async function prepareDemoForSend(leadId: string, revision: string, controls: { stopped: () => boolean; phase: (text: string) => void; checkpoint: (revision: string) => void }): Promise<PreparationOutcome | null> {
  const current = (): LeadDemo => {
    const storage = getStoreState();
    if (storage.storageError || storage.sync.error || storage.sync.authExpired) throw new Error("Resolva a gravação do CRM antes de preparar o envio. A demo foi preservada.");
    const lead = getDb().leads.find((lead) => lead.id === leadId);
    const demo = lead?.demo;
    if (!demo || demoRevision(demo) !== revision) throw new Error("A demo foi alterada durante a preparação. Revise a versão atual manualmente.");
    const businessFields = demoBusinessSchema.omit({ category: true });
    if (!lead || ["ganho", "perdido"].includes(lead.stage) || JSON.stringify(businessFields.parse(lead)) !== JSON.stringify(businessFields.parse(demo.business))) throw new Error("O cadastro do lead mudou. Confira a demo e a mensagem antes de preparar o envio.");
    return demo;
  };
  const persisted = async () => {
    const deadline = Date.now() + 30_000;
    while (!controls.stopped()) {
      const storage = getStoreState();
      if (storage.storageError || storage.sync.error || storage.sync.authExpired) throw new Error("A gravação do CRM precisa de atenção. Tente preparar novamente após resolver o erro.");
      if (!storage.sync.pending) return;
      if (Date.now() >= deadline) throw new Error("Aguardando a gravação do CRM. Tente preparar novamente em instantes.");
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  };
  if (controls.stopped()) return null;
  const demo = current();
  const issues = automaticReviewIssues(demo);
  if (issues.length) return { status: "needs_review", message: issues.join(" ") };
  const siteId = demo.site!.id;
  const endpoint = `/api/publications/${encodeURIComponent(leadId)}`;
  const request = async (url: string, action?: string): Promise<Record<string, unknown> | null> => {
    if (controls.stopped()) return null;
    current();
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(30_000), ...(action ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, siteId, business: { name: demo.business.name, city: demo.business.city, uf: demo.business.uf } }) } : {}) });
    const body = await response.json();
    if (controls.stopped()) return null;
    current();
    if (!response.ok) throw new Error(body.error || "Não foi possível concluir a publicação.");
    return body;
  };
  const accept = (body: Record<string, unknown> | null): PublicationView | null => {
    if (!body?.publication) return null;
    const view = viewSchema.parse(body.publication);
    if (view.leadId !== leadId || view.siteId !== siteId) throw new Error("Existe uma publicação de outra versão em andamento. Confira antes de continuar.");
    applyDemoPublication(leadId, { status: view.status, siteId: view.siteId, publishedSiteId: view.publishedSiteId, url: view.url, domain: view.domain, coolifyAppUuid: view.coolifyAppUuid, lastDeployAt: view.lastDeployAt, syncedAt: new Date().toISOString() });
    return view;
  };
  try {
    controls.phase("QA aprovado; verificando publicação");
    await persisted();
    const config = await request("/api/publications");
    if (controls.stopped()) return null;
    if (!(config?.status as { configured?: boolean } | undefined)?.configured) return { status: "awaiting_publication", message: "Demo e mensagem salvas. Configure a publicação no Coolify e tente preparar o envio novamente." };
    const existing = await request(`${endpoint}?refresh=1`);
    if (controls.stopped()) return null;
    // Uma versão anterior publicada pode ser atualizada; uma operação ativa de outra versão exige revisão.
    const previous = existing?.publication ? viewSchema.parse(existing.publication) : null;
    if (previous && previous.leadId !== leadId) throw new Error("Publicação de outro lead recebida.");
    if (previous?.siteId !== siteId && previous?.active) throw new Error("Outra versão deste lead está sendo publicada. Aguarde e tente novamente.");
    let view = previous?.siteId === siteId ? accept(existing) : null;
    if (!view?.active && !(view?.status === "published" && view.health === "ok" && view.publishedSiteId === siteId)) {
      controls.phase("Publicando demo no Coolify");
      view = accept(await request(endpoint, (previous?.siteId !== siteId && previous) || view?.status === "published" ? "republish" : view?.status === "failed" ? "retry" : "publish"));
      if (!view && !controls.stopped()) throw new Error("O servidor não confirmou o início da publicação. A demo está salva; tente preparar novamente.");
    }
    const deadline = Date.now() + 25 * 60_000;
    while (!controls.stopped()) {
      current();
      if (view?.status === "published" && view.health === "ok" && view.publishedSiteId === siteId && view.url && /^https?:\/\//.test(view.url)) {
        approveLeadDemoAutomatically(leadId, revision);
        revision = demoRevision(getDb().leads.find((lead) => lead.id === leadId)!.demo)!;
        controls.checkpoint(revision);
        await persisted();
        if (controls.stopped()) return null;
        current();
        const lead = getDb().leads.find((lead) => lead.id === leadId)!;
        return { status: "ready", message: sendPreparationState(lead.demo!, lead.phone) };
      }
      if (view?.status === "failed" || view?.status === "suspended" || view?.status === "removed") throw new Error(view.lastError || "A publicação não foi concluída. A demo foi preservada.");
      if (Date.now() >= deadline || (view && !view.active && !["preparing", "deploying"].includes(view.status))) throw new Error("O link público ainda não foi confirmado. Confira a publicação e tente preparar novamente.");
      controls.phase("Aguardando publicação e confirmação do link público");
      await new Promise((resolve) => setTimeout(resolve, 3000));
      view = accept(await request(`${endpoint}?refresh=1`));
      if (!view && !controls.stopped()) throw new Error("O registro da publicação não foi encontrado. Confira antes de preparar novamente.");
    }
    return null;
  } catch (error) {
    if (controls.stopped()) return null;
    return { status: "awaiting_publication", message: error instanceof Error ? error.message : "Falha na preparação; demo e mensagem preservadas." };
  }
}
