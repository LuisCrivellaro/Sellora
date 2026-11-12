import { z } from "zod";
import type { Lead } from "../types";
import { uid } from "../utils";
import { demoVariant } from "./kinds";

// Lista explícita: observações, e-mail, score e dados do CRM nunca entram na prévia.
export const demoBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(60),
  uf: z.string().regex(/^[A-Z]{2}$/),
  segment: z.enum(["restaurantes", "saude", "beleza", "servicos", "comercio", "outros"]),
  phone: z.string().max(80),
  /** Categoria da fonte (ex.: "Massagem"), usada só para escolher a direção visual da v3. */
  category: z.string().trim().max(60).optional(),
});
export type DemoBusiness = z.infer<typeof demoBusinessSchema>;
export const demoMessageSchema = z.string().trim().min(10, "Escreva ao menos 10 caracteres.").max(2000, "Use até 2.000 caracteres.");
export const demoDesignVersionSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
/** v3: direção por tipo de negócio + variação por estabelecimento (src/lib/demos/kinds.ts). */
export const CURRENT_DEMO_VERSION = 3 as const;
export const leadDemoSchema = z.object({
  id: z.uuid(),
  version: demoDesignVersionSchema,
  business: demoBusinessSchema,
  message: demoMessageSchema,
  /** rejected = demo recusada pelo operador: sai da fila e não pode ser aprovada nem enviada até ser restaurada. */
  status: z.enum(["pending", "approved", "rejected"]),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  approvedAt: z.iso.datetime({ offset: true }).nullable(),
  approvedBy: z.string().min(1).max(200).nullable(),
  rejectedAt: z.iso.datetime({ offset: true }).nullable().optional(),
  rejectedBy: z.string().min(1).max(200).nullable().optional(),
  lastManualSend: z.object({
    at: z.iso.datetime({ offset: true }), by: z.string().min(1).max(200),
    phone: z.string().regex(/^\d{8,15}$/), body: demoMessageSchema,
    text: z.string().max(6000), designVersion: demoDesignVersionSchema,
  }).nullable().optional(),
}).refine((d) => d.status === "approved" ? !!d.approvedAt && !!d.approvedBy : d.approvedAt === null && d.approvedBy === null, "A aprovação precisa corresponder à versão da mensagem.")
  .refine((d) => d.status === "rejected" ? !!d.rejectedAt && !!d.rejectedBy : !d.rejectedAt && !d.rejectedBy, "A recusa precisa registrar data e responsável.");
export type LeadDemo = z.infer<typeof leadDemoSchema>;

export function createLeadDemo(lead: Lead, source?: { category?: string }): LeadDemo {
  const business = demoBusinessSchema.parse({ ...lead, category: source?.category?.trim().slice(0, 60) || undefined });
  const { spec } = demoVariant(business);
  const t = new Date().toISOString();
  return leadDemoSchema.parse({ id: uid(), version: CURRENT_DEMO_VERSION, business,
    message: `Olá, equipe ${business.name}! Sou da Sellora, criamos sites para negócios locais. Preparei uma demonstração não oficial de como o site ${spec.noun} de vocês em ${business.city} poderia ficar. É uma proposta visual inicial, sem compromisso. Posso conversar com a pessoa responsável para entender se faz sentido para vocês?`,
    status: "pending", createdAt: t, updatedAt: t, approvedAt: null, approvedBy: null });
}

/** Snapshot no fragmento: abre sem o banco do CRM e não é enviado ao servidor. */
export function demoPreviewUrl(demo: LeadDemo, origin: string): string {
  const base = new URL(origin);
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) throw new Error("Endereço de prévia inválido.");
  const business = demoBusinessSchema.parse(demo.business);
  const bytes = new TextEncoder().encode(JSON.stringify({ version: demo.version, business }));
  const encoded = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${base.origin}/demo#${encoded}`;
}

export function parseDemoDocument(fragment: string): { version: 1 | 2 | 3; business: DemoBusiness } | null {
  try {
    if (fragment.length > 5000 || !/^#[A-Za-z0-9_-]+$/.test(fragment)) return null;
    const binary = atob(fragment.slice(1).replace(/-/g, "+").replace(/_/g, "/"));
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
    return z.object({ version: demoDesignVersionSchema, business: demoBusinessSchema }).parse(value);
  } catch { return null; }
}

export function parseDemoFragment(fragment: string): DemoBusiness | null { return parseDemoDocument(fragment)?.business ?? null; }

export function demoMessageForCopy(demo: LeadDemo, origin: string): string {
  const valid = leadDemoSchema.parse(demo);
  if (valid.status === "rejected") throw new Error("Esta demo foi recusada. Restaure e aprove antes de enviar.");
  if (valid.status !== "approved") throw new Error("A mensagem precisa de aprovação antes de ser copiada para envio.");
  return `${valid.message}\n\nDemonstração não oficial: ${demoPreviewUrl(valid, origin)}`;
}
