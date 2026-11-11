import { z } from "zod";
import type { Lead } from "../types";
import { uid } from "../utils";

// Lista explícita: observações, e-mail, score e dados do CRM nunca entram na prévia.
export const demoBusinessSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(60),
  uf: z.string().regex(/^[A-Z]{2}$/),
  segment: z.enum(["restaurantes", "saude", "beleza", "servicos", "comercio", "outros"]),
  phone: z.string().max(80),
});
export type DemoBusiness = z.infer<typeof demoBusinessSchema>;
export const demoMessageSchema = z.string().trim().min(10, "Escreva ao menos 10 caracteres.").max(2000, "Use até 2.000 caracteres.");
export const demoDesignVersionSchema = z.union([z.literal(1), z.literal(2)]);
export const leadDemoSchema = z.object({
  id: z.uuid(),
  version: demoDesignVersionSchema,
  business: demoBusinessSchema,
  message: demoMessageSchema,
  status: z.enum(["pending", "approved"]),
  createdAt: z.iso.datetime({ offset: true }),
  updatedAt: z.iso.datetime({ offset: true }),
  approvedAt: z.iso.datetime({ offset: true }).nullable(),
  approvedBy: z.string().min(1).max(200).nullable(),
  lastManualSend: z.object({
    at: z.iso.datetime({ offset: true }), by: z.string().min(1).max(200),
    phone: z.string().regex(/^\d{8,15}$/), body: demoMessageSchema,
    text: z.string().max(6000), designVersion: demoDesignVersionSchema,
  }).nullable().optional(),
}).refine((d) => d.status === "approved" ? !!d.approvedAt && !!d.approvedBy : d.approvedAt === null && d.approvedBy === null, "A aprovação precisa corresponder à versão da mensagem.");
export type LeadDemo = z.infer<typeof leadDemoSchema>;

export function createLeadDemo(lead: Lead): LeadDemo {
  const business = demoBusinessSchema.parse(lead);
  const t = new Date().toISOString();
  return leadDemoSchema.parse({ id: uid(), version: 2, business,
    message: `Olá, equipe ${business.name}! Sou da Sellora, criamos sites para negócios locais. Preparei uma demonstração não oficial de como a presença digital de vocês em ${business.city} poderia ficar. É uma proposta visual inicial, sem compromisso. Posso conversar com a pessoa responsável para entender se faz sentido para vocês?`,
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

export function parseDemoDocument(fragment: string): { version: 1 | 2; business: DemoBusiness } | null {
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
  if (valid.status !== "approved") throw new Error("A mensagem precisa de aprovação antes de ser copiada para envio.");
  return `${valid.message}\n\nDemonstração não oficial: ${demoPreviewUrl(valid, origin)}`;
}
