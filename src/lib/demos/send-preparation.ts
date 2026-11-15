import type { LeadDemo } from "./model";
import { publishedDemoUrl } from "./model";
import { normalizeWhatsappPhone } from "./whatsapp";

export const AUTOMATIC_DEMO_REVIEWER = "Revisão automática da Sellora (QA)";
// O V6 registra estas limitações de cadastro mesmo quando todos os testes passam.
// Continuam visíveis no relatório; telefone ausente também aparece antes do envio manual.
const informationalNotes = new Set([
  "Cadastro sem categoria: o tipo do negócio foi inferido do nome e do segmento.",
  "Sem telefone válido: a demo não oferece WhatsApp nem ligação.",
]);

/** Critérios da preparação opcional; não alteram o caminho manual existente. */
export function automaticReviewIssues(demo: LeadDemo): string[] {
  if (demo.status === "rejected") return ["Demo recusada: restaure e revise manualmente."];
  if (demo.version !== 6 || !demo.site) return ["A preparação automática exige uma demo V6 com relatório de QA."];
  const qa = demo.site.qa;
  const issues: string[] = [];
  const pending = [...qa.issues, ...(qa.warnings ?? [])].filter((issue) => !informationalNotes.has(issue));
  if (qa.status === "needs_review" || pending.length || qa.blocking?.length || qa.fixable?.length) issues.push("O QA ainda tem avisos ou pendências; revise a demo manualmente.");
  if (qa.browser !== "executed" || ![1440, 1024, 768, 390, 360].every((width) => qa.viewports?.includes(width))) issues.push("Falta a verificação completa em computador e celular.");
  if (!demo.site.files.filter((file) => file.path.endsWith(".html")).every((file) => qa.pages?.includes(file.path))) issues.push("Nem todas as páginas têm QA registrado.");
  if (!qa.originality || qa.originality.partial > 0 || qa.originality.notes.length) issues.push("A comparação de originalidade exige revisão.");
  if (qa.imageFallback || demo.site.images.some((image) => image.source === "fallback")) issues.push("A demo usou imagens substitutas.");
  if (qa.visual?.status !== "approved" || qa.visual.final === null || qa.visual.final < Math.max(8, qa.visual.target)) issues.push("A revisão visual não atingiu a meta ou está indisponível.");
  if (!demo.generatedMessage || demo.message !== demo.generatedMessage) issues.push("A mensagem foi editada ou não tem origem registrada; a revisão manual foi preservada.");
  return issues;
}

export function sendPreparationState(demo: LeadDemo, phone: string) {
  if (demo.status === "rejected") return "Recusada";
  if (demo.status !== "approved") return "Aguardando revisão";
  if (!publishedDemoUrl(demo)) return "Aguardando link público desta versão";
  if (!normalizeWhatsappPhone(phone)) return "Mensagem preparada; confira o telefone para WhatsApp";
  return "Pronta para envio manual";
}
