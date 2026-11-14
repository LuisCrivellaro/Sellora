import { z } from "zod";

/**
 * Demo Generator V6: cada demo é um site estático próprio (index.html, uma segunda página opcional, styles.css,
 * script.js opcional, assets/). O que a prévia mostra, o visualizador lista e o ZIP exporta são os mesmos arquivos
 * gravados no disco.
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const assetIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,30}$/);
export const aspectSchema = z.enum(["21:9", "16:9", "3:2", "4:3", "1:1", "4:5", "3:4", "2:3"]);
/** Segunda página (no máximo uma): nome curto em minúsculas, nunca index.html. */
export const pageFileSchema = z.string().regex(/^(?!index\.html$)[a-z][a-z0-9-]{2,30}\.html$/);

/**
 * Arquétipos de hero. Os seis primeiros vêm do guia original; `faixa-panoramica` e `indice` foram acrescentados
 * para negócios em que a primeira tela precisa mostrar o lugar em largura ou a lista do que se faz.
 */
export const HERO_ARCHETYPES = ["foto-painel", "colunas", "tipografico", "moldura", "grade", "cor-solida", "faixa-panoramica", "indice"] as const;
export const heroArchetypeSchema = z.enum(HERO_ARCHETYPES);

/** Função de cada seção: é o que a comparação de originalidade usa, não o id escolhido pelo modelo. */
export const SECTION_FUNCTIONS = ["hero", "apresentacao", "oferta", "processo", "espaco", "galeria", "diferenciais", "perguntas", "localizacao", "contato", "chamada", "rodape"] as const;
export const sectionFunctionSchema = z.enum(SECTION_FUNCTIONS);

export const DISPLAY_CATEGORIES = ["serifa", "sem-serifa", "condensada", "slab", "display", "mono", "manuscrita"] as const;

const sectionSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/), function: sectionFunctionSchema, purpose: text(200), composition: text(200), imageId: assetIdSchema.nullable(),
}).strict();

/**
 * Presença humana planejada na imagem. Pessoas geradas são sempre ilustrativas (nunca a equipe ou os clientes reais);
 * o campo existe para o conjunto variar e para o pedido ao Codex dizer exatamente o que pode aparecer.
 */
export const IMAGE_PRESENCE = ["sem-pessoas", "maos", "figurantes", "pessoas-ilustrativas"] as const;

/** Especificação fotográfica que o Claude escreve e o backend envia ao Codex. */
const imageSpecFields = {
  id: assetIdSchema, role: text(120), aspect: aspectSchema,
  placement: text(160), subject: text(200), context: text(200), style: text(160), light: text(160),
  framing: text(160), depth: text(120), textSpace: text(160), dominantColors: text(160), restrictions: text(240),
  prompt: text(1800), alt: text(200),
};
export const imageSpecSchema = z.object({ ...imageSpecFields, presence: z.enum(IMAGE_PRESENCE) }).strict();
/** Briefings gravados antes de 2026-11-14 não têm `presence`. */
const legacyImageSpecSchema = z.object({ ...imageSpecFields, presence: z.enum(IMAGE_PRESENCE).optional() }).strict();
export type ImageSpec = z.infer<typeof legacyImageSpecSchema>;

/**
 * Etapas 2 a 5: análise comercial, direção de arte e planejamento (antes de qualquer código).
 * `legacy` aceita briefings de checkpoints e demos anteriores sem os campos novos (`signatureMoment`, `presence`);
 * a geração sempre pede o schema completo.
 */
export function siteBriefSchemaFor(maxImages = 3, legacy = false) {
  const image = legacy ? legacyImageSpecSchema : imageSpecSchema;
  const signature = legacy ? text(300).optional() : text(300);
  return z.object({
    analysis: z.object({
      businessType: text(80), specificSegment: text(120),
      confirmed: z.array(text(160)).min(1).max(8),
      unknown: z.array(text(160)).min(1).max(10),
      audienceInference: text(300), commercialGoal: text(240),
      visitorGoal: text(240),
      firstInformation: z.array(text(120)).min(1).max(4),
    }).strict(),
    direction: z.object({
      concept: text(400), mood: text(200), personality: text(200),
      displayFont: text(40), displayCategory: z.enum(DISPLAY_CATEGORIES), bodyFont: text(40), typographyReason: text(240),
      typeScale: text(240),
      palette: z.object({ background: hex, surface: hex, ink: hex, muted: hex, accent: hex, accentInk: hex }).strict(),
      paletteReason: text(240),
      imageStyle: text(300),
      motion: z.enum(["calma", "moderada", "expressiva"]), motionPlan: text(300),
      tone: text(200), primaryAction: text(60),
      heroArchetype: heroArchetypeSchema,
      heroComposition: text(240),
      /** Momento visual de assinatura: o que o dono vai lembrar da página (onde fica, como é feito, por que serve ao negócio). */
      signatureMoment: signature,
      mobileComposition: text(240),
      conversionPath: text(240),
      rationale: z.object({ firstScreen: text(220), hero: text(220), photography: text(220), motion: text(220), mobile: text(220), conversion: text(220) }).strict(),
    }).strict(),
    copy: z.object({ headline: text(120), subheadline: text(260), primaryCta: text(40), secondaryCta: text(40).nullable() }).strict(),
    pages: z.object({
      count: z.union([z.literal(1), z.literal(2)]),
      reason: text(240),
      secondary: z.object({ file: pageFileSchema, navLabel: text(30), title: text(80), purpose: text(200), sections: z.array(sectionSchema).min(2).max(6) }).strict().nullable(),
    }).strict(),
    sections: z.array(sectionSchema).min(3).max(9),
    images: z.array(image).min(1).max(maxImages),
    differentiation: text(500),
    message: z.string().trim().min(10).max(2000),
  }).strict();
}
/** Leitura tolerante (checkpoints, demos gravadas, fixtures). Para gerar, use `siteBriefSchemaFor(limite)`. */
export const siteBriefSchema = siteBriefSchemaFor(3, true);
export type SiteBrief = z.infer<typeof siteBriefSchema>;

/** Etapa de produção e correções: o código-fonte completo (uma ou duas páginas). */
export const siteCodeSchema = z.object({
  html: z.string().min(200).max(220_000),
  css: z.string().min(50).max(160_000),
  js: z.string().max(60_000),
  secondary: z.object({ file: pageFileSchema, html: z.string().min(200).max(220_000) }).strict().nullable(),
  notes: z.string().max(600),
}).strict();
export type SiteCode = z.infer<typeof siteCodeSchema>;

/** Código salvo em checkpoints antigos (antes da segunda página) continua utilizável. */
export function normalizeCode(value: unknown): SiteCode | null {
  if (!value || typeof value !== "object") return null;
  const parsed = siteCodeSchema.safeParse({ secondary: null, ...value });
  return parsed.success ? parsed.data : null;
}

export const siteFileSchema = z.object({
  path: z.string().regex(/^(index\.html|(?!index\.html$)[a-z][a-z0-9-]{2,30}\.html|styles\.css|script\.js|assets\/[a-z0-9-]+\.(webp|png|jpg|svg))$/),
  size: z.number().int().min(0).max(20_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type SiteFile = z.infer<typeof siteFileSchema>;

export const siteImageSchema = z.object({
  id: assetIdSchema, path: siteFileSchema.shape.path, source: z.enum(["codex", "gemini", "fallback"]) /* "gemini": só leitura de registros antigos */, sha256: z.string().regex(/^[a-f0-9]{64}$/), alt: text(200),
}).strict();

const issueList = z.array(z.string().max(300)).max(30);

/**
 * Revisão de impacto visual (capturas reais avaliadas pelo Claude). É um sinal auxiliar: nota ≥ meta não substitui
 * o QA técnico nem a revisão humana. `visual_review_unavailable` = não houve avaliação (sem capturas, falha do
 * avaliador ou resposta genérica descartada); nunca há nota inventada.
 */
export const VISUAL_STATUSES = ["approved", "below_target", "visual_review_unavailable", "disabled"] as const;
export const visualQaSchema = z.object({
  status: z.enum(VISUAL_STATUSES),
  target: z.number().min(0).max(10),
  initial: z.number().min(0).max(10).nullable(),
  final: z.number().min(0).max(10).nullable(),
  rounds: z.number().int().min(0).max(5),
  criteria: z.array(z.object({ key: z.string().max(20), label: z.string().max(60), weight: z.number().min(0).max(1), score: z.number().min(0).max(10), evidence: z.string().max(500) }).strict()).max(6),
  problems: issueList,
  fixes: issueList,
  history: z.array(z.object({ round: z.number().int().min(0).max(5), score: z.number().min(0).max(10).nullable(), accepted: z.boolean(), note: z.string().max(300) }).strict()).max(8),
  reason: z.string().max(300).nullable(),
}).strict();
export type VisualQa = z.infer<typeof visualQaSchema>;

export const siteQaSchema = z.object({
  /** passed: nada pendente · warnings: só avisos · needs_review: corrigíveis não resolvidos, originalidade ou imagem pendentes. */
  status: z.enum(["passed", "warnings", "needs_review"]),
  browser: z.enum(["executed", "unavailable"]),
  rounds: z.number().int().min(0).max(6),
  /** Lista combinada (compatível com registros antigos). As listas abaixo separam por gravidade. */
  issues: issueList,
  attempts: z.number().int().min(1).max(5).optional(),
  fixable: issueList.optional(),
  /** Defeitos de leitura ou interação medidos no navegador (sobreposição, corte, rolagem horizontal…): impedem aprovação automática. */
  blocking: issueList.optional(),
  warnings: issueList.optional(),
  review: issueList.optional(),
  resolved: z.number().int().min(0).max(200).optional(),
  pages: z.array(siteFileSchema.shape.path).max(2).optional(),
  viewports: z.array(z.number().int()).max(8).optional(),
  imageFallback: z.boolean().optional(),
  originality: z.object({ compared: z.number().int().min(0), partial: z.number().int().min(0), nearest: z.number().min(0).max(1).nullable(), notes: issueList }).strict().optional(),
  visual: visualQaSchema.optional(),
}).strict();
export type SiteQa = z.infer<typeof siteQaSchema>;

/** Assinatura visual estruturada (ver identity.ts). Opcional: demos gravadas antes de 2026-11-13 não têm. */
export const visualIdentitySchema = z.object({
  v: z.literal(1),
  hero: z.string().max(30).nullable(),
  imageAspect: z.string().max(6).nullable(),
  displayFont: z.string().max(40),
  displayCategory: z.string().max(20).nullable(),
  bodyFont: z.string().max(40),
  tone: z.enum(["claro", "escuro"]),
  background: hex,
  accent: hex,
  sections: z.array(z.string().max(20)).max(16),
  pages: z.number().int().min(1).max(2),
  motion: z.string().max(12).nullable(),
  photo: z.array(z.string().max(24)).max(10),
  headline: z.string().max(200),
  ctas: z.array(z.string().max(40)).max(3),
}).strict();
export type VisualIdentity = z.infer<typeof visualIdentitySchema>;

/** Referência gravada no lead: leve, sem o código (o código fica no armazenamento de sites, imutável por id). */
export const siteRefSchema = z.object({
  id: z.uuid(),
  generator: z.literal("v6"),
  title: text(120),
  createdAt: z.iso.datetime({ offset: true }),
  files: z.array(siteFileSchema).min(2).max(12),
  images: z.array(siteImageSchema).max(4),
  preview: z.boolean(),
  summary: z.object({
    headline: text(200),
    texts: z.array(z.string().max(600)).max(24),
    fonts: z.array(text(40)).max(2),
    palette: z.array(hex).max(6),
    sections: z.array(z.string().max(40)).max(9),
    hero: text(200),
    signature: z.string().max(300),
    identity: visualIdentitySchema.optional(),
    pages: z.array(siteFileSchema.shape.path).min(1).max(2).optional(),
  }).strict(),
  qa: siteQaSchema,
}).strict();
export type SiteRef = z.infer<typeof siteRefSchema>;

/** Assinatura de composição: compara fontes, tipo de hero e sequência de seções entre demos do mesmo segmento. */
export function siteSignature(brief: Pick<SiteBrief, "direction" | "sections">): string {
  const font = brief.direction.displayFont.toLowerCase().replace(/\s+/g, "-");
  return [font, brief.sections.map((section) => section.id).join(">")].join("|");
}
