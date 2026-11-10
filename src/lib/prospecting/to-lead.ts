import { leadInputSchema, type LeadInput } from "../schemas";
import type { Lead, PackageConfig, PackageId, WebsiteSituation } from "../types";
import { hostOf, normalizeName, phoneDigits } from "./classify";
import type { ProspectResult } from "./types";

/**
 * Ponte Prospecção IA → CRM (funções puras, testadas): duplicidade, sugestão
 * de produto e conversão no formato de entrada do lead existente.
 */

export interface CrmMatch {
  leadId: string;
  leadName: string;
  reason: string;
}

type LeadLike = Pick<Lead, "id" | "name" | "city" | "phone" | "website" | "instagram">;

export function findCrmDuplicate(r: Pick<ProspectResult, "name" | "city" | "phone" | "website" | "instagram">, leads: LeadLike[]): CrmMatch | null {
  const name = normalizeName(r.name);
  const city = normalizeName(r.city);
  const phone = phoneDigits(r.phone);
  const host = r.website ? hostOf(r.website) : null;
  const ig = r.instagram.replace(/^@/, "").toLowerCase();
  for (const l of leads) {
    if (normalizeName(l.name) === name && normalizeName(l.city) === city) return { leadId: l.id, leadName: l.name, reason: "mesmo nome e cidade" };
    if (phone.length >= 10 && phoneDigits(l.phone).length >= 10 && phoneDigits(l.phone).slice(-10) === phone.slice(-10)) return { leadId: l.id, leadName: l.name, reason: "mesmo telefone" };
    if (host && l.website && hostOf(l.website) === host) return { leadId: l.id, leadName: l.name, reason: "mesmo site" };
    if (ig && l.instagram && l.instagram.replace(/^@/, "").toLowerCase() === ig) return { leadId: l.id, leadName: l.name, reason: "mesmo Instagram" };
  }
  return null;
}

export interface ProductSuggestion {
  packageId: PackageId;
  name: string;
  price: number;
  reason: string;
}

/** Sugestão comercial (não é proposta): usa os pacotes configurados em Configurações. */
export function suggestProduct(r: Pick<ProspectResult, "classification" | "presence">, packages: PackageConfig[]): ProductSuggestion | null {
  const pick = (id: PackageId, reason: string): ProductSuggestion | null => {
    const p = packages.find((x) => x.id === id);
    return p ? { packageId: id, name: p.name, price: p.price, reason } : null;
  };
  if (r.classification === "HOT")
    return pick("essencial", r.presence === "so_redes" ? "Endereço próprio além das redes: página com WhatsApp, mapa, horários e serviços." : "Primeira presença própria: página com contato, mapa, horários e serviços.");
  if (r.classification === "WARM") return pick("profissional", "Substituir o site atual corrigindo os problemas verificados (mobile, HTTPS, contato).");
  return null;
}

function websiteSituation(r: ProspectResult): WebsiteSituation {
  if (r.classification === "HOT") return "sem_site";
  if (r.classification === "LOW") return "adequado";
  return r.problems.some((p) => p.includes("viewport")) ? "sem_mobile" : "desatualizado";
}

const cut = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** Texto das observações do lead: classificação, diagnóstico, evidências e fontes. */
export function prospectNotes(r: ProspectResult, suggestion: ProductSuggestion | null): string {
  const lines = [
    `Prospecção IA · ${fmtDate(r.checkedAt)} · ${r.classification} · score ${r.score}/100 · confiança ${{ alta: "alta", media: "média", baixa: "baixa" }[r.confidence]}`,
    `Diagnóstico: ${r.diagnosis}`,
    `Justificativa: ${r.justification}`,
    r.problems.length ? `Problemas verificados: ${r.problems.join("; ")}` : "",
    r.otherSocials.length ? `Outras redes: ${r.otherSocials.join(" · ")}` : "",
    r.address ? `Endereço (fonte): ${r.address}` : "",
    `Não verificado: ${r.evidence.filter((e) => e.status === "nao_verificado").map((e) => e.claim).join("; ") || "—"}`,
    `Fontes: ${r.sources.map((s) => `${s.label} ${s.url}`).join(" · ")}`,
    suggestion ? `Sugestão Sellora: ${suggestion.name} — ${suggestion.reason}` : "",
  ].filter(Boolean);
  return cut(lines.join("\n"), 2000);
}

export function prospectToLeadInput(r: ProspectResult, packages: PackageConfig[]): { input: LeadInput; activity: string } {
  const suggestion = suggestProduct(r, packages);
  const phone = phoneDigits(r.phone).length >= 10 ? r.phone.trim() : "";
  // Valores da fonte fora do formato aceito pelo CRM ficam só nas observações.
  const website = leadInputSchema.shape.website.safeParse(r.website).success ? r.website : "";
  const email = leadInputSchema.shape.email.safeParse(r.email).success ? r.email : "";
  const input: LeadInput = {
    name: cut(r.name.trim(), 120),
    segment: r.segment,
    city: cut(r.city.trim(), 60),
    uf: r.uf,
    source: "prospeccao_ia",
    website,
    websiteSituation: websiteSituation(r),
    stage: "novo",
    priority: r.classification === "HOT" ? "alta" : r.classification === "WARM" ? "media" : "baixa",
    phone,
    email,
    instagram: cut(r.instagram, 60),
    // Valor potencial = preço de referência do pacote sugerido (editável), nunca um valor do lead.
    potentialValue: suggestion?.price ?? 0,
    nextAction: "Revisar diagnóstico e confirmar presença digital antes do contato",
    nextActionAt: null,
    notes: prospectNotes(r, suggestion),
  };
  const activity = cut(`Importado da Prospecção IA: ${r.classification} · ${r.score}/100 · ${r.diagnosis}. Fonte: ${r.sources[0]?.label ?? "—"} (${fmtDate(r.checkedAt)}).`, 500);
  return { input, activity };
}
