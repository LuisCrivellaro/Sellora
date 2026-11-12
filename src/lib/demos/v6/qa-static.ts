import { normalizeCreativeText } from "../concepts";
import { NOTICE_CLASS } from "./postprocess";
import type { SiteBrief } from "./schema";

/**
 * Verificações estáticas (sem navegador) aplicadas antes de marcar a demo como concluída.
 * critical: impede a entrega; fixable: volta ao modelo numa rodada de correção; warnings: ficam no relatório.
 */
export interface StaticQa { critical: string[]; fixable: string[]; warnings: string[] }

function luminance(color: string) {
  const [r, g, b] = color.slice(1).match(/../g)!.map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

const STOCK = ["excelencia", "experiencia unica", "inesquecivel", "jornada", "transforme", "eleve", "de qualidade", "o melhor da cidade", "paixao", "venha conferir", "seu momento", "cuidado especial", "atendimento diferenciado", "nao e apenas", "nao e so", "mais do que um"];
const INVENTED = [/\b\d+\s+anos\s+de\b/i, /\bpremiad[oa]s?\b/i, /\b\d+[.,]?\d*\s*estrelas\b/i, /\bdepoimentos?\b/i, /\bclientes satisfeitos\b/i, /\bR\$\s*\d/i, /\b(seg|ter|qua|qui|sex|sáb|sab|dom)[a-z]*\s*(a|-|–)\s*(seg|ter|qua|qui|sex|sáb|sab|dom)/i, /\b\d{1,2}h(\d{2})?\s*(às|as|-|–)\s*\d{1,2}h/i];
const PLACEHOLDERS = [/lorem ipsum/i, /\bTODO\b/, /\bXXX\b/, /seu texto aqui/i, /\{\{[A-Z_]+\}\}/, /\[(nome|cidade|telefone|endereço|endereco)[^\]]*\]/i];

export function headlineOf(html: string): string {
  return visibleText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
}

export function visibleText(html: string): string {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function staticQa(files: { html: string; css: string; js: string }, brief: SiteBrief, assets: string[], history: { headline: string; texts: string[] }[]): StaticQa {
  const { html, css, js } = files;
  const qa: StaticQa = { critical: [], fixable: [], warnings: [] };
  const text = visibleText(html);

  if (!/^\s*<!doctype html>/i.test(html)) qa.fixable.push("Comece o index.html com <!doctype html>.");
  if (!/<html[^>]*\blang=["']pt-BR["']/i.test(html)) qa.fixable.push('Use <html lang="pt-BR">.');
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) qa.fixable.push("Inclua a meta viewport.");
  if (!/<title>[^<]{3,}<\/title>/i.test(html)) qa.fixable.push("Inclua um <title> descritivo.");
  if (!/<meta[^>]+name=["']description["']/i.test(html)) qa.warnings.push("Sem meta description.");
  const h1 = (html.match(/<h1\b/gi) ?? []).length;
  if (h1 !== 1) qa.fixable.push(`A página deve ter exatamente um h1 (encontrados: ${h1}).`);
  if (!/<link[^>]+href=["']styles\.css["']/i.test(html)) qa.critical.push("O HTML não carrega styles.css.");
  if (!html.includes(NOTICE_CLASS)) qa.critical.push("Aviso de demonstração ausente.");

  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    if (!/\balt=["'][^"']+["']/i.test(match[0])) qa.fixable.push("Toda imagem precisa de alt descritivo.");
  }
  const refs = [...html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi), ...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((m) => m[1].trim());
  const ids = new Set([...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((m) => m[1]));
  for (const ref of refs) {
    if (ref.startsWith("#")) { if (ref.length > 1 && !ids.has(ref.slice(1))) qa.fixable.push(`Âncora ${ref} sem seção correspondente.`); continue; }
    if (/^(tel:|mailto:)/i.test(ref) || ref.startsWith("data:")) continue;
    if (/^https?:\/\//i.test(ref)) {
      const host = new URL(ref).hostname;
      if (!["fonts.googleapis.com", "fonts.gstatic.com", "wa.me", "www.google.com", "maps.google.com"].includes(host)) qa.fixable.push(`Recurso ou link externo não permitido: ${host}.`);
      continue;
    }
    if (/^(\/|[a-z]:|\.\.|file:)/i.test(ref) || ref.includes("/api/") || ref.includes("localhost")) { qa.critical.push(`Referência não portátil: ${ref}.`); continue; }
    const clean = ref.split(/[?#]/)[0];
    if (!["styles.css", "script.js", ...assets].includes(clean)) qa.fixable.push(`Arquivo referenciado não existe: ${clean}.`);
  }
  if (/<script\b[^>]+src=["']https?:/i.test(html)) qa.critical.push("Script externo não é permitido.");
  if (/<(iframe|form|object|embed|video|audio)\b/i.test(html)) qa.fixable.push("Remova iframes, formulários, vídeos e objetos incorporados.");
  for (const pattern of PLACEHOLDERS) if (pattern.test(text) || pattern.test(html)) qa.fixable.push(`Texto de preenchimento encontrado (${pattern.source}).`);
  const normalized = normalizeCreativeText(text);
  for (const word of STOCK) if (normalized.includes(word)) qa.fixable.push(`Expressão genérica de marketing: "${word}". Reescreva com algo específico do negócio.`);
  for (const pattern of INVENTED) if (pattern.test(text)) qa.fixable.push(`Possível fato não confirmado (${pattern.source}). Remova dados que não estão no cadastro.`);
  const dashes = (text.match(/—/g) ?? []).length;
  if (dashes > 3) qa.fixable.push(`Travessões demais no texto (${dashes}); use frases diretas.`);

  if (!/@media/.test(css)) qa.fixable.push("O CSS não tem regras responsivas (@media).");
  if (/(transition|animation)\s*:/.test(css) && !/prefers-reduced-motion/.test(css)) qa.fixable.push("Animações sem @media (prefers-reduced-motion: reduce).");
  if (/transition\s*:\s*all\b/.test(css)) qa.fixable.push("Evite transition: all; anime só transform e opacity.");
  if (/\bease-in\b(?!-)/.test(css)) qa.warnings.push("ease-in em interface parece lento; prefira ease-out.");
  if (/100vh/.test(css) && !/svh|dvh/.test(css)) qa.warnings.push("Use 100svh/100dvh no celular em vez de só 100vh.");
  if (/(fetch\(|XMLHttpRequest|localStorage|document\.cookie|eval\(|new Function)/.test(js)) qa.critical.push("script.js usa APIs não permitidas (rede, armazenamento ou eval).");

  const p = brief.direction.palette;
  if (contrast(p.background, p.ink) < 4.5) qa.fixable.push("Contraste entre fundo e texto abaixo de 4,5:1.");
  if (contrast(p.accent, p.accentInk) < 4.5) qa.fixable.push("Contraste do texto sobre a cor de destaque abaixo de 4,5:1.");

  const headline = normalizeCreativeText(visibleText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? ""));
  for (const previous of history) {
    if (headline.length > 10 && normalizeCreativeText(previous.headline) === headline) qa.fixable.push("Título principal igual ao de uma demo anterior.");
    for (const sentence of previous.texts) if (sentence.length >= 40 && normalized.includes(normalizeCreativeText(sentence))) { qa.fixable.push("Trecho de texto repetido de uma demo anterior."); break; }
  }
  if (html.length > 200_000 || css.length > 150_000) qa.warnings.push("Arquivos grandes demais para uma demo; simplifique.");
  qa.fixable = [...new Set(qa.fixable)];
  return qa;
}
