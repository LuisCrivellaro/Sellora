"use client";

import { useEffect, useSyncExternalStore } from "react";
import { z } from "zod";
import { applyGeneratedLeadDemo } from "../data/repository";
import { getDb } from "../data/store";
import { demoBusinessSchema, demoRevision } from "./model";
import { creationSignature, demoImageProviderSchema, demoTextProviderSchema, type CreativeReference, type DemoGenerationJob, type DemoGenerationStatus, type DemoImageProvider, type DemoTextProvider } from "./creation";
import { demoCreativeContent, withoutBusinessFields } from "./creative-review";
import { approvedConcepts } from "./concepts";
import { demoDesigns } from "./designs";

const queueItemSchema = z.object({
  leadId: z.string(), id: z.uuid(), status: z.enum(["queued", "running", "paused", "completed", "failed"]),
  resumeStatus: z.enum(["queued", "running"]).optional(),
  phase: z.string(), error: z.string().nullable(), expectedRevision: z.string().nullable(),
  expectedBusiness: z.string().optional(),
  /** Fixado ao entrar na fila: trocar a opção não altera um lote já em andamento. */
  textProvider: demoTextProviderSchema.optional(),
  imageProvider: demoImageProviderSchema.optional(),
});
export type DemoQueueItem = z.infer<typeof queueItemSchema>;
interface GeneratorState { connection: DemoGenerationStatus | null; items: DemoQueueItem[]; textProvider: DemoTextProvider; imageProvider: DemoImageProvider }
const initialState: GeneratorState = { connection: null, items: [], textProvider: "claude", imageProvider: "gemini" };
let state = initialState;
let loaded = false;
let pumping = false;
const listeners = new Set<() => void>();
const storageKey = "sellora-demo-generator-v1";
// v2: o padrão passou a ser Claude; preferências gravadas antes da troca não prevalecem.
const providerKey = "sellora-demo-text-provider-v2";
const imageProviderKey = "sellora-demo-image-provider";
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function set(next: GeneratorState) {
  state = next;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state.items));
    window.localStorage.setItem(providerKey, state.textProvider);
    window.localStorage.setItem(imageProviderKey, state.imageProvider);
  } catch { /* CRM reports its own storage failures */ }
  for (const listener of listeners) listener();
}

export function setDemoTextProvider(textProvider: DemoTextProvider) {
  set({ ...state, textProvider });
}

export function setDemoImageProvider(imageProvider: DemoImageProvider) {
  set({ ...state, imageProvider });
}

/** Cada serviço escolhido precisa estar conectado: texto (Claude ou Codex) e imagem (Gemini ou Codex). */
export function canGenerateDemos(snapshot: Pick<GeneratorState, "connection" | "textProvider" | "imageProvider">): boolean {
  const connection = snapshot.connection;
  if (!connection) return false;
  const text = snapshot.textProvider === "claude" ? !!connection.claude?.available : connection.available;
  const image = snapshot.imageProvider === "gemini" ? !!connection.gemini?.available : connection.available;
  return text && image;
}
function update(id: string, changes: Partial<DemoQueueItem>) {
  set({ ...state, items: state.items.map((item) => item.id === id ? { ...item, ...changes } : item) });
}

export async function refreshDemoGenerator() {
  try {
    const response = await fetch("/api/demos/generator", { cache: "no-store" });
    const data = await response.json();
    set({ ...state, connection: response.ok ? data as DemoGenerationStatus : { available: false, connected: false, imageGeneration: false, message: data.error || "Gerador local indisponível." } });
  } catch { set({ ...state, connection: { available: false, connected: false, imageGeneration: false, message: "Não foi possível conectar ao gerador local." } }); }
}

function historyReferences(): CreativeReference[] {
  return getDb().leads.flatMap((lead) => {
    if (!lead.demo) return [];
    const content = demoCreativeContent(lead.demo);
    const imageDescription = lead.demo.creation?.image.alt ?? (lead.demo.conceptId ? approvedConcepts[lead.demo.conceptId].media.alt : demoDesigns[lead.demo.business.segment].alt);
    return [{ segment: lead.demo.business.segment, signature: lead.demo.creation ? creationSignature(lead.demo.creation) : `v${lead.demo.version}:${lead.demo.design?.layout ?? lead.demo.conceptId ?? "original"}`, photoOrigin: content.photoOrigin, imageDescription,
      texts: content.texts.map((text) => withoutBusinessFields(text, lead.demo!.business)), message: withoutBusinessFields(content.message, lead.demo.business) }];
  });
}

async function run(item: DemoQueueItem) {
  const lead = getDb().leads.find((lead) => lead.id === item.leadId);
  if (!lead) throw new Error("O lead foi removido da fila.");
  let job: DemoGenerationJob;
  if (item.status === "running") {
    const response = await fetch(`/api/demos/jobs/${item.id}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Geração interrompida. Tente novamente.");
    job = data.job;
  } else {
    const business = item.expectedBusiness ? demoBusinessSchema.parse(JSON.parse(item.expectedBusiness)) : lead.demo?.business ?? demoBusinessSchema.parse(lead);
    const publicContext = demoBusinessSchema.omit({ phone: true }).parse(business);
    const history = historyReferences();
    if (history.length > 500) throw new Error("O histórico ultrapassa 500 demos. A comparação completa precisa ser ampliada antes desta geração.");
    if (!item.expectedBusiness) {
      item = { ...item, expectedRevision: demoRevision(lead.demo), expectedBusiness: JSON.stringify(business) };
      update(item.id, { expectedRevision: item.expectedRevision, expectedBusiness: item.expectedBusiness });
    }
    const response = await fetch("/api/demos/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: item.id, business: publicContext, history, textProvider: item.textProvider ?? "claude", imageProvider: item.imageProvider ?? "gemini" }) });
    if (response.status === 429) { await delay(3000); return false; }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Não foi possível iniciar a geração.");
    job = data.job;
    update(item.id, { status: "running", expectedRevision: item.expectedRevision, expectedBusiness: item.expectedBusiness, phase: job.phase });
  }
  let failures = 0;
  while (job.status === "running") {
    update(item.id, { phase: job.phase });
    await delay(1500);
    try {
      const response = await fetch(`/api/demos/jobs/${item.id}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Conexão interrompida.");
      job = (await response.json()).job;
      failures = 0;
    } catch {
      failures += 1;
      if (failures >= 10) throw new Error("Conexão interrompida durante a geração. Reabra o app para retomar a consulta.");
    }
  }
  if (job.status !== "completed" || !job.result) throw new Error(job.error || "A geração não foi concluída.");
  const latest = getDb().leads.find((lead) => lead.id === item.leadId);
  if (!latest || JSON.stringify(latest.demo?.business ?? demoBusinessSchema.parse(latest)) !== item.expectedBusiness) throw new Error("Os dados do negócio mudaram durante a geração. Gere novamente com o cadastro atual.");
  applyGeneratedLeadDemo(item.leadId, job.result, item.expectedRevision);
  update(item.id, { status: "completed", phase: "Demo pronta para revisão", error: null });
  return true;
}

async function pump() {
  if (pumping) return;
  pumping = true;
  try {
    let item = state.items.find((item) => item.status === "queued" || item.status === "running");
    while (item) {
      try { await run(item); }
      catch (error) {
        update(item.id, { status: "failed", phase: "Geração pendente", error: error instanceof Error ? error.message : "Falha na geração." });
      }
      item = state.items.find((item) => item.status === "queued" || item.status === "running");
    }
  } finally { pumping = false; }
}

export function enqueueDemoGeneration(leadIds: string[]) {
  initialize();
  const ids = [...new Set(leadIds)];
  const pending = state.items.filter((item) => !ids.includes(item.leadId) || item.status === "queued" || item.status === "running");
  const active = new Set(pending.filter((item) => item.status === "queued" || item.status === "running").map((item) => item.leadId));
  const additions: DemoQueueItem[] = ids.filter((id) => !active.has(id)).map((leadId) => {
    const paused = state.items.find((item) => item.leadId === leadId && item.status === "paused");
    return paused ? { ...paused, status: paused.resumeStatus ?? "queued", phase: "Retomando geração solicitada", error: null }
      : { leadId, id: crypto.randomUUID(), status: "queued", phase: "Na fila de geração", error: null, expectedRevision: null, textProvider: state.textProvider, imageProvider: state.imageProvider };
  });
  set({ ...state, items: [...pending, ...additions] });
  void pump();
}

function initialize() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  // Lida antes de qualquer set(), que regrava a preferência.
  try {
    const provider = demoTextProviderSchema.safeParse(window.localStorage.getItem(providerKey));
    if (provider.success) state = { ...state, textProvider: provider.data };
    const image = demoImageProviderSchema.safeParse(window.localStorage.getItem(imageProviderKey));
    if (image.success) state = { ...state, imageProvider: image.data };
  } catch { /* default provider */ }
  try {
    const parsed = z.array(queueItemSchema).safeParse(JSON.parse(window.localStorage.getItem(storageKey) || "[]"));
    if (parsed.success) set({ ...state, items: parsed.data.map((item) => item.status === "queued" || item.status === "running"
      ? { ...item, status: "paused", resumeStatus: item.status, phase: "Aguardando solicitação do administrador" } : item) });
  } catch { /* start with an empty generator queue */ }
  void refreshDemoGenerator();
}

export function useDemoGenerator() {
  const snapshot = useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener); }, () => state, () => initialState);
  useEffect(initialize, []);
  return snapshot;
}
