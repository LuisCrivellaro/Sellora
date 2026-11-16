import { demoMessageForCopy, type LeadDemo } from "./model";
import type { Activity } from "../types";
import { outreachActivityKind } from "../outreach/messages";

export const MANUAL_DEMO_ACTIVITY = "Envio manual da mensagem com demo declarado pelo operador. Entrega não verificada pelo Sellora.";
const localDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
/** Contatos distintos declarados no dia: envio da demo ou primeiro contato manual. */
export function manualDemoContactsOnDay(activities: Activity[], now: string): number {
  const today = localDay.format(new Date(now));
  return new Set(activities.filter((a) => a.type === "whatsapp" && a.leadId && a.completedAt && (a.description === MANUAL_DEMO_ACTIVITY || outreachActivityKind(a) === "first_contact") && localDay.format(new Date(a.completedAt)) === today).map((a) => a.leadId)).size;
}

/** Números brasileiros sem DDI recebem 55; outros países exigem DDI explícito. */
export function normalizeWhatsappPhone(input: string): string | null {
  if (!/^[+\d\s().-]+$/.test(input)) return null;
  const raw = input.trim();
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
  if (/^55[1-9]\d[2-9]\d{7,8}$/.test(digits)) return digits;
  if (/^[1-9]\d[2-9]\d{7,8}$/.test(digits)) return `55${digits}`;
  return null;
}

/**
 * Telefone fixo brasileiro (8 dígitos após o DDD, começando de 2 a 5). Quase nunca tem WhatsApp;
 * a prospecção pelo OpenStreetMap costuma trazer esse número.
 */
export function isBrazilianLandline(input: string): boolean {
  const number = normalizeWhatsappPhone(input);
  return !!number && /^55[1-9]\d[2-5]\d{7}$/.test(number);
}

export function whatsappDraftUrl(demo: LeadDemo, phone: string, origin: string): string {
  const text = demoMessageForCopy(demo, origin);
  const number = normalizeWhatsappPhone(phone);
  if (!number) throw new Error("Informe um telefone válido com DDD; para outro país, inclua +DDI.");
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function isCurrentDemoSent(demo: LeadDemo, phone: string): boolean {
  const sent = demo.lastManualSend;
  return !!sent && sent.body === demo.message && sent.designVersion === demo.version && sent.phone === normalizeWhatsappPhone(phone);
}

export function demoReviewStage(demo: LeadDemo, phone: string): "pending" | "approved" | "sent" | "rejected" {
  // Recusa vale mais que um envio antigo: a demo sai das demais filas até ser restaurada.
  if (demo.status === "rejected") return "rejected";
  if (isCurrentDemoSent(demo, phone)) return "sent";
  return demo.status;
}
