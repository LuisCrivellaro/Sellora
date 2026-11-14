import { z } from "zod";
import type { ClaudeImage } from "../claude-server";
import type { SiteBrief, VisualQa } from "./schema";

/**
 * Visual Impact Review: depois do QA técnico, o Claude avalia capturas reais (navegador headless, desktop e celular)
 * contra o briefing, com seis critérios ponderados. A aplicação calcula a nota final (o modelo não dá a média), recusa
 * avaliações genéricas e decide se vale uma correção direcionada. Sem capturas ou sem avaliador: `visual_review_unavailable`,
 * sem nota inventada. A nota é um sinal auxiliar: não substitui o QA técnico nem a revisão humana.
 */
export const VISUAL_TARGET = 8;
export const VISUAL_CRITERIA = [
  { key: "firstScreen", label: "Impacto da primeira tela", weight: 0.25 },
  { key: "composition", label: "Qualidade da composição visual", weight: 0.2 },
  { key: "typography", label: "Tipografia e hierarquia", weight: 0.15 },
  { key: "imagery", label: "Qualidade e integração das imagens", weight: 0.15 },
  { key: "originality", label: "Originalidade e diferenciação", weight: 0.15 },
  { key: "segmentFit", label: "Coerência com o segmento", weight: 0.1 },
] as const;
export type VisualCriterion = (typeof VISUAL_CRITERIA)[number]["key"];

/** Rodadas de correção visual: 2 por padrão; SELLORA_DEMO_VISUAL_REVIEW_ROUNDS de 0 (desliga) a 3. */
export const VISUAL_MAX_ROUNDS = 3;
export function visualReviewRounds(env: Record<string, string | undefined> = process.env): number {
  const raw = env.SELLORA_DEMO_VISUAL_REVIEW_ROUNDS;
  if (raw === undefined || raw.trim() === "") return 2;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 0 && value <= VISUAL_MAX_ROUNDS ? value : 2;
}

const criterion = z.object({
  score: z.number().min(0).max(10),
  evidence: z.string().trim().min(60).max(500),
  problems: z.array(z.string().trim().min(15).max(240)).max(4),
}).strict();

export const visualReviewSchema = z.object({
  criteria: z.object(Object.fromEntries(VISUAL_CRITERIA.map((item) => [item.key, criterion])) as Record<VisualCriterion, typeof criterion>).strict(),
  preserve: z.array(z.string().trim().min(15).max(240)).min(1).max(4),
  fixes: z.array(z.object({
    priority: z.number().int().min(1).max(5),
    area: z.enum(["hero", "secao", "tipografia", "imagens", "movimento", "celular", "cor", "ritmo"]),
    target: z.string().trim().min(3).max(120),
    instruction: z.string().trim().min(30).max(400),
  }).strict()).max(5),
}).strict();
export type VisualReview = z.infer<typeof visualReviewSchema>;

/** Média ponderada calculada pela aplicação, com uma casa decimal. */
export function weightedScore(review: Pick<VisualReview, "criteria">): number {
  const total = VISUAL_CRITERIA.reduce((sum, item) => sum + review.criteria[item.key].score * item.weight, 0);
  return Math.round(total * 10) / 10;
}

/** Elogio ou crítica sem objeto: não aponta elemento, posição, fonte, cor, imagem ou medida. */
const GENERIC = /^(o\s+)?(site|visual|layout|design|página|pagina|resultado)\s+(é|e|está|esta|parece|ficou)\s+(muito\s+)?(bonit[oa]|profissional|moderno|limpo|agradável|agradavel|elegante|bom|boa|ok)\b/i;
const CONCRETE = /(?<![\p{L}\d])(h1|h2|títulos?|titulos?|hero|primeira tela|botões|botão|botao|cta|imagens?|fotos?|fotografias?|seções|seção|secao|colunas?|grade|fontes?|serifa|pesos?|cor|cores|fundo|contraste|espaços?|espaco|margens?|celular|390|1440|menu|rodapé|rodape|faixas?|blocos?|cards?|lista|textos?|parágrafos?|paragrafo|navegação|navegacao|recorte|enquadramento|tipografia|escala|alinhamento)(?![\p{L}\d])/iu;

/** Motivos para descartar uma avaliação (justificativa vaga ou incoerente com a nota). Lista vazia = aceita. */
export function reviewProblems(review: VisualReview): string[] {
  const issues: string[] = [];
  for (const item of VISUAL_CRITERIA) {
    const c = review.criteria[item.key];
    if (GENERIC.test(c.evidence) || !CONCRETE.test(c.evidence)) issues.push(`${item.label}: justificativa sem evidência visual concreta.`);
    if (c.score < VISUAL_TARGET && !c.problems.length) issues.push(`${item.label}: nota ${c.score} sem problema apontado.`);
  }
  if (weightedScore(review) < VISUAL_TARGET && !review.fixes.length) issues.push("Nota abaixo da meta sem correções propostas.");
  return issues;
}

/** Problemas e correções em linhas curtas para o relatório (do mais pesado ao mais leve). */
export function reviewSummary(review: VisualReview): { problems: string[]; fixes: string[]; criteria: VisualQa["criteria"] } {
  const ranked = [...VISUAL_CRITERIA].sort((a, b) => review.criteria[a.key].score - review.criteria[b.key].score);
  return {
    problems: ranked.flatMap((item) => review.criteria[item.key].problems.map((problem) => `${item.label} (${review.criteria[item.key].score}): ${problem}`)).slice(0, 12),
    fixes: [...review.fixes].sort((a, b) => a.priority - b.priority).map((fix) => `[${fix.area} · ${fix.target}] ${fix.instruction}`),
    criteria: VISUAL_CRITERIA.map((item) => ({ key: item.key, label: item.label, weight: item.weight, score: review.criteria[item.key].score, evidence: review.criteria[item.key].evidence })),
  };
}

/**
 * Capturas enviadas ao avaliador: primeira tela no desktop (1440) e no celular (390), a página inteira em fatias legíveis
 * e a primeira tela da segunda página, se houver. JPEG para reduzir o volume; no máximo 9 imagens por avaliação.
 */
export async function reviewImages(shots: Record<string, Buffer>): Promise<ClaudeImage[]> {
  if (!shots["shot-1440.png"] || !shots["shot-390.png"]) return [];
  const { default: sharp } = await import("sharp");
  const jpeg = async (data: Buffer, width?: number) => (await sharp(data).resize(width ? { width, withoutEnlargement: true } : undefined).flatten({ background: "#ffffff" }).jpeg({ quality: 78 }).toBuffer());
  const images: ClaudeImage[] = [
    { label: "primeira tela no desktop (1440 × 900 px)", mediaType: "image/jpeg", data: await jpeg(shots["shot-1440.png"], 1440) },
    { label: "primeira tela no celular (390 × 844 px)", mediaType: "image/jpeg", data: await jpeg(shots["shot-390.png"]) },
  ];
  const slices = async (name: string, label: string, firstScreen: number, height: number, max: number) => {
    const full = shots[name];
    if (!full) return;
    const meta = await sharp(full).metadata();
    if (!meta.width || !meta.height) return;
    let count = 0;
    for (let top = firstScreen; top < meta.height - 40 && count < max; top += height, count += 1) {
      const slice = await sharp(full).extract({ left: 0, top, width: meta.width, height: Math.min(height, meta.height - top) }).toBuffer();
      images.push({ label: `${label}, trecho ${count + 1} (rolando a página)`, mediaType: "image/jpeg", data: await jpeg(slice) });
    }
  };
  // shot-1440-full: escala 0,5 (720 px de largura); shot-390-full: escala 0,8 (312 px).
  await slices("shot-1440-full.png", "página inteira no desktop", 450, 1100, 4);
  await slices("shot-390-full.png", "página inteira no celular", 675, 1500, 2);
  const secondary = Object.keys(shots).find((name) => /^shot-[a-z][a-z0-9-]+-1440\.png$/.test(name) && name !== "shot-1440-full.png");
  if (secondary) images.push({ label: `primeira tela da segunda página (${secondary.slice(5, -9)}.html) no desktop`, mediaType: "image/jpeg", data: await jpeg(shots[secondary], 1440) });
  return images.slice(0, 9);
}

/** Resumo do briefing que o avaliador precisa para julgar coerência e originalidade (sem dados de contato). */
export function briefForReview(brief: SiteBrief) {
  return {
    segmento: brief.analysis.specificSegment, conceito: brief.direction.concept, personalidade: brief.direction.personality,
    hero: `[${brief.direction.heroArchetype}] ${brief.direction.heroComposition}`, momentoDeAssinatura: brief.direction.signatureMoment ?? null,
    tipografia: `${brief.direction.displayFont} + ${brief.direction.bodyFont}`, paleta: brief.direction.palette, movimento: `${brief.direction.motion}: ${brief.direction.motionPlan}`,
    imagens: brief.images.map((image) => ({ papel: image.role, onde: image.placement, assunto: image.subject })),
    secoes: brief.sections.map((section) => `${section.function}: ${section.composition}`), diferenciacao: brief.differentiation,
  };
}
