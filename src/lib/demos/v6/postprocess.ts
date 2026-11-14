import { normalizeWhatsappPhone } from "../whatsapp";
import type { SiteCode } from "./schema";

export interface PostprocessInput {
  code: SiteCode | (Omit<SiteCode, "secondary"> & { secondary?: SiteCode["secondary"] });
  business: { name: string; city: string; uf: string };
  phone: string;
  /** id da imagem → caminho final gravado (assets/<id>.webp, .png ou .svg). */
  assets: Map<string, string>;
}
export interface SitePage { file: string; html: string }
export interface ProcessedSite { html: string; css: string; js: string; pages: SitePage[]; notes: string[] }

const escapeHtml = (value: string) => value.replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c]!);

export const NOTICE_CLASS = "sellora-demo-notice";
const NOTICE_CSS = `
/* Sellora: aviso padronizado de demonstração (inserido pela aplicação em toda demo V6) */
.${NOTICE_CLASS} { margin: 0; padding: 8px 16px; background: #141414; color: #f4f4f4; font: 500 12px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; text-align: center; letter-spacing: 0; }
`;
/** O aviso (demonstração + imagens ilustrativas) não pode ser escondido pelo CSS do modelo, nem numa correção visual. */
const NOTICE_GUARD = `
/* Sellora: aviso obrigatório sempre visível */
html body .${NOTICE_CLASS} { display: block !important; visibility: visible !important; opacity: 1 !important; clip-path: none !important; transform: none !important; font-size: 12px !important; color: #f4f4f4 !important; background: #141414 !important; }
`;

function processPage(source: string, input: PostprocessInput, js: string, notes: Set<string>): string {
  const { business, phone, assets } = input;
  let html = source;
  for (const [id, finalPath] of assets) html = html.replace(new RegExp(`assets/${id}\\.(webp|png|jpg|jpeg|svg)`, "g"), finalPath);

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
    if (value === null) { notes.add(`O código usa ${token}, mas não há telefone válido cadastrado.`); html = html.split(token).join(token === "{{PHONE_DISPLAY}}" ? "" : maps); }
    else html = html.split(token).join(value);
  }

  const inline = /<script\b(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi;
  if (inline.test(html)) { notes.add("Scripts inline removidos (o JavaScript deve ficar em script.js)."); html = html.replace(inline, ""); }
  if (/\son[a-z]+\s*=/i.test(html)) { notes.add("Atributos de evento inline removidos."); html = html.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, ""); }

  html = html.replace(/<script\b[^>]*\bsrc=["']script\.js["'][^>]*>\s*<\/script>/gi, "");
  if (js) html = html.replace(/<\/body>/i, `<script src="script.js" defer></script>\n</body>`);

  if (!/name=["']robots["']/i.test(html)) html = html.replace(/<head([^>]*)>/i, `<head$1>\n<meta name="robots" content="noindex, nofollow">`);
  if (!html.includes(NOTICE_CLASS)) {
    const notice = `<p class="${NOTICE_CLASS}" role="note">Demonstração não oficial criada pela Sellora para ${escapeHtml(business.name)}. Imagens ilustrativas; informações a confirmar com o estabelecimento.</p>`;
    html = html.replace(/<body([^>]*)>/i, `<body$1>\n${notice}`);
  }
  return html;
}

/**
 * Prepara o código para gravar: o que sai daqui é exatamente o que a prévia mostra e o ZIP exporta.
 * Em cada página: substitui marcadores de contato (o telefone nunca é enviado ao modelo), aponta as imagens para os
 * arquivos reais, remove scripts inline e atributos de evento e insere o aviso de demonstração e o noindex.
 */
export function postprocessSite(input: PostprocessInput): ProcessedSite {
  const notes = new Set<string>();
  const js = input.code.js.trim();
  let css = input.code.css;
  for (const [id, finalPath] of input.assets) css = css.replace(new RegExp(`assets/${id}\\.(webp|png|jpg|jpeg|svg)`, "g"), finalPath);
  const pages: SitePage[] = [{ file: "index.html", html: processPage(input.code.html, input, js, notes) }];
  if (input.code.secondary) pages.push({ file: input.code.secondary.file, html: processPage(input.code.secondary.html, input, js, notes) });
  if (!css.includes(`.${NOTICE_CLASS}`)) css = `${css.trimEnd()}\n${NOTICE_CSS}`;
  if (!css.includes("/* Sellora: aviso obrigatório")) css = `${css.trimEnd()}\n${NOTICE_GUARD}`;
  return { html: pages[0].html, css, js, pages, notes: [...notes] };
}
