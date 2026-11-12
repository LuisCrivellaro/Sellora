import { z } from "zod";

const copy = (max: number) => z.string().trim().min(3).max(max);
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);
export const creationDraftSchema = z.object({
  name: copy(60),
  layout: z.enum(["split", "masthead", "panorama", "portrait", "offset", "poster"]),
  typography: z.enum(["serif", "sans", "condensed"]),
  photoSide: z.enum(["left", "right"]),
  photoShape: z.enum(["rectangle", "arch", "oval"]),
  sectionStyle: z.enum(["columns", "stacked", "alternating"]),
  paper: hexColor, ink: hexColor, accent: hexColor,
  headline: copy(90), intro: copy(360), cta: copy(60),
  sections: z.array(z.object({ title: copy(85), body: copy(600) })).min(2).max(3),
  imagePrompt: copy(2200), imageAlt: copy(220),
  message: z.string().trim().min(10).max(2000),
}).strict();
export type CreationDraft = z.infer<typeof creationDraftSchema>;

// Only these fields enter a public demo link. No prompt, message, account or CRM metadata.
export const generatedCreationSchema = creationDraftSchema.omit({ imagePrompt: true, message: true, imageAlt: true }).extend({
  id: z.uuid(),
  image: z.object({
    src: z.string().regex(/^\/api\/demos\/media\/[a-f0-9]{64}$/),
    sourceHash: z.string().regex(/^[a-f0-9]{64}$/),
    alt: copy(220), width: z.number().int().min(256).max(4096), height: z.number().int().min(256).max(4096),
  }).strict().refine((image) => image.src.endsWith(image.sourceHash), "A origem precisa corresponder ao arquivo da imagem."),
}).strict();
export type GeneratedCreation = z.infer<typeof generatedCreationSchema>;

export const creativeReferenceSchema = z.object({
  segment: z.string().max(30), signature: z.string().max(200),
  photoOrigin: z.string().max(100).nullable(), texts: z.array(z.string().max(2000)).max(20),
  imageDescription: z.string().max(400).optional(),
  message: z.string().max(2000),
}).strict();
export type CreativeReference = z.infer<typeof creativeReferenceSchema>;

export function creationSignature(c: Pick<CreationDraft, "layout" | "typography" | "photoSide" | "photoShape" | "sectionStyle">): string {
  const side = c.layout === "masthead" || c.layout === "panorama" ? "full-width" : c.photoSide;
  return [c.layout, c.typography, side, c.photoShape].join("|");
}

function luminance(color: string) {
  const [r, g, b] = color.slice(1).match(/../g)!.map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function creationContrastIssues(c: Pick<CreationDraft, "paper" | "ink" | "accent">): string[] {
  const ratio = (a: string, b: string) => {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  return ratio(c.paper, c.ink) < 4.5 || ratio(c.paper, c.accent) < 4.5 ? ["Aumente o contraste do texto e dos links para pelo menos 4,5:1."] : [];
}

export const generationResultSchema = z.object({ creation: generatedCreationSchema, message: creationDraftSchema.shape.message });
export type GenerationResult = z.infer<typeof generationResultSchema>;

export interface DemoGenerationStatus {
  available: boolean;
  connected: boolean;
  imageGeneration: boolean;
  message: string;
}

export interface DemoGenerationJob {
  id: string;
  businessKey: string;
  status: "running" | "completed" | "failed";
  phase: string;
  result: GenerationResult | null;
  error: string | null;
}
