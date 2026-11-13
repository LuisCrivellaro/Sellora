"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { applyDemoPublication } from "../data/repository";
import type { DemoPublication } from "../demos/model";
import type { PublicationView, PublishingStatusView } from "./types";

type Action = "publish" | "republish" | "retry" | "verify";

let statusCache: Promise<PublishingStatusView | null> | null = null;
function loadStatus(): Promise<PublishingStatusView | null> {
  statusCache ??= fetch("/api/publications", { cache: "no-store" })
    .then(async (response) => response.ok ? ((await response.json()).status as PublishingStatusView) : null)
    .catch(() => null);
  return statusCache;
}

const summaryOf = (view: PublicationView): DemoPublication => ({
  status: view.status, siteId: view.siteId, publishedSiteId: view.publishedSiteId, url: view.url, domain: view.domain,
  coolifyAppUuid: view.coolifyAppUuid, lastDeployAt: view.lastDeployAt, syncedAt: new Date().toISOString(),
});

/**
 * Estado da publicação de um lead, lido do servidor (fonte da verdade) e copiado em resumo para o lead.
 * Consulta a cada 3 s só enquanto há operação em andamento; fora disso, uma reconciliação ao abrir.
 */
export function usePublication(leadId: string, business: { name: string; city: string; uf: string }, siteId: string | null) {
  const [config, setConfig] = useState<PublishingStatusView | null | undefined>(undefined);
  const [publication, setPublication] = useState<PublicationView | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Action | null>(null);
  const mounted = useRef(true);

  const accept = useCallback((view: PublicationView | null) => {
    if (!mounted.current) return;
    setPublication(view);
    if (view) { try { applyDemoPublication(leadId, summaryOf(view)); } catch { /* o resumo no lead é cópia; o servidor continua certo */ } }
  }, [leadId]);

  const load = useCallback(async (refresh: boolean) => {
    try {
      const response = await fetch(`/api/publications/${encodeURIComponent(leadId)}${refresh ? "?refresh=1" : ""}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível consultar a publicação.");
      accept(body.publication ?? null);
      setError(null);
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Não foi possível consultar a publicação."); }
  }, [leadId, accept]);

  useEffect(() => {
    mounted.current = true;
    void loadStatus().then((status) => { if (mounted.current) setConfig(status); });
    const first = setTimeout(() => void load(true), 0);
    return () => { mounted.current = false; clearTimeout(first); };
  }, [load]);

  const working = !!publication && (publication.active || publication.status === "preparing" || publication.status === "deploying");
  useEffect(() => {
    if (!working) return;
    const timer = setInterval(() => void load(false), 3000);
    return () => clearInterval(timer);
  }, [working, load]);

  const run = useCallback(async (action: Action) => {
    if (!siteId) return { ok: false as const, error: "Esta demo não tem site V6 para publicar." };
    setBusy(action);
    try {
      const response = await fetch(`/api/publications/${encodeURIComponent(leadId)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, siteId, business }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Não foi possível concluir.");
      accept(body.publication ?? null);
      setError(null);
      return { ok: true as const, reused: !!body.reused };
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Não foi possível concluir.";
      if (mounted.current) setError(message);
      return { ok: false as const, error: message };
    } finally { if (mounted.current) setBusy(null); }
  }, [leadId, siteId, business, accept]);

  return { config, publication, error, busy, working, run, reload: () => load(true) };
}
