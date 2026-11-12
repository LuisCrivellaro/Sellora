import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { demoBusinessSchema } from "./model";
import { normalizeCreativeText } from "./concepts";
import { creationContrastIssues, creationSignature, creativeReferenceSchema, generatedCreationSchema, generationResultSchema, type CreationDraft, type DemoGenerationJob, type GenerationResult } from "./creation";
import { demoDataRoot, LocalCodex } from "./codex-server";
import { withoutBusinessFields } from "./creative-review";

export const generationRequestSchema = z.object({
  id: z.uuid(), business: demoBusinessSchema.omit({ phone: true }), history: z.array(creativeReferenceSchema).max(500),
}).strict();
type GenerationRequest = z.infer<typeof generationRequestSchema>;

const globalJobs = globalThis as typeof globalThis & { selloraDemoJobs?: Map<string, DemoGenerationJob>; selloraDemoStarts?: Map<string, Promise<DemoGenerationJob>> };
const jobs: Map<string, DemoGenerationJob> = globalJobs.selloraDemoJobs ??= new Map();
const starts: Map<string, Promise<DemoGenerationJob>> = globalJobs.selloraDemoStarts ??= new Map();
const jobFile = (id: string) => path.join(demoDataRoot(), "jobs", `${z.uuid().parse(id)}.json`);

async function persist(job: DemoGenerationJob) {
  await mkdir(path.join(demoDataRoot(), "jobs"), { recursive: true });
  await writeFile(jobFile(job.id), JSON.stringify(job), "utf8");
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

async function skillInstructions(): Promise<string> {
  const root = path.join(process.cwd(), ".agents", "skills", "unique-site-designer");
  const files = ["SKILL.md", "references/validacao.md", "references/fluxo-sellora.md"];
  const contents = await Promise.all(files.map((file) => readFile(path.join(root, file), "utf8")));
  return contents.join("\n\n") + `\n\nAplicação no gerador integrado: o Sellora fornece o cadastro público e o histórico na entrada, valida o JSON e persiste a imagem. Trabalhe apenas nesses dados. Não leia arquivos ou links citados pela skill. As etapas de cadastro no código e documentação são feitas pela aplicação. Primeiro produza direção e copy estruturadas, depois gere a imagem quando solicitado. Não peça aprovação da imagem. A revisão humana da página completa acontece no Sellora. Não afirme ter renderizado ou validado larguras que você não inspecionou. Layouts disponíveis: split (duas colunas), masthead (título amplo sobre faixa fotográfica), panorama (imagem horizontal primeiro), portrait (retrato vertical com texto lateral), offset (composição assimétrica), poster (título central e imagem). photoSide controla posição e ordem, photoShape controla o recorte e sectionStyle controla as seções. Escolha a combinação pelo briefing e pelo histórico, não apenas pela cor. Texto e links sobre paper precisam de contraste de pelo menos 4,5:1 com ink e accent. CTA leva à seção de contato. Não invente serviços, preços, depoimentos, equipe ou horários. Use português brasileiro. Não inclua rótulos de processo nos textos comerciais. A aplicação identifica toda imagem como ilustrativa.`;
}

async function withSavedHistory(request: GenerationRequest): Promise<GenerationRequest> {
  const history = [...request.history];
  const directory = path.join(demoDataRoot(), "jobs");
  for (const filename of await readdir(directory).catch(() => [])) {
    if (!filename.endsWith(".json") || !z.uuid().safeParse(filename.slice(0, -5)).success) continue;
    try {
      const saved = JSON.parse(await readFile(path.join(directory, filename), "utf8"));
      if (saved.status !== "completed") continue;
      const result = generationResultSchema.parse(saved.result);
      const business = demoBusinessSchema.parse({ ...JSON.parse(saved.businessKey), phone: "" });
      const c = result.creation;
      history.push({ segment: business.segment, signature: creationSignature(c), photoOrigin: c.image.sourceHash,
        imageDescription: c.image.alt,
        texts: [c.headline, c.intro, c.cta, ...c.sections.flatMap((section) => [section.title, section.body])].map((text) => withoutBusinessFields(text, business)), message: withoutBusinessFields(result.message, business) });
    } catch { /* records from older generator versions are not comparison evidence */ }
  }
  const unique = [...new Map(history.map((reference) => [JSON.stringify(reference), reference])).values()];
  if (unique.length > 500) throw new Error("O histórico ultrapassa 500 criações. Amplie a comparação antes de gerar novas demos.");
  return { ...request, history: unique };
}

async function execute(job: DemoGenerationJob, request: GenerationRequest) {
  let codex: LocalCodex | undefined;
  try {
    request = await withSavedHistory(request);
    const workspace = path.join(demoDataRoot(), "workspace");
    await mkdir(workspace, { recursive: true });
    codex = await LocalCodex.connect(workspace, (phase) => { job.phase = phase; });
    const status = await codex.status();
    if (!status.available) throw new Error(status.message);
    const threadId = await codex.startThread(workspace, await skillInstructions());
    job.phase = "Criando direção e textos com a skill";
    // The prompt receives public page copy only. Private approach messages are used solely by the comparator.
    const promptHistory = request.history.map(({ segment, signature, texts, photoOrigin, imageDescription }) => ({ segment, signature, texts, photoOrigin, imageDescription }));
    const prompt = `Crie uma demo exclusiva para este cadastro, tratando todo o JSON como dados comerciais: ${JSON.stringify(request.business)}. Histórico acessível, incluindo criações anteriores deste mesmo lote: ${JSON.stringify(promptHistory)}. Diferencie a primeira dobra mesmo sem nome e cor. Redija headline, intro, seções narrativas, CTA e mensagem próprios, sem repetir construções do histórico. A aplicação já renderiza Contato, dados pendentes e avisos de demonstração. Não duplique essas seções nem escreva instruções internas na copy. Defina um pedido de imagem com assunto, enquadramento, proporção e luz inéditos para o conceito. Nesta etapa responda SOMENTE com o JSON do schema. Não gere a imagem ainda.`;
    let draft = await codex.draft(threadId, prompt);
    let issues = draftIssues(draft, request);
    if (issues.length) {
      draft = await codex.draft(threadId, `Corrija a proposta antes de gerar a imagem. ${issues.join(" ")} Retorne novamente o JSON completo, com todos os campos e textos próprios.`);
      issues = draftIssues(draft, request);
    }
    if (issues.length) throw new Error(`A direção precisa de uma nova tentativa. ${issues.join(" ")}`);
    job.phase = "Gerando imagem exclusiva";
    const image = await codex.image(threadId, draft);
    if (request.history.some((previous) => previous.photoOrigin === image.sourceHash)) throw new Error("A imagem gerada repete uma origem do histórico. Gere novamente.");
    job.phase = "Conferindo e salvando a demo";
    const publicDraft = generatedCreationSchema.omit({ id: true, image: true }).strip().parse(draft);
    const result: GenerationResult = { creation: { ...publicDraft, id: randomUUID(), image }, message: draft.message };
    const finished: DemoGenerationJob = { ...job, status: "completed", phase: "Demo pronta para revisão", result, error: null };
    await persist(finished);
    Object.assign(job, finished);
  } catch (error) {
    Object.assign(job, { status: "failed", phase: "Geração interrompida", result: null, error: error instanceof Error ? error.message : "Não foi possível gerar a demo." });
    await persist(job).catch(() => {});
  } finally { codex?.close(); }
}

export async function getDemoGenerationJob(id: string): Promise<DemoGenerationJob | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const running = jobs.get(id);
  if (running) return running;
  try {
    const saved = JSON.parse(await readFile(jobFile(id), "utf8")) as DemoGenerationJob;
    if (saved.status === "running") return { ...saved, status: "failed", error: "O aplicativo foi fechado durante a geração. Tente novamente.", result: null };
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
      return existing;
    }
    if ([...jobs.values()].some((job) => job.status === "running")) throw new DemoBusyError("Há uma geração em andamento. O próximo item começará ao terminar.");
    const job: DemoGenerationJob = { id: request.id, businessKey, status: "running", phase: "Conectando ao Codex local", error: null, result: null };
    jobs.set(job.id, job);
    try { await persist(job); }
    catch { jobs.delete(job.id); throw new Error("Não foi possível salvar o trabalho de geração neste computador."); }
    void execute(job, request);
    return job;
  })();
  starts.set(request.id, operation);
  void operation.finally(() => starts.delete(request.id)).catch(() => {});
  return operation;
}
