import { z } from "zod";

/**
 * Demo Generator V6: cada demo é um site estático próprio (index.html, styles.css, script.js opcional, assets/).
 * O que a prévia mostra, o visualizador lista e o ZIP exporta são os mesmos arquivos gravados no disco.
 */

const text = (max: number) => z.string().trim().min(1).max(max);
const hex = z.string().regex(/^#[0-9a-f]{6}$/i);
export const assetIdSchema = z.string().regex(/^[a-z][a-z0-9-]{1,30}$/);
export const aspectSchema = z.enum(["16:9", "3:2", "4:3", "1:1", "4:5", "3:4", "2:3"]);

/** Etapas 1 a 3: análise, direção de arte e planejamento (antes de qualquer código). */
export const siteBriefSchema = z.object({
  analysis: z.object({
    businessType: text(80), specificSegment: text(120),
    confirmed: z.array(text(160)).min(1).max(8),
    unknown: z.array(text(160)).min(1).max(10),
    audienceInference: text(300), commercialGoal: text(240),
  }).strict(),
  direction: z.object({
    concept: text(400), mood: text(200),
    displayFont: text(40), bodyFont: text(40), typographyReason: text(240),
    palette: z.object({ background: hex, surface: hex, ink: hex, muted: hex, accent: hex, accentInk: hex }).strict(),
    paletteReason: text(240),
    imageStyle: text(300),
    motion: z.enum(["calma", "moderada", "expressiva"]), motionPlan: text(300),
    tone: text(200), primaryAction: text(60),
    heroComposition: text(200),
  }).strict(),
  sections: z.array(z.object({
    id: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/), purpose: text(200), composition: text(200), imageId: assetIdSchema.nullable(),
  }).strict()).min(3).max(9),
  images: z.array(z.object({
    id: assetIdSchema, role: text(120), aspect: aspectSchema,
    prompt: text(1800), alt: text(200),
  }).strict()).max(3),
  differentiation: text(500),
  message: z.string().trim().min(10).max(2000),
}).strict();
export type SiteBrief = z.infer<typeof siteBriefSchema>;

/** Etapa 4 e correções: o código-fonte completo. */
export const siteCodeSchema = z.object({
  html: z.string().min(200).max(220_000),
  css: z.string().min(50).max(160_000),
  js: z.string().max(60_000),
  notes: z.string().max(600),
}).strict();
export type SiteCode = z.infer<typeof siteCodeSchema>;

export const siteFileSchema = z.object({
  path: z.string().regex(/^(index\.html|styles\.css|script\.js|assets\/[a-z0-9-]+\.(webp|png|jpg|svg))$/),
  size: z.number().int().min(0).max(20_000_000),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type SiteFile = z.infer<typeof siteFileSchema>;

export const siteImageSchema = z.object({
  id: assetIdSchema, path: siteFileSchema.shape.path, source: z.enum(["codex", "gemini", "fallback"]), sha256: z.string().regex(/^[a-f0-9]{64}$/), alt: text(200),
}).strict();

export const siteQaSchema = z.object({
  status: z.enum(["passed", "warnings"]),
  browser: z.enum(["executed", "unavailable"]),
  rounds: z.number().int().min(0).max(3),
  issues: z.array(z.string().max(300)).max(30),
}).strict();
export type SiteQa = z.infer<typeof siteQaSchema>;

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
  }).strict(),
  qa: siteQaSchema,
}).strict();
export type SiteRef = z.infer<typeof siteRefSchema>;

/** Assinatura de composição: compara fontes, tipo de hero e sequência de seções entre demos do mesmo segmento. */
export function siteSignature(brief: Pick<SiteBrief, "direction" | "sections">): string {
  const font = brief.direction.displayFont.toLowerCase().replace(/\s+/g, "-");
  return [font, brief.sections.map((section) => section.id).join(">")].join("|");
}
