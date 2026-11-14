import { randomUUID } from "node:crypto";
import { mkdir, rm, readFile, writeFile, rename } from "node:fs/promises";
import { serialize, deserialize } from "node:v8";
import path from "node:path";
import type { z } from "zod";
import { ClaudeWriter, type ClaudeEffort, type ClaudeImage } from "../claude-server";
import { demoDataRoot, LocalCodex } from "../codex-server";
import { normalizeCreativeText } from "../concepts";
import type { DemoImageProvider, DemoTextProvider } from "../creation";
import { fallbackArtwork, nominalSize, optimizeForWeb, type ImageEngine, type SiteAsset } from "./images";
import { heroArchetype as inferHeroArchetype, identityFromBrief, originalityReport, type OriginalityReport } from "./identity";
import { postprocessSite, type ProcessedSite } from "./postprocess";
import { normalizeWhatsappPhone } from "../whatsapp";
import { briefPrompt, codePrompt, correctBriefPrompt, fixPrompt, imagePrompt, loadV6Guide, segmentProfile, v6SystemPrompt, visualFixPrompt, visualReviewPrompt, type V6Business, type V6Guide, type V6HistoryItem } from "./prompts";
import { browserQa, QA_VIEWPORTS } from "./qa-browser";
import { contrast, headlineOf, INVENTED_FACTS, STOCK_PHRASES, staticQa, visibleText } from "./qa-static";
import { HERO_ARCHETYPES, normalizeCode, siteBriefSchema, siteBriefSchemaFor, siteCodeSchema, siteRefSchema, siteSignature, type SiteBrief, type SiteCode, type SiteRef, type VisualQa } from "./schema";
import { sha256, writeSite } from "./store";
import { briefForReview, reviewImages, reviewProblems, reviewSummary, visualReviewRounds, visualReviewSchema, VISUAL_TARGET, weightedScore, type VisualReview } from "./visual-review";

/**
 * Limites de consumo por demo. Cada tentativa (primeira execução ou "Tentar novamente") tem no máximo
 * 1 briefing + 2 revisões de briefing + 1 código + 2 correções = 6 chamadas ao Claude, até 3 imagens do Codex
 * e, à parte, a revisão de impacto visual (1 avaliação + até 2 rodadas de correção e reavaliação = 5 chamadas).
 */
export const V6_LIMITS = { generatedImages: 3, maxImages: 3, briefCorrections: 2, fixRounds: 2, attempts: 3, claudeCallsPerAttempt: 6 } as const;

/** Imagens por demo: até 3 por padrão (o briefing usa menos quando o design pede); SELLORA_DEMO_MAX_IMAGES (1 a 3) reduz. */
export function imageLimit(env: Record<string, string | undefined> = process.env): number {
  const value = Number(env.SELLORA_DEMO_MAX_IMAGES);
  return Number.isInteger(value) && value >= 1 && value <= V6_LIMITS.maxImages ? value : V6_LIMITS.generatedImages;
}

export interface V6Request {
  business: V6Business;
  phone: string;
  history: V6HistoryItem[];
  /** Mantido por compatibilidade: no V6, textos, design e código são sempre do Claude. */
  textProvider?: DemoTextProvider;
  imageProvider: DemoImageProvider;
}
export interface V6Progress { phase: (text: string) => void; checkpoint?: () => Promise<void> }
export interface V6Result { site: SiteRef; message: string; estimatedUsd: number | null; imageEngine: ImageEngine }

/** Erro com as etapas salvas: o trabalho pode ser retomado sem refazer o que já foi concluído. */
export class V6GenerationError extends Error {
  constructor(message: string, readonly recoverable: boolean) { super(message); }
}

interface Writer {
  structured<T>(prompt: string, schema: z.ZodType<T>, effort: ClaudeEffort): Promise<T>;
  /** Chamadas da revisão de impacto visual: orçamento e custo contados à parte. */
  visual<T>(prompt: string, images: ClaudeImage[], schema: z.ZodType<T>, effort: ClaudeEffort): Promise<T>;
  visualCode<T>(prompt: string, schema: z.ZodType<T>, effort: ClaudeEffort): Promise<T>;
  estimatedUsd: number;
  visualUsd: number;
}

/** Claude é o único autor de texto, design e código do V6. O Codex fica só com as imagens. */
async function openWriter(workspace: string, instructions: string, budget: { calls: number; visualCalls: number; visualLimit: number }): Promise<Writer> {
  const claude = await ClaudeWriter.forDemos(workspace, instructions, "v6-system-prompt.md");
  let visualUsd = 0;
  const visualBudget = () => {
    if (budget.visualCalls >= budget.visualLimit) throw new Error("Limite de chamadas da revisão visual atingido.");
    budget.visualCalls += 1;
  };
  const measured = async <T>(call: () => Promise<T>) => {
    const before = claude.estimatedUsd;
    try { return await call(); } finally { visualUsd += claude.estimatedUsd - before; }
  };
  return {
    structured: (prompt, schema, effort) => {
      if (budget.calls >= V6_LIMITS.claudeCallsPerAttempt) throw new V6GenerationError("Limite de chamadas ao Claude desta tentativa atingido; as etapas concluídas ficam salvas.", true);
      budget.calls += 1;
      return claude.structured(prompt, schema, effort);
    },
    visual: (prompt, images, schema, effort) => { visualBudget(); return measured(() => claude.structuredWithImages(prompt, images, schema, effort)); },
    visualCode: (prompt, schema, effort) => { visualBudget(); return measured(() => claude.structured(prompt, schema, effort)); },
    get estimatedUsd() { return Math.round(claude.estimatedUsd * 10_000) / 10_000; },
    get visualUsd() { return Math.round(visualUsd * 10_000) / 10_000; },
  };
}

/**
 * Imagens só pelo Codex da conta ChatGPT do computador (sem API paga). Sem Codex com geração de imagem
 * disponível, cada imagem vira a composição gráfica gratuita (SVG) e o motivo fica registrado.
 */
async function resolveImageEngine(workspace: string): Promise<{ engine: ImageEngine; codex?: LocalCodex; thread?: string; note?: string }> {
  try {
    const codex = await LocalCodex.connect(workspace, () => {}, 20 * 60_000);
    const status = await codex.status();
    if (status.available) return { engine: "codex", codex, thread: await codex.startThread(workspace, "Você gera imagens ilustrativas para sites de demonstração a partir de especificações fotográficas. Use somente a ferramenta nativa de geração de imagens. Não escreva textos, código ou estrutura de página.") };
    codex.close();
    return { engine: "fallback", note: status.message };
  } catch (error) {
    return { engine: "fallback", note: error instanceof Error ? error.message : "Codex indisponível." };
  }
}

export { HERO_ARCHETYPES };
/** Arquétipo do hero (id explícito, marcado entre colchetes ou inferido em briefs antigos). */
export const heroArchetype = inferHeroArchetype;

/** O hero não pode repetir o arquétipo das duas demos mais recentes, de qualquer segmento (histórico do mais novo ao mais antigo). */
export function recentHeroIssue(heroComposition: string, history: Pick<V6HistoryItem, "hero">[]): string | null {
  const current = heroArchetype(heroComposition);
  if (!current) return `Comece heroComposition com um arquétipo do guia entre colchetes (${HERO_ARCHETYPES.map((id) => `[${id}]`).join(", ")}).`;
  const recent = history.slice(0, 2).map((item) => heroArchetype(item.hero));
  return recent.includes(current) ? `O hero repete o arquétipo [${current}] de uma das duas demos mais recentes; escolha outro arquétipo do guia.` : null;
}

/** Texto sem nome, cidade e UF do negócio (para comparar construção, não dados do cadastro). */
const withoutFields = (text: string, business: { name: string; city: string; uf: string }) => [business.name, business.city, business.uf].reduce((t, field) => (field ? t.split(field).join(" ") : t), text);

const BANNED_DISPLAY = ["inter", "roboto", "open sans", "montserrat", "poppins", "lato", "arial", "helvetica", "system-ui"];
const SERIOUS_PROFILES = ["saude", "profissional"];

/**
 * Ajustes determinísticos do briefing (sem chamada ao modelo): referências de imagem, páginas e limite de imagens.
 * A imagem usada pelo hero vai para a primeira posição (é a que recebe tamanho de hero e fetchpriority).
 */
export function normalizeBrief(brief: SiteBrief, maxImages: number): SiteBrief {
  const heroImage = brief.sections[0]?.imageId;
  const ordered = heroImage ? [...brief.images].sort((a, b) => Number(b.id === heroImage) - Number(a.id === heroImage)) : brief.images;
  const images = ordered.slice(0, maxImages);
  const ids = new Set(images.map((image) => image.id));
  const fix = (sections: SiteBrief["sections"]) => sections.map((section) => ({ ...section, imageId: section.imageId && ids.has(section.imageId) ? section.imageId : null }));
  const secondary = brief.pages.count === 2 && brief.pages.secondary ? { ...brief.pages.secondary, sections: fix(brief.pages.secondary.sections) } : null;
  return { ...brief, images, sections: fix(brief.sections), pages: { ...brief.pages, count: secondary ? 2 : 1, secondary } };
}

/** Problemas de estrutura, verdade e contraste que já dá para pegar no briefing, antes de gastar a chamada do código. */
export function briefIssues(brief: SiteBrief, business: V6Business, contact: { hasPhone: boolean }): string[] {
  const issues: string[] = [];
  if (brief.sections[0]?.function !== "hero") issues.push("A primeira seção do início precisa ter function \"hero\".");
  const ids = brief.sections.map((section) => section.id);
  if (new Set(ids).size !== ids.length) issues.push("Há ids de seção repetidos no início.");
  if (brief.pages.secondary && new Set(brief.pages.secondary.sections.map((s) => s.id)).size !== brief.pages.secondary.sections.length) issues.push("Há ids de seção repetidos na segunda página.");
  if (BANNED_DISPLAY.includes(brief.direction.displayFont.trim().toLowerCase())) issues.push(`A fonte de destaque ${brief.direction.displayFont} é genérica demais para a voz principal; escolha uma família com caráter adequado ao negócio.`);
  const p = brief.direction.palette;
  if (contrast(p.background, p.ink) < 4.5) issues.push("Paleta: contraste entre fundo e texto abaixo de 4,5:1.");
  if (contrast(p.surface, p.ink) < 4.5) issues.push("Paleta: contraste entre superfície e texto abaixo de 4,5:1.");
  if (contrast(p.background, p.muted) < 4.5) issues.push("Paleta: texto secundário com contraste abaixo de 4,5:1 sobre o fundo.");
  if (contrast(p.accent, p.accentInk) < 4.5) issues.push("Paleta: texto sobre a cor de destaque abaixo de 4,5:1.");
  if (brief.direction.motion === "expressiva" && SERIOUS_PROFILES.includes(segmentProfile(business))) issues.push("Movimento \"expressiva\" não combina com este tipo de serviço; use \"moderada\" (revelações suaves ao rolar, entrada coreografada do hero, microinterações).");
  issues.push(...imageSetIssues(brief));
  const copy = [brief.copy.headline, brief.copy.subheadline, brief.copy.primaryCta, brief.copy.secondaryCta ?? "", brief.message].join(" ");
  const cleaned = [business.name, business.city].reduce((text, field) => text.split(field).join(" "), copy);
  const normalized = ` ${normalizeCreativeText(cleaned)} `;
  for (const phrase of STOCK_PHRASES) if (new RegExp(`(^| )${phrase}( |$)`).test(normalized)) issues.push(`Texto planejado usa expressão genérica: "${phrase}".`);
  for (const { pattern, label } of INVENTED_FACTS) if (pattern.test(cleaned)) issues.push(`Texto planejado afirma ${label} que não está no cadastro.`);
  if (!contact.hasPhone && /whats|ligar|ligue|telefone/i.test(`${brief.copy.primaryCta} ${brief.copy.secondaryCta ?? ""} ${brief.direction.primaryAction}`)) issues.push("Não há telefone válido: a ação principal não pode ser WhatsApp ou ligação; use Ver como chegar.");
  if (!/demonstra/i.test(brief.message)) issues.push("A mensagem ao dono precisa dizer que é uma demonstração não oficial.");
  return [...new Set(issues)];
}

const words = (text: string) => new Set(normalizeCreativeText(text).split(" ").filter((word) => word.length > 3));
const overlapRatio = (a: Set<string>, b: Set<string>) => (a.size && b.size ? [...a].filter((word) => b.has(word)).length / Math.min(a.size, b.size) : 0);

/**
 * Conjunto de imagens: cada uma precisa ser usada por uma seção e ter função própria. Duas imagens com o mesmo papel,
 * ou com a mesma proporção e quase o mesmo assunto e enquadramento, seriam três fotos iguais gastando cota do Codex.
 */
export function imageSetIssues(brief: SiteBrief): string[] {
  const issues: string[] = [];
  const used = new Set([...brief.sections, ...(brief.pages.secondary?.sections ?? [])].map((section) => section.imageId).filter(Boolean));
  const ids = brief.images.map((image) => image.id);
  if (new Set(ids).size !== ids.length) issues.push("Há ids de imagem repetidos.");
  for (const image of brief.images) if (!used.has(image.id)) issues.push(`A imagem "${image.id}" foi planejada, mas nenhuma seção a usa (imageId); use-a numa seção ou retire-a do conjunto.`);
  for (let i = 0; i < brief.images.length; i += 1) for (let j = i + 1; j < brief.images.length; j += 1) {
    const a = brief.images[i], b = brief.images[j];
    const sameRole = normalizeCreativeText(a.role) === normalizeCreativeText(b.role);
    const sameScene = a.aspect === b.aspect && overlapRatio(words(`${a.subject} ${a.framing}`), words(`${b.subject} ${b.framing}`)) >= 0.6;
    if (sameRole || sameScene) issues.push(`As imagens "${a.id}" e "${b.id}" repetem ${sameRole ? "o mesmo papel" : "proporção, assunto e enquadramento"}; dê a cada uma uma função visual diferente (ex.: ambiente amplo × pessoas em atendimento × detalhe do ofício).`);
  }
  return issues;
}

export function summarize(html: string, brief: SiteBrief, business?: { name: string; city: string; uf: string }): SiteRef["summary"] {
  const chunks = [...html.matchAll(/<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => visibleText(m[2])).filter((t) => t.length >= 12 && !t.startsWith("Demonstração não oficial criada pela Sellora"));
  const p = brief.direction.palette;
  const headline = (headlineOf(html) || brief.copy?.headline || brief.direction.concept).slice(0, 200);
  const strip = (text: string) => business ? [business.name, business.city, business.uf].reduce((t, field) => t.split(field).join(" "), text) : text;
  const hero = brief.direction.heroArchetype ? `[${brief.direction.heroArchetype}] ${brief.direction.heroComposition}` : brief.direction.heroComposition;
  return {
    headline,
    texts: chunks.slice(0, 24).map((t) => t.slice(0, 600)),
    fonts: [brief.direction.displayFont, brief.direction.bodyFont],
    palette: [p.background, p.surface, p.ink, p.muted, p.accent, p.accentInk],
    sections: brief.sections.map((section) => section.id),
    hero: hero.slice(0, 200),
    signature: siteSignature(brief).slice(0, 300),
    ...(brief.copy ? { identity: identityFromBrief(brief, strip(headline)), pages: brief.pages?.secondary ? ["index.html", brief.pages.secondary.file] : ["index.html"] } : {}),
  };
}

type Assets = SiteAsset[];
type Audit = Awaited<ReturnType<typeof audit>>;
interface RoundLog { round: number; at: string; critical: number; fixable: number; warnings: number; accepted: boolean; note?: string }
interface SavedProgress {
  /** failures: tentativas que terminaram em erro (pausar e retomar não contam). */
  version: 2; failures: number; lastFailed?: boolean;
  brief?: SiteBrief; briefRounds?: number; briefDone?: boolean; briefIssuesLeft?: string[]; originality?: OriginalityReport;
  code?: SiteCode; assets?: Assets; checked?: Audit; rounds: number; resolved?: number; log?: RoundLog[];
  calls: number; durations: Record<string, number>; estimatedUsd?: number;
  /** Revisão de impacto visual concluída (a retomada não repete a avaliação). */
  visual?: VisualQa; visualCalls?: number; visualUsd?: number;
}

/** Defeitos bloqueantes pesam mais que os demais corrigíveis: uma correção que troca um deles por outro corrigível não "melhora". */
const score = (checked: Pick<Audit, "critical" | "fixable" | "warnings"> & { blocking?: string[] }) => checked.critical.length * 100 + (checked.blocking?.length ?? 0) * 30 + checked.fixable.length * 10 + checked.warnings.length;
const sectionIds = (site: ProcessedSite) => new Set(site.pages.flatMap((page) => [...page.html.matchAll(/<section\b[^>]*\bid=["']([^"']+)["']/gi)].map((m) => `${page.file}#${m[1]}`)));
const fontFamilies = (site: ProcessedSite) => [...site.pages[0].html.matchAll(/family=([^:&"']+)/g)].map((m) => decodeURIComponent(m[1]).replace(/\+/g, " ").toLowerCase()).sort().join(",");

/** Uma correção que troca o título, remove seções, troca as fontes ou perde a segunda página destrói a direção aprovada. */
export function regressions(before: ProcessedSite, after: ProcessedSite): string[] {
  const issues: string[] = [];
  const words = (site: ProcessedSite) => new Set(normalizeCreativeText(headlineOf(site.html)).split(" ").filter((word) => word.length > 2));
  const a = words(before), b = words(after);
  const overlap = a.size ? [...a].filter((word) => b.has(word)).length / a.size : 1;
  if (overlap < 0.5) issues.push("a correção trocou o título principal");
  const removed = [...sectionIds(before)].filter((id) => !sectionIds(after).has(id));
  if (removed.length) issues.push(`a correção removeu seções (${removed.slice(0, 3).join(", ")})`);
  if (fontFamilies(before) && fontFamilies(before) !== fontFamilies(after)) issues.push("a correção trocou as fontes");
  if (after.pages.length < before.pages.length) issues.push("a correção removeu a segunda página");
  return issues;
}

/** Itens que só uma pessoa avalia: ficam sempre no relatório como revisão humana. */
const HUMAN_REVIEW = [
  "Revisão humana: a primeira tela comunica o negócio e tem hierarquia clara em computador e celular (ver capturas).",
  "Revisão humana: os textos soam naturais e específicos para o estabelecimento; fatos conferidos com o cadastro.",
  "Revisão humana: as imagens combinam com a direção de arte e não sugerem ser fotos reais do local, da equipe ou de clientes.",
];

export async function generateV6(jobId: string, request: V6Request, progress: V6Progress): Promise<V6Result> {
  const workspace = path.join(demoDataRoot(), "workspace", jobId);
  await mkdir(workspace, { recursive: true });
  const checkpointFile = path.join(workspace, "checkpoint.bin");
  const loaded = await readFile(checkpointFile).then((data) => deserialize(data) as Partial<SavedProgress> & { version?: number }).catch(() => null);
  const saved: SavedProgress = { version: 2, failures: 0, rounds: 0, calls: 0, durations: {}, ...(loaded?.version === 2 ? loaded : {}) };
  // Checkpoint de uma versão anterior do gerador: briefing e código só são reaproveitados se ainda forem válidos.
  if (loaded && loaded.version !== 2) {
    const brief = siteBriefSchema.safeParse(loaded.brief);
    if (brief.success) { saved.brief = brief.data; saved.briefDone = !!(loaded as { approved?: boolean }).approved; const code = normalizeCode(loaded.code); if (code) saved.code = code; }
  }
  if (saved.brief && !siteBriefSchema.safeParse(saved.brief).success) Object.assign(saved, { brief: undefined, briefDone: false, code: undefined, checked: undefined });
  // "Tentar novamente" depois de uma falha: nova rodada de correção sobre o código salvo, sem refazer briefing nem imagem.
  if (saved.lastFailed) { saved.rounds = 0; saved.checked = undefined; saved.lastFailed = false; }
  /** Ainda dá para retomar depois desta falha? (chamado no momento do erro, antes de registrar a falha). */
  const recoverable = () => saved.failures + 1 < V6_LIMITS.attempts;
  // Gravações em fila: código e imagem terminam em paralelo e cada um salva o seu resultado assim que fica pronto.
  let saving: Promise<void> = Promise.resolve();
  const save = () => {
    saving = saving.catch(() => {}).then(async () => {
      await writeFile(`${checkpointFile}.tmp`, serialize(saved));
      await rename(`${checkpointFile}.tmp`, checkpointFile);
    });
    return saving;
  };
  const timed = async <T>(stage: string, run: () => Promise<T>): Promise<T> => {
    const start = Date.now();
    try { return await run(); } finally { saved.durations[stage] = (saved.durations[stage] ?? 0) + (Date.now() - start); }
  };
  await save();

  let writer: Writer | undefined;
  let images: Awaited<ReturnType<typeof resolveImageEngine>> | undefined;
  const visualRounds = visualReviewRounds();
  const budget = { calls: 0, visualCalls: 0, visualLimit: visualRounds ? 1 + 2 * visualRounds : 0 };
  // Pausa e cancelamento lançam erros do servidor que precisam chegar intactos (o nome da classe some no build minificado).
  const passthrough = new WeakSet<object>();
  const checkpoint = async () => {
    images?.codex?.suspendTimeout();
    try { await progress.checkpoint?.(); }
    catch (error) { if (error && typeof error === "object") passthrough.add(error); throw error; }
    finally { images?.codex?.restartTimeout(); }
  };
  try {
    // ETAPA 1 — validação do cadastro: o que existe, o que falta e qual canal de contato é real.
    progress.phase("Etapa 1: validando o cadastro e os geradores");
    const business = request.business;
    if (!business.name.trim() || !business.city.trim() || !business.uf.trim()) throw new V6GenerationError("Cadastro sem nome, cidade ou UF: complete o lead antes de gerar a demo.", false);
    // Só um telefone que vira link válido conta: um número inválido seria apagado no pós-processamento e
    // deixaria chamadas como "Ligar para" sem o número.
    const contact = { hasPhone: !!normalizeWhatsappPhone(request.phone) };
    const dataNotes = [!business.category && "Cadastro sem categoria: o tipo do negócio foi inferido do nome e do segmento.", !contact.hasPhone && "Sem telefone válido: a demo não oferece WhatsApp nem ligação."].filter((note): note is string => !!note);
    const guide: V6Guide = await loadV6Guide();
    const maxImages = imageLimit();
    const briefSchema = siteBriefSchemaFor(maxImages);
    images = await timed("conexoes", () => resolveImageEngine(workspace));
    writer = await timed("conexoes", () => openWriter(workspace, v6SystemPrompt(guide), budget));

    // ETAPAS 2 a 5 — análise comercial, direção de arte, originalidade e planejamento (revalidados após cada revisão).
    const firstPrompt = briefPrompt(business, contact, request.history, guide, { maxImages });
    let brief = saved.brief;
    if (!brief) {
      progress.phase("Etapas 2–5: análise comercial, direção de arte e planejamento");
      brief = normalizeBrief(await timed("briefing", () => writer!.structured(firstPrompt, briefSchema, "high")), maxImages);
      saved.brief = brief; saved.briefRounds = 0; saved.briefDone = false;
      await save();
      await checkpoint();
    }
    let originality = originalityReport(identityFromBrief(brief, withoutFields(brief.copy.headline, business)), business.segment, request.history);
    let pendingBrief = [...briefIssues(brief, business, contact), ...originality.issues];
    while (!saved.briefDone && pendingBrief.length && (saved.briefRounds ?? 0) < V6_LIMITS.briefCorrections) {
      progress.phase(`Etapa 4: replanejando a direção (${pendingBrief.length} ponto(s) de originalidade ou estrutura)`);
      brief = normalizeBrief(await timed("briefing", () => writer!.structured(`${firstPrompt}\n\nSeu briefing anterior: ${JSON.stringify(brief)}\n\n${correctBriefPrompt(pendingBrief)}`, briefSchema, "medium")), maxImages);
      saved.brief = brief; saved.briefRounds = (saved.briefRounds ?? 0) + 1;
      originality = originalityReport(identityFromBrief(brief, withoutFields(brief.copy.headline, business)), business.segment, request.history);
      pendingBrief = [...briefIssues(brief, business, contact), ...originality.issues];
      await save();
      await checkpoint();
    }
    saved.briefDone = true;
    saved.briefIssuesLeft = pendingBrief;
    saved.originality = originality;
    await save();

    // ETAPA 6 — produção: Claude escreve o código enquanto o Codex gera a imagem a partir da especificação.
    const finalBrief = brief;
    const nominal = finalBrief.images.map((image, index) => ({ id: image.id, path: `assets/${image.id}.webp`, ...nominalSize(image.aspect, index === 0) }));
    progress.phase(`Etapa 6: Claude escreve o código${finalBrief.pages.count === 2 ? " das duas páginas" : ""}; Codex gera ${finalBrief.images.length} imagem(ns)`);
    const imageJob = (saved.assets ? Promise.resolve(saved.assets) : timed("imagens", () => produceImages(finalBrief, request, images!, progress, maxImages)))
      .then(async (result) => { saved.assets = result; await save(); return result; });
    const codeJob = (saved.code ? Promise.resolve(saved.code) : timed("codigo", () => writer!.structured(codePrompt(business, finalBrief, contact, guide, nominal), siteCodeSchema, "high")))
      .then(async (result) => { saved.code = result; await save(); return result; });
    // Espera os dois: se o código falhar, a imagem pronta continua salva para a retomada (e vice-versa).
    const [codeResult, imageResult] = await Promise.allSettled([codeJob, imageJob]);
    if (codeResult.status === "rejected") throw codeResult.reason;
    if (imageResult.status === "rejected") throw imageResult.reason;
    let code = codeResult.value;
    const assets = imageResult.value;
    await checkpoint();

    // ETAPAS 7 e 8 — validação estrutural e QA em navegador real.
    const assetPaths = new Map(assets.map((asset) => [asset.id, asset.path]));
    const historyTexts = request.history.filter((item) => item.segment === business.segment).map((item) => ({ headline: item.headline, texts: item.texts }));
    const run = (candidate: SiteCode) => postprocessSite({ code: candidate, business, phone: request.phone, assets: assetPaths });
    const check = (site: ProcessedSite) => timed("qa", () => audit(site, finalBrief, assets, historyTexts, workspace, progress, business));
    let final = run(code);
    let checked = saved.checked ?? await check(final);
    // Checkpoints anteriores a 2026-11-14 não separam os defeitos bloqueantes.
    checked = { ...checked, blocking: checked.blocking ?? [] };
    saved.checked = checked;
    saved.log ??= [];
    await save();
    await checkpoint();

    // ETAPAS 9 e 10 — correções direcionadas e revalidação, com o melhor resultado preservado.
    const initialIssues = checked.critical.length + checked.fixable.length;
    while ((checked.critical.length || checked.fixable.length) && saved.rounds < V6_LIMITS.fixRounds) {
      saved.rounds += 1;
      // Bloqueantes primeiro: são os que comprometem leitura ou interação.
      const issues = [...new Set([...checked.critical, ...checked.blocking, ...checked.fixable])].slice(0, 25);
      progress.phase(`Etapa 9: corrigindo ${issues.length} problema(s) (rodada ${saved.rounds} de ${V6_LIMITS.fixRounds})`);
      const candidate = await timed("correcoes", () => writer!.structured(fixPrompt(business, finalBrief, code, issues, guide), siteCodeSchema, "medium"));
      const entry: RoundLog = { round: saved.rounds, at: new Date().toISOString(), critical: 0, fixable: 0, warnings: 0, accepted: false };
      if (sha256(JSON.stringify(candidate)) === sha256(JSON.stringify(code))) {
        entry.note = "correção devolveu o mesmo código";
        saved.log.push(entry);
        await save();
        break;
      }
      const candidateSite = run(candidate);
      const lost = regressions(final, candidateSite);
      progress.phase("Etapa 10: revalidando depois da correção");
      const candidateChecked = await check(candidateSite);
      Object.assign(entry, { critical: candidateChecked.critical.length, fixable: candidateChecked.fixable.length, warnings: candidateChecked.warnings.length });
      if (lost.length || score(candidateChecked) >= score(checked)) {
        entry.note = lost.length ? `descartada: ${lost.join("; ")}` : "descartada: não reduziu os problemas";
        saved.log.push(entry);
        await save();
        await checkpoint();
        if (lost.length) break;
        continue;
      }
      entry.accepted = true;
      saved.log.push(entry);
      code = candidate; final = candidateSite; checked = candidateChecked;
      saved.code = code; saved.checked = checked;
      await save();
      await checkpoint();
    }
    saved.resolved = Math.max(0, initialIssues - (checked.critical.length + checked.fixable.length));
    if (checked.critical.length) {
      await save();
      throw new V6GenerationError(`A demo não passou nas verificações obrigatórias depois de ${saved.rounds} correção(ões): ${checked.critical.slice(0, 4).join(" ")}${recoverable() ? " As etapas ficaram salvas; use Tentar novamente para mais uma rodada de correção." : ""}`, recoverable());
    }

    // ETAPA 10b — revisão de impacto visual: o Claude avalia as capturas reais; abaixo da meta, correção direcionada,
    // novo QA técnico (que tem a palavra final) e nova avaliação. Imagens nunca são regeradas aqui.
    let visual: VisualQa;
    if (saved.visual) visual = saved.visual;
    else {
      const outcome = await visualStage({
        rounds: visualRounds, checked, code, final, writer, guide, business, brief: finalBrief, assets, progress,
        run, check, checkpoint, passthrough,
        persist: async (accepted, acceptedChecked) => { saved.code = accepted; saved.checked = acceptedChecked; await save(); },
      });
      visual = outcome.visual;
      if (outcome.accepted) { code = outcome.accepted.code; final = outcome.accepted.final; checked = outcome.accepted.checked; saved.code = code; saved.checked = checked; }
      saved.visual = visual;
      saved.visualCalls = (saved.visualCalls ?? 0) + budget.visualCalls;
      saved.visualUsd = (saved.visualUsd ?? 0) + writer.visualUsd;
      budget.visualCalls = 0;
      await save();
    }

    // ETAPA 11 — entrega: arquivos, capturas e relatório de QA.
    progress.phase("Etapa 11: salvando código, imagens, capturas e relatório");
    const siteId = randomUUID();
    const files = new Map<string, Buffer>([["styles.css", Buffer.from(final.css, "utf8")]]);
    for (const page of final.pages) files.set(page.file, Buffer.from(page.html, "utf8"));
    if (final.js) files.set("script.js", Buffer.from(final.js, "utf8"));
    for (const asset of assets) files.set(asset.path, asset.data);
    const imageFallback = assets.some((asset) => asset.source === "fallback");
    const review = [
      ...(saved.briefIssuesLeft ?? []).map((issue) => `Pendente após ${V6_LIMITS.briefCorrections} revisões do briefing: ${issue}`),
      ...originality.notes,
      ...(imageFallback ? [`Imagem do Codex indisponível (${assets.find((asset) => asset.error)?.error ?? images.note ?? "sem gerador"}); a composição SVG não é uma demo premium aprovada. Gere de novo quando o Codex estiver disponível.`] : []),
      ...(visual.status === "below_target" ? [`Impacto visual ${visual.final?.toFixed(1)} abaixo da meta ${VISUAL_TARGET} depois de ${visual.rounds} rodada(s): ${visual.problems.slice(0, 3).join(" ")}`] : []),
      ...(visual.status === "visual_review_unavailable" ? [`Revisão de impacto visual indisponível (${visual.reason ?? "sem motivo registrado"}); avalie as capturas manualmente.`] : []),
      ...HUMAN_REVIEW,
    ];
    const fixable = checked.fixable;
    // Bloqueantes que sobraram: a demo fica salva, mas nunca aparece como aprovada automaticamente.
    const blocking = checked.blocking.filter((issue) => fixable.includes(issue));
    const warnings = [...checked.warnings, ...final.notes, ...dataNotes, ...(checked.browserNote ? [checked.browserNote] : [])];
    const needsReview = fixable.length > 0 || (saved.briefIssuesLeft?.length ?? 0) > 0 || imageFallback || visual.status === "below_target";
    const cap = (list: string[]) => list.slice(0, 30).map((issue) => issue.slice(0, 300));
    const qa = {
      status: needsReview ? "needs_review" as const : warnings.length ? "warnings" as const : "passed" as const,
      browser: checked.browser ? "executed" as const : "unavailable" as const,
      rounds: saved.rounds,
      issues: cap([...fixable, ...warnings]),
      attempts: Math.min(saved.failures + 1, 5),
      fixable: cap(fixable), blocking: cap(blocking), warnings: cap(warnings), review: cap(review),
      resolved: saved.resolved ?? 0,
      pages: final.pages.map((page) => page.file),
      viewports: checked.browser ? QA_VIEWPORTS.map((v) => v.width) : [],
      imageFallback,
      originality: { compared: originality.compared, partial: originality.partial, nearest: originality.nearest, notes: cap([...originality.notes, ...(saved.briefIssuesLeft ?? [])]) },
      visual,
    };
    const visualUsd = Math.round((saved.visualUsd ?? 0) * 10_000) / 10_000;
    const diagnostics = {
      generator: "v6", text: { provider: "claude", calls: saved.calls + budget.calls, estimatedUsd: Math.max(0, Math.round((writer.estimatedUsd - writer.visualUsd) * 10_000) / 10_000) },
      visualReview: { calls: saved.visualCalls ?? 0, estimatedUsd: visualUsd, limitRounds: visualRounds, status: visual.status, initial: visual.initial, final: visual.final, history: visual.history },
      totalEstimatedUsd: writer.estimatedUsd,
      images: { engine: images.engine, note: images.note ?? null, generated: assets.filter((asset) => asset.source === "codex").length, limit: maxImages, files: assets.map((asset) => ({ id: asset.id, path: asset.path, source: asset.source, width: asset.width, height: asset.height, bytes: asset.data.length, sha256: sha256(asset.data), error: asset.error ?? null })) },
      requests: finalBrief.images.map((image) => ({ id: image.id, role: image.role, presence: image.presence ?? null, aspect: image.aspect, subject: image.subject, style: image.style, light: image.light, framing: image.framing })),
      attempts: saved.failures + 1, briefRounds: saved.briefRounds ?? 0, fixRounds: saved.rounds, rounds: saved.log, resolved: saved.resolved ?? 0,
      remaining: { fixable, warnings: checked.warnings, review: review.length },
      browser: { executed: checked.browser, note: checked.browserNote, checks: checked.checks },
      originality, profile: segmentProfile(business), durationsMs: saved.durations,
    };
    const manifest = await writeSite(siteId, files, {
      "brief.json": JSON.stringify(finalBrief, null, 2),
      "qa.json": JSON.stringify({ ...qa, viewports: qa.viewports, imageEngine: images.engine, imageNote: images.note ?? null, checks: checked.checks, critical: [] }, null, 2),
      ...(visual.status !== "disabled" && visual.status !== "visual_review_unavailable" ? { "visual-review.json": JSON.stringify(visual, null, 2) } : {}),
      "diagnostics.json": JSON.stringify(diagnostics, null, 2),
      "site.json": JSON.stringify({ businessName: business.name, city: business.city, uf: business.uf, generator: "v6", textProvider: "claude", createdAt: new Date().toISOString() }, null, 2),
      ...checked.shots,
    });
    const site = siteRefSchema.parse({
      id: siteId, generator: "v6", title: finalBrief.direction.concept.slice(0, 120), createdAt: new Date().toISOString(), files: manifest,
      images: assets.map((asset) => ({ id: asset.id, path: asset.path, source: asset.source, sha256: sha256(asset.data), alt: asset.alt })),
      preview: !!checked.shots["shot-1440.png"], summary: summarize(final.html, finalBrief, business), qa,
    });
    await rm(workspace, { recursive: true, force: true }).catch(() => {});
    return { site, message: finalBrief.message, estimatedUsd: writer.estimatedUsd, imageEngine: images.engine };
  } catch (error) {
    saved.calls += budget.calls;
    saved.visualCalls = (saved.visualCalls ?? 0) + budget.visualCalls;
    if (writer) saved.visualUsd = (saved.visualUsd ?? 0) + writer.visualUsd;
    if (error && typeof error === "object" && passthrough.has(error)) { await save().catch(() => {}); throw error; }
    const wrapped = error instanceof V6GenerationError ? error
      : new V6GenerationError(`${error instanceof Error ? error.message : "Não foi possível gerar a demo."}${recoverable() ? " As etapas concluídas ficaram salvas para retomar." : ""}`, recoverable());
    saved.failures += 1;
    saved.lastFailed = true;
    await save().catch(() => {});
    throw wrapped;
  } finally {
    images?.codex?.close();
  }
}

async function produceImages(brief: SiteBrief, request: V6Request, images: Awaited<ReturnType<typeof resolveImageEngine>>, progress: V6Progress, maxImages: number): Promise<Assets> {
  const out: Assets = [];
  let engine = images.engine;
  for (const [index, image] of brief.images.entries()) {
    const hero = index === 0;
    let error: string | undefined;
    if (engine !== "fallback" && index < maxImages) {
      try {
        progress.phase(`Etapa 6: Codex gerando a imagem ${index + 1} de ${brief.images.length}`);
        const raw = (await images.codex!.imageBuffer(images.thread!, imagePrompt(image, brief))).buffer;
        const optimized = await optimizeForWeb(raw, hero, image.aspect);
        out.push({ id: image.id, path: `assets/${image.id}.${optimized.extension}`, data: optimized.data, source: engine, alt: image.alt, width: optimized.width, height: optimized.height });
        continue;
      } catch (failure) {
        error = failure instanceof Error ? failure.message : "falha na geração";
        if (/limite|cota|saldo/i.test(error)) engine = "fallback";
      }
    } else if (index >= maxImages) error = `limite de ${maxImages} imagem(ns) gerada(s) por demo`;
    else if (images.note) error = `sem gerador de imagem (${images.note})`;
    const data = fallbackArtwork(image, brief.direction.palette, request.business.name);
    const size = nominalSize(image.aspect, false);
    out.push({ id: image.id, path: `assets/${image.id}.svg`, data, source: "fallback", alt: image.alt, width: 1600, height: Math.round(1600 * (size.height / size.width)), error: error ? `${error}; composição SVG usada no lugar` : undefined });
  }
  return out;
}

interface VisualStageInput {
  rounds: number; checked: Audit; code: SiteCode; final: ProcessedSite; writer: Writer; guide: V6Guide; business: V6Business; brief: SiteBrief; assets: Assets;
  progress: V6Progress; run: (code: SiteCode) => ProcessedSite; check: (site: ProcessedSite) => Promise<Audit>; checkpoint: () => Promise<void>; passthrough: WeakSet<object>;
  /** Grava no checkpoint uma correção visual aceita (uma pausa logo depois não a perde). */
  persist: (code: SiteCode, checked: Audit) => Promise<void>;
}

/**
 * Revisão de impacto visual com limite de rodadas. Cada rodada: correção direcionada → QA técnico completo (uma correção
 * que cria problema técnico é descartada) → nova avaliação com as capturas novas → aceita só se a nota subir.
 * Falha do avaliador (sem visão, limite, resposta genérica) vira `visual_review_unavailable`, nunca nota inventada.
 */
async function visualStage(input: VisualStageInput): Promise<{ visual: VisualQa; accepted?: { code: SiteCode; final: ProcessedSite; checked: Audit } }> {
  const { rounds, writer, guide, business, brief, progress } = input;
  const visual: VisualQa = { status: "visual_review_unavailable", target: VISUAL_TARGET, initial: null, final: null, rounds: 0, criteria: [], problems: [], fixes: [], history: [], reason: null };
  if (!rounds) return { visual: { ...visual, status: "disabled", reason: "SELLORA_DEMO_VISUAL_REVIEW_ROUNDS=0" } };
  if (!input.checked.browser) return { visual: { ...visual, reason: "navegador de auditoria não executado: não há capturas reais para avaliar" } };
  const summary = briefForReview(brief);
  const evaluate = async (shots: Record<string, Buffer>, round: number): Promise<{ review: VisualReview; score: number } | { error: string }> => {
    try {
      const images = await reviewImages(shots);
      if (!images.length) return { error: "capturas de 1440 e 390 px ausentes" };
      progress.phase(round ? `Etapa 10b: reavaliando o impacto visual (rodada ${round} de ${rounds})` : `Etapa 10b: avaliando o impacto visual em ${images.length} captura(s) reais`);
      const review = await writer.visual(visualReviewPrompt(business, summary, guide, images.map((image) => image.label), round), images, visualReviewSchema, "medium");
      const invalid = reviewProblems(review);
      if (invalid.length) return { error: `avaliação descartada por ser genérica ou incoerente (${invalid.slice(0, 2).join(" ")})` };
      return { review, score: weightedScore(review) };
    } catch (error) {
      if (error && typeof error === "object" && input.passthrough.has(error)) throw error;
      return { error: error instanceof Error ? error.message.slice(0, 200) : "falha do avaliador visual" };
    }
  };
  const record = (review: VisualReview, score: number) => {
    const summary = reviewSummary(review);
    Object.assign(visual, { final: score, criteria: summary.criteria, problems: summary.problems, fixes: summary.fixes });
  };

  const first = await evaluate(input.checked.shots, 0);
  if ("error" in first) return { visual: { ...visual, reason: first.error } };
  let current = { code: input.code, final: input.final, checked: input.checked, review: first.review, score: first.score };
  let changed = false;
  visual.initial = first.score;
  record(first.review, first.score);
  visual.history.push({ round: 0, score: first.score, accepted: true, note: "avaliação inicial" });
  await input.checkpoint();

  for (let round = 1; round <= rounds && current.score < VISUAL_TARGET; round += 1) {
    visual.rounds = round;
    const entry = { round, score: null as number | null, accepted: false, note: "" };
    visual.history.push(entry);
    let candidate: SiteCode;
    try {
      progress.phase(`Etapa 10b: corrigindo o impacto visual (nota ${current.score.toFixed(1)}, rodada ${round} de ${rounds})`);
      const sum = reviewSummary(current.review);
      candidate = await writer.visualCode(visualFixPrompt(business, brief, current.code, { score: current.score, problems: sum.problems, fixes: sum.fixes, preserve: current.review.preserve }, guide, input.assets.map((asset) => ({ path: asset.path, role: brief.images.find((image) => image.id === asset.id)?.role ?? asset.id, width: asset.width, height: asset.height }))), siteCodeSchema, "high");
    } catch (error) {
      if (error && typeof error === "object" && input.passthrough.has(error)) throw error;
      entry.note = `correção visual não concluída: ${error instanceof Error ? error.message.slice(0, 160) : "falha"}`;
      break;
    }
    const candidateSite = input.run(candidate);
    const lost = regressions(current.final, candidateSite);
    if (lost.length) { entry.note = `descartada: ${lost.join("; ")}`; await input.checkpoint(); continue; }
    progress.phase("Etapa 10b: QA técnico da correção visual");
    const candidateChecked = await input.check(candidateSite);
    if (candidateChecked.critical.length || score(candidateChecked) > score(current.checked)) {
      entry.note = `descartada: criou problema técnico (${[...candidateChecked.critical, ...candidateChecked.blocking, ...candidateChecked.fixable.filter((issue) => !current.checked.fixable.includes(issue))].slice(0, 2).join(" ") || "mais avisos"})`;
      await input.checkpoint();
      continue;
    }
    const next = await evaluate(candidateChecked.shots, round);
    if ("error" in next) { entry.note = `reavaliação indisponível: ${next.error}`; break; }
    entry.score = next.score;
    if (next.score <= current.score) { entry.note = `descartada: nota ${next.score.toFixed(1)} não supera ${current.score.toFixed(1)}`; await input.checkpoint(); continue; }
    entry.accepted = true;
    entry.note = `aceita: ${current.score.toFixed(1)} → ${next.score.toFixed(1)}`;
    current = { code: candidate, final: candidateSite, checked: candidateChecked, review: next.review, score: next.score };
    changed = true;
    record(next.review, next.score);
    await input.persist(candidate, candidateChecked);
    await input.checkpoint();
  }
  visual.status = current.score >= VISUAL_TARGET ? "approved" : "below_target";
  return { visual, ...(changed ? { accepted: { code: current.code, final: current.final, checked: current.checked } } : {}) };
}

async function audit(final: ProcessedSite, brief: SiteBrief, assets: Assets, history: { headline: string; texts: string[] }[], workspace: string, progress: V6Progress, business: V6Business) {
  progress.phase("Etapa 7: validação estrutural (HTML, links, arquivos, textos e contraste)");
  const fixed = staticQa(final, brief, assets.map((asset) => asset.path), history, business);
  const dir = path.join(workspace, `qa-${Date.now()}`);
  await mkdir(path.join(dir, "assets"), { recursive: true });
  for (const page of final.pages) await writeFile(path.join(dir, page.file), page.html);
  await writeFile(path.join(dir, "styles.css"), final.css);
  if (final.js) await writeFile(path.join(dir, "script.js"), final.js);
  for (const asset of assets) await writeFile(path.join(dir, ...asset.path.split("/")), asset.data);
  progress.phase(`Etapa 8: QA em navegador real (${QA_VIEWPORTS.map((v) => v.width).join(", ")} px${final.pages.length > 1 ? ", duas páginas" : ""})`);
  const browser = await browserQa(dir, { pages: final.pages.map((page) => page.file), fonts: [brief.direction.displayFont, brief.direction.bodyFont] });
  await rm(dir, { recursive: true, force: true }).catch(() => {});
  return {
    critical: fixed.critical,
    blocking: [...new Set(browser.blocking)],
    fixable: [...new Set([...fixed.fixable, ...browser.fixable])],
    warnings: [...new Set([...fixed.warnings, ...browser.warnings])],
    browser: browser.executed,
    browserNote: browser.executed ? null : `Auditoria visual em navegador não executada: ${browser.reason}`,
    checks: browser.checks,
    shots: browser.shots,
  };
}
