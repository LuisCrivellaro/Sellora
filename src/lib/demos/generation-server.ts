import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { demoBusinessSchema } from "./model";
import { normalizeCreativeText } from "./concepts";
import { creationContrastIssues, creationSignature, creativeReferenceSchema, demoTextProviderSchema, generatedCreationSchema, generationResultSchema, type CreationDraft, type DemoGenerationJob, type DemoImageProvider, type GenerationResult } from "./creation";
import { demoDataRoot, LocalCodex } from "./codex-server";
import { ClaudeWriter } from "./claude-server";
import { generateV6, V6GenerationError } from "./v6/generator";
import { withoutBusinessFields } from "./creative-review";
import { correctionPrompt, draftPrompt, skillInstructions } from "./generation-prompts";

export const generationRequestSchema = z.object({
  id: z.uuid(), business: demoBusinessSchema.omit({ phone: true }), history: z.array(creativeReferenceSchema).max(500),
  textProvider: demoTextProviderSchema.default("claude"),
  /** Sempre Codex (Gemini removido em 2026-11-12). Um pedido antigo com "gemini" é tratado como Codex, nunca como API paga. */
  imageProvider: z.enum(["codex", "gemini"]).default("codex").transform((): DemoImageProvider => "codex"),
  generator: z.enum(["v5", "v6"]).default("v6"),
  /** Só para os marcadores de contato do site V6. Nunca entra em prompt de modelo. */
  phone: z.string().max(80).default(""),
  /** Id do lead no CRM, para a observabilidade (Cloud 3D) abrir o registro certo. Não vai ao modelo. */
  leadId: z.string().max(100).optional(),
}).strict();
type GenerationRequest = z.infer<typeof generationRequestSchema>;

const globalJobs = globalThis as typeof globalThis & { selloraDemoJobs?: Map<string, DemoGenerationJob>; selloraDemoStarts?: Map<string, Promise<DemoGenerationJob>> };
const jobs: Map<string, DemoGenerationJob> = globalJobs.selloraDemoJobs ??= new Map();
const starts: Map<string, Promise<DemoGenerationJob>> = globalJobs.selloraDemoStarts ??= new Map();
interface GenerationControl {
  requested: boolean;
  cancelled?: boolean;
  paused: Promise<void>;
  notifyPaused: () => void;
  resume?: () => void;
}
const controls = new Map<string, GenerationControl>();
const requestFile = (id: string) => path.join(demoDataRoot(), "requests", `${z.uuid().parse(id)}.json`);
const writes = new Map<string, Promise<void>>();
class DemoCancelledError extends Error {}

function launchExecution(job: DemoGenerationJob, request: GenerationRequest) {
  const control: GenerationControl = { requested: false, paused: Promise.resolve(), notifyPaused: () => {} };
  control.paused = new Promise<void>((resolve) => { control.notifyPaused = resolve; });
  controls.set(job.id, control);
  void execute(job, request).finally(() => { control.notifyPaused(); controls.delete(job.id); });
}

async function checkpoint(job: DemoGenerationJob) {
  const control = controls.get(job.id);
  if (!control?.requested) return;
  job.status = "paused";
  phase(job, "Geração pausada");
  await persist(job);
  const resumed = new Promise<void>((resolve) => { control.resume = resolve; });
  control.notifyPaused();
  await resumed;
  if (control.cancelled) throw new DemoCancelledError("Geração cancelada pelo administrador.");
  job.status = "running";
  phase(job, "Retomando geração");
}

export async function pauseDemoGeneration(id: string): Promise<DemoGenerationJob | null> {
  if (starts.has(id)) await starts.get(id);
  const control = controls.get(id);
  if (control) {
    control.requested = true;
    await control.paused;
  }
  return getDemoGenerationJob(id);
}

export async function resumeDemoGeneration(id: string): Promise<DemoGenerationJob | null> {
  if ([...jobs.values()].some((job) => job.id !== id && job.status === "running")) throw new DemoBusyError("Há outra geração em andamento.");
  const control = controls.get(id);
  if (control?.resume) {
    control.requested = false;
    control.resume();
    control.resume = undefined;
    control.paused = new Promise<void>((resolve) => { control.notifyPaused = resolve; });
  }
  if (!control) {
    if (starts.has(id)) return starts.get(id)!;
    const operation = (async () => {
      const job = await getDemoGenerationJob(id);
      if (!job) throw new Error("Geração não encontrada.");
      if (job.status !== "paused") return job;
      if ([...jobs.values()].some((other) => other.id !== id && other.status === "running")) throw new DemoBusyError("Há outra geração em andamento.");
      const request = generationRequestSchema.parse(JSON.parse(await readFile(requestFile(id), "utf8")));
      job.status = "running";
      jobs.set(id, job);
      await persist(job);
      launchExecution(job, request);
      return job;
    })();
    // A retomada também é idempotente quando duas consultas chegam juntas.
    starts.set(id, operation);
    try { return await operation; } finally { starts.delete(id); }
  }
  return getDemoGenerationJob(id);
}

export async function cancelDemoGeneration(id: string): Promise<DemoGenerationJob | null> {
  const job = await pauseDemoGeneration(id);
  if (!job || job.status === "completed" || job.status === "failed" || job.status === "cancelled") return job;
  const control = controls.get(id);
  if (control) { control.cancelled = true; control.resume?.(); }
  Object.assign(job, { status: "cancelled", phase: "Geração cancelada", error: null, finishedAt: new Date().toISOString() });
  await persist(job);
  return job;
}
const jobFile = (id: string) => path.join(demoDataRoot(), "jobs", `${z.uuid().parse(id)}.json`);

function persist(job: DemoGenerationJob) {
  const data = JSON.stringify(job);
  const previous = writes.get(job.id) ?? Promise.resolve();
  const write = previous.catch(() => {}).then(async () => {
    await mkdir(path.join(demoDataRoot(), "jobs"), { recursive: true });
    await writeFile(jobFile(job.id), data, "utf8");
  });
  writes.set(job.id, write);
  return write;
}

export function draftIssues(draft: CreationDraft, request: GenerationRequest): string[] {
  const issues = creationContrastIssues(draft);
  const normalized = (text: string) => {
    let result = ` ${normalizeCreativeText(text)} `;
    for (const field of [request.business.name, request.business.city, request.business.uf]) result = result.split(` ${normalizeCreativeText(field)} `).join(" ");
    return result.trim().replace(/\s+/g, " ");
  };
  const texts = [draft.headline, draft.intro, draft.cta, ...draft.sections.flatMap((section) => [section.title, section.body])].map(normalized).filter((text) => text.length >= 20);
  for (const previous of request.history) {
    if (previous.segment === request.business.segment && previous.signature === creationSignature(draft)) issues.push("Escolha outra composição, tipografia, enquadramento ou estrutura de seções.");
    if (previous.texts.some((text) => texts.includes(text))) issues.push("Reescreva os textos criativos repetidos no histórico.");
    if (previous.message === normalized(draft.message)) issues.push("Crie uma abordagem com outra construção de mensagem.");
  }
  return [...new Set(issues)];
}

async function withSavedHistory(request: GenerationRequest): Promise<GenerationRequest> {
  const history = [...request.history];
  // Demos V6 entram da mais nova para a mais antiga: o gerador confere o hero das mais recentes de qualquer segmento.
  const sites: { at: string; reference: GenerationRequest["history"][number] }[] = [];
  const directory = path.join(demoDataRoot(), "jobs");
  for (const filename of await readdir(directory).catch(() => [])) {
    if (!filename.endsWith(".json") || !z.uuid().safeParse(filename.slice(0, -5)).success) continue;
    try {
      const saved = JSON.parse(await readFile(path.join(directory, filename), "utf8"));
      if (saved.status !== "completed") continue;
      const result = generationResultSchema.parse(saved.result);
      const business = demoBusinessSchema.parse({ ...JSON.parse(saved.businessKey), phone: "" });
      if (result.site) {
        const s = result.site.summary;
        sites.push({ at: String(saved.finishedAt ?? result.site.createdAt ?? ""), reference: { segment: business.segment, signature: s.signature, photoOrigin: result.site.images[0]?.sha256 ?? null, imageDescription: result.site.images[0]?.alt,
          texts: s.texts.slice(0, 20).map((text) => withoutBusinessFields(text, business)), message: withoutBusinessFields(result.message, business),
          style: { fonts: s.fonts, palette: s.palette, sections: s.sections, hero: s.hero, headline: withoutBusinessFields(s.headline, business).slice(0, 200), ...(s.identity ? { identity: s.identity } : {}) } } });
        continue;
      }
      const c = result.creation!;
      history.push({ segment: business.segment, signature: creationSignature(c), photoOrigin: c.image.sourceHash,
        imageDescription: c.image.alt,
        texts: [c.headline, c.intro, c.cta, ...c.sections.flatMap((section) => [section.title, section.body])].map((text) => withoutBusinessFields(text, business)), message: withoutBusinessFields(result.message, business) });
    } catch { /* records from older generator versions are not comparison evidence */ }
  }
  history.unshift(...sites.sort((a, b) => b.at.localeCompare(a.at)).map((item) => item.reference));
  const unique = [...new Map(history.map((reference) => [JSON.stringify(reference), reference])).values()];
  if (unique.length > 500) throw new Error("O histórico ultrapassa 500 criações. Amplie a comparação antes de gerar novas demos.");
  return { ...request, history: unique };
}

/** Registra a etapa atual com horário real (o painel e futuras integrações leem esta linha do tempo). */
function phase(job: DemoGenerationJob, text: string) {
  job.phase = text;
  job.events = [...(job.events ?? []), { at: new Date().toISOString(), phase: text }].slice(-40);
  void persist(job).catch(() => {});
}

async function executeV6(job: DemoGenerationJob, request: GenerationRequest) {
  try {
    request = await withSavedHistory(request);
    const history = request.history.filter((item) => item.style).map((item) => ({ segment: item.segment, ...item.style!, texts: item.texts }));
    // V6: Claude escreve texto, design e código; o Codex só gera imagens.
    const result = await generateV6(job.id, { business: request.business, phone: request.phone, history, textProvider: "claude", imageProvider: request.imageProvider }, { phase: (text) => phase(job, text), checkpoint: () => checkpoint(job) });
    job.textEstimatedUsd = result.estimatedUsd;
    const ready = result.site.qa.status === "needs_review" ? "Demo pronta, com pendências para revisão" : "Demo pronta para revisão";
    const finished: DemoGenerationJob = { ...job, status: "completed", recoverable: false, phase: ready, finishedAt: new Date().toISOString(), result: { site: result.site, message: result.message, textProvider: "claude", imageProvider: request.imageProvider }, error: null };
    finished.events = [...(job.events ?? []), { at: finished.finishedAt!, phase: finished.phase }];
    await persist(finished);
    Object.assign(job, finished);
  } catch (error) {
    const at = new Date().toISOString();
    const recoverable = error instanceof V6GenerationError && error.recoverable;
    const label = recoverable ? "Geração interrompida (etapas salvas para retomar)" : "Geração interrompida";
    Object.assign(job, { status: "failed", recoverable, phase: label, finishedAt: at, events: [...(job.events ?? []), { at, phase: label }], result: null, error: error instanceof Error ? error.message : "Não foi possível gerar a demo." });
    if (error instanceof DemoCancelledError) Object.assign(job, { status: "cancelled", recoverable: false, phase: "Geração cancelada", error: null });
    await persist(job).catch(() => {});
  }
}

async function execute(job: DemoGenerationJob, request: GenerationRequest) {
  if (request.generator === "v6") return executeV6(job, request);
  let codex: LocalCodex | undefined;
  try {
    request = await withSavedHistory(request);
    const workspace = path.join(demoDataRoot(), "workspace");
    await mkdir(workspace, { recursive: true });
    const instructions = await skillInstructions();
    let threadId = "";
    // v5: a imagem vem sempre do Codex; ele é conferido antes do texto para não gastar a cota do Claude à toa.
    {
      job.phase = "Conectando ao Codex local";
      codex = await LocalCodex.connect(workspace, (phase) => { job.phase = phase; });
      const status = await codex.status();
      if (!status.available) throw new Error(status.message);
      threadId = await codex.startThread(workspace, instructions);
    }
    const activeCodex = codex;
    const claude = request.textProvider === "claude" ? await ClaudeWriter.create(workspace, instructions) : null;
    const write = (text: string, previous?: CreationDraft) => claude ? claude.draft(text, previous) : activeCodex!.draft(threadId, text);
    job.phase = claude ? "Criando direção e textos com o Claude" : "Criando direção e textos com a skill";
    // The prompt receives public page copy only. Private approach messages are used solely by the comparator.
    const promptHistory = request.history.map(({ segment, signature, texts, photoOrigin, imageDescription }) => ({ segment, signature, texts, photoOrigin, imageDescription }));
    let draft = await write(draftPrompt(request.business, promptHistory));
    await checkpoint(job);
    let issues = draftIssues(draft, request);
    if (issues.length) {
      draft = await write(correctionPrompt(issues), draft);
      await checkpoint(job);
      issues = draftIssues(draft, request);
    }
    if (claude) job.textEstimatedUsd = Math.round(claude.estimatedUsd * 10_000) / 10_000;
    if (issues.length) throw new Error(`A direção precisa de uma nova tentativa. ${issues.join(" ")}`);
    job.phase = "Gerando imagem exclusiva";
    const image = await activeCodex!.image(threadId, draft);
    await checkpoint(job);
    if (request.history.some((previous) => previous.photoOrigin === image.sourceHash)) throw new Error("A imagem gerada repete uma origem do histórico. Gere novamente.");
    job.phase = "Conferindo e salvando a demo";
    const publicDraft = generatedCreationSchema.omit({ id: true, image: true }).strip().parse(draft);
    const result: GenerationResult = { creation: { ...publicDraft, id: randomUUID(), image }, message: draft.message, textProvider: request.textProvider, imageProvider: request.imageProvider };
    const finished: DemoGenerationJob = { ...job, status: "completed", phase: "Demo pronta para revisão", result, error: null };
    await persist(finished);
    Object.assign(job, finished);
  } catch (error) {
    Object.assign(job, { status: "failed", phase: "Geração interrompida", result: null, error: error instanceof Error ? error.message : "Não foi possível gerar a demo." });
    if (error instanceof DemoCancelledError) Object.assign(job, { status: "cancelled", phase: "Geração cancelada", error: null });
    await persist(job).catch(() => {});
  } finally { codex?.close(); }
}

export async function getDemoGenerationJob(id: string): Promise<DemoGenerationJob | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const running = jobs.get(id);
  if (running) return running;
  try {
    const saved = JSON.parse(await readFile(jobFile(id), "utf8")) as DemoGenerationJob;
    if (saved.status === "running") return { ...saved, status: "paused", phase: "Geração pausada ao fechar o aplicativo", error: null, result: null };
    return saved;
  } catch { return null; }
}

export class DemoBusyError extends Error {}

export function startDemoGeneration(request: GenerationRequest): Promise<DemoGenerationJob> {
  const pending = starts.get(request.id);
  if (pending) return pending.then((job) => {
    if (job.businessKey !== JSON.stringify(request.business)) throw new Error("Este trabalho pertence a outro cadastro.");
    return job;
  });
  const operation = (async () => {
    const existing = await getDemoGenerationJob(request.id);
    const businessKey = JSON.stringify(request.business);
    if (existing) {
      if (existing.businessKey !== businessKey) throw new Error("Este trabalho pertence a outro cadastro.");
      // V6 com falha recuperável: o mesmo id retoma do checkpoint (briefing, imagem e código já salvos).
      if (existing.status === "failed" && existing.recoverable && existing.generator === "v6") {
        if ([...jobs.values()].some((job) => job.id !== existing.id && job.status === "running")) throw new DemoBusyError("Há uma geração em andamento. O próximo item começará ao terminar.");
        const saved = generationRequestSchema.parse(JSON.parse(await readFile(requestFile(existing.id), "utf8")));
        const retry: DemoGenerationJob = { ...existing, status: "running", recoverable: false, phase: "Retomando a partir das etapas salvas", error: null, finishedAt: undefined, events: [...(existing.events ?? []), { at: new Date().toISOString(), phase: "Retomando a partir das etapas salvas" }] };
        jobs.set(retry.id, retry);
        await persist(retry);
        launchExecution(retry, { ...saved, phone: request.phone || saved.phone });
        return retry;
      }
      return existing;
    }
    if ([...jobs.values()].some((job) => job.status === "running")) throw new DemoBusyError("Há uma geração em andamento. O próximo item começará ao terminar.");
    if (request.leadId && [...jobs.values()].some((job) => job.leadId === request.leadId && job.status === "paused")) throw new DemoBusyError("Este estabelecimento já tem uma geração pausada. Retome o trabalho existente.");
    const job: DemoGenerationJob = { id: request.id, businessKey, textProvider: request.generator === "v6" ? "claude" : request.textProvider, imageProvider: request.imageProvider, generator: request.generator, leadId: request.leadId, startedAt: new Date().toISOString(), events: [{ at: new Date().toISOString(), phase: "Preparando a geração" }], status: "running", phase: "Preparando a geração", error: null, result: null };
    jobs.set(job.id, job);
    try {
      await mkdir(path.join(demoDataRoot(), "requests"), { recursive: true });
      await writeFile(requestFile(job.id), JSON.stringify(request), "utf8");
      await persist(job);
    }
    catch { jobs.delete(job.id); throw new Error("Não foi possível salvar o trabalho de geração neste computador."); }
    launchExecution(job, request);
    return job;
  })();
  starts.set(request.id, operation);
  void operation.finally(() => starts.delete(request.id)).catch(() => {});
  return operation;
}
