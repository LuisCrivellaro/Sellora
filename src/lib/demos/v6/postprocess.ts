import { normalizeWhatsappPhone } from "../whatsapp";
import type { SiteCode } from "./schema";

export interface PostprocessInput {
  code: SiteCode;
  business: { name: string; city: string; uf: string };
  phone: string;
  /** id da imagem → caminho final gravado (assets/<id>.webp, .png ou .svg). */
  assets: Map<string, string>;
}

const escapeHtml = (value: string) => value.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

export const NOTICE_CLASS = "sellora-demo-notice";
const NOTICE_CSS = `
/* Sellora: aviso padronizado de demonstração (inserido pela aplicação em toda demo V6) */
.${NOTICE_CLASS} { margin: 0; padding: 8px 16px; background: #141414; color: #f4f4f4; font: 500 12px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; text-align: center; letter-spacing: 0; }
`;

/**
 * Prepara o código para gravar: o que sai daqui é exatamente o que a prévia mostra e o ZIP exporta.
 * Substitui marcadores de contato (o telefone nunca é enviado ao modelo), aponta as imagens para os arquivos reais,
 * remove scripts inline e atributos de evento e insere o aviso de demonstração e o noindex.
 */
export function postprocessSite({ code, business, phone, assets }: PostprocessInput): { html: string; css: string; js: string; notes: string[] } {
  const notes: string[] = [];
  let html = code.html;
  let css = code.css;
  const js = code.js.trim();

  for (const [id, finalPath] of assets) {
    const planned = new RegExp(`assets/${id}\\.(webp|png|jpg|jpeg|svg)`, "g");
    html = html.replace(planned, finalPath);
    css = css.replace(planned, finalPath);
  }

  const number = phone ? normalizeWhatsappPhone(phone) : null;
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${business.name} ${business.city} ${business.uf}`)}`;
  const tokens: Record<string, string | null> = {
    "{{PHONE_DISPLAY}}": number ? escapeHtml(phone.trim()) : null,
    "{{PHONE_LINK}}": number ? `tel:+${number}` : null,
    "{{WHATSAPP_LINK}}": number ? `https://wa.me/${number}` : null,
    "{{MAPS_LINK}}": maps,
  };
  for (const [token, value] of Object.entries(tokens)) {
    if (!html.includes(token)) continue;
    if (value === null) { notes.push(`O código usa ${token}, mas não há telefone válido cadastrado.`); html = html.split(token).join(token === "{{PHONE_DISPLAY}}" ? "" : maps); }
    else html = html.split(token).join(value);
  }

  const inlineScripts = html.match(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) ?? [];
  if (inlineScripts.length) { notes.push("Scripts inline removidos (o JavaScript deve ficar em script.js)."); html = html.replace(/<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi, ""); }
  if (/\son[a-z]+\s*=/i.test(html)) { notes.push("Atributos de evento inline removidos."); html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ""); }

  html = html.replace(/<script\b[^>]*\bsrc=["']script\.js["'][^>]*>\s*<\/script>/gi, "");
  if (js) html = html.replace(/<\/body>/i, `<script src="script.js" defer></script>\n</body>`);

  if (!/name=["']robots["']/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>\n<meta name="robots" content="noindex, nofollow">`);
  if (!html.includes(NOTICE_CLASS)) {
    const notice = `<p class="${NOTICE_CLASS}" role="note">Demonstração não oficial criada pela Sellora para ${escapeHtml(business.name)}. Imagens ilustrativas; informações a confirmar com o estabelecimento.</p>`;
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${notice}`);
    css = `${css.trimEnd()}\n${NOTICE_CSS}`;
  }
  return { html, css, js, notes };
}
