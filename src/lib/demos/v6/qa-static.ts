import { normalizeCreativeText } from "../concepts";
import { NOTICE_CLASS, type SitePage } from "./postprocess";
import type { SiteBrief } from "./schema";

/**
 * Verificações estáticas (sem navegador) aplicadas antes de marcar a demo como concluída.
 * critical: impede a entrega · fixable: volta ao modelo numa rodada de correção · warnings: ficam no relatório.
 * As heurísticas de texto usam limites de palavra sobre o texto visível normalizado (sem nome e cidade do negócio),
 * para não reprovar palavras que só contêm o termo ("relevante" não é "eleve").
 */
export interface StaticQa { critical: string[]; fixable: string[]; warnings: string[] }
export interface QaSite { html: string; css: string; js: string; pages?: SitePage[] }

function luminance(color: string) {
  const [r, g, b] = color.slice(1).match(/../g)!.map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export const contrast = (a: string, b: string) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/** Expressões genéricas de marketing (normalizadas, sem acento). Conferidas como palavras inteiras. */
export const STOCK_PHRASES = [
  "experiencia unica", "excelencia em cada detalhe", "excelencia", "transformando sonhos", "mais do que um servico", "mais do que um", "qualidade e tradicao",
  "sua jornada comeca aqui", "jornada", "inesquecivel", "transforme", "eleve", "de qualidade", "o melhor da cidade", "paixao", "venha conferir", "seu momento",
  "cuidado especial", "atendimento diferenciado", "nao e apenas", "nao e so", "a arte de", "o sabor da tradicao", "solucoes completas", "compromisso com a qualidade",
  "satisfacao garantida", "referencia em", "padrao de qualidade",
];
const STOCK_PATTERNS = STOCK_PHRASES.map((phrase) => ({ phrase, pattern: new RegExp(`(^| )${phrase.replace(/ /g, " ")}( |$)`) }));

/** Fatos comerciais que o cadastro nunca confirma. Cada padrão traz o motivo mostrado ao modelo. */
export const INVENTED_FACTS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(h[aá]|mais de|quase)\s+\d+\s+anos\b/i, label: "tempo de mercado" },
  { pattern: /\b\d+\s+anos\s+de\s+(experi|mercado|tradi|hist|atua)/i, label: "anos de experiência" },
  { pattern: /\bdesde\s+(19|20)\d{2}\b/i, label: "ano de fundação" },
  { pattern: /\bfundad[oa]\s+em\b/i, label: "fundação" },
  { pattern: /\b(premiad[oa]s?|pr[eê]mios?|vencedor(a|es)?)\b/i, label: "prêmio" },
  { pattern: /\b(certificad[oa]s?|credenciad[oa]s?|selo de)\b/i, label: "certificação" },
  { pattern: /\b(CRM|CRO|CRMV|CREA|OAB|CNPJ)\b/, label: "registro profissional" },
  { pattern: /(\b\d[.,]\d\s*(estrelas|\/\s*5)\b|\b\d+\s+estrelas\b|★|\bnota\s+\d)/i, label: "avaliação" },
  { pattern: /\b(depoimentos?|o que (nossos|os) clientes dizem)\b/i, label: "depoimento" },
  { pattern: /\b\d[\d.]*\s*(\+\s*)?(mil\s+)?(clientes|pacientes|alunos|atendimentos|pets|carros|ve[ií]culos|pedidos)\b/i, label: "número de clientes" },
  { pattern: /\bclientes satisfeitos\b/i, label: "clientes satisfeitos" },
  { pattern: /R\$\s*\d|\ba partir de\s+R?\$\s*\d/i, label: "preço" },
  { pattern: /\b(seg|ter|qua|qui|sex|s[aá]b|dom)[a-zç]*\.?\s*(a|-|–|à)\s*(seg|ter|qua|qui|sex|s[aá]b|dom)/i, label: "dias de funcionamento" },
  { pattern: /\b\d{1,2}\s?h(\d{2})?\s*(às|as|-|–|até)\s*\d{1,2}\s?h/i, label: "horário" },
  { pattern: /\b(aberto|abrimos|funcionamos)\s+(todos os dias|de segunda|24 ?h)/i, label: "horário" },
  { pattern: /\b(Rua|R\.|Av\.?|Avenida|Travessa|Alameda|Rodovia|Estrada|Praça)\s+(d[aeo]s?\s+)?[A-ZÁÉÍÓÚÂÊÔ0-9]/, label: "endereço" },
  { pattern: /\bCEP\b|\b\d{5}-\d{3}\b/, label: "endereço" },
  { pattern: /\b(Dr|Dra)\.?\s+[A-ZÁÉÍÓÚ][a-zá-ú]+/, label: "nome de profissional" },
  { pattern: /\bnossa equipe de \d+/i, label: "tamanho da equipe" },
  { pattern: /\b(garantia de|orçamento (gr[aá]tis|gratuito|sem compromisso)|entrega (gr[aá]tis|gratuita|em \d))/i, label: "condição comercial" },
];
const PLACEHOLDERS = [/lorem ipsum/i, /\bTODO\b/, /\bXXX\b/, /seu texto aqui/i, /\{\{[A-Z_]+\}\}/, /\[(nome|cidade|telefone|endereço|endereco)[^\]]*\]/i];
const ALLOWED_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com", "wa.me", "www.google.com", "maps.google.com"];
const LAYOUT_PROPS = /\b(width|height|top|left|right|bottom|margin(-[a-z]+)?|padding(-[a-z]+)?|font-size)\b/;

export function headlineOf(html: string): string {
  return visibleText(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
}

export function visibleText(html: string): string {
  return html.replace(/<(script|style|svg)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

/** Texto visível sem o aviso da Sellora e sem os campos do cadastro (nome e cidade não são fatos inventados). */
function contentText(html: string, business?: { name: string; city: string }): string {
  let text = visibleText(html.replace(new RegExp(`<p class="${NOTICE_CLASS}"[\\s\\S]*?</p>`, "i"), " "));
  for (const field of [business?.name, business?.city]) if (field) text = text.split(field).join(" ");
  return text;
}

const families = (html: string) => [...html.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'>\s]+)/gi)].flatMap((m) => [...m[1].replace(/&amp;/g, "&").matchAll(/family=([^:&]+)/g)].map((f) => decodeURIComponent(f[1]).replace(/\+/g, " ").trim().toLowerCase()));
const excerpt = (text: string, pattern: RegExp) => { const m = text.match(pattern); if (!m || m.index === undefined) return ""; return text.slice(Math.max(0, m.index - 25), m.index + m[0].length + 25).trim(); };

function cssRules(css: string): { selector: string; body: string; media: string }[] {
  const rules: { selector: string; body: string; media: string }[] = [];
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const walk = (block: string, media: string) => {
    let depth = 0, start = 0, selectorStart = 0;
    for (let i = 0; i < block.length; i += 1) {
      if (block[i] === "{") { if (depth === 0) { start = i; } depth += 1; }
      else if (block[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          const selector = block.slice(selectorStart, start).trim();
          const body = block.slice(start + 1, i);
          if (selector.startsWith("@media") || selector.startsWith("@supports")) walk(body, `${media} ${selector}`);
          else if (!selector.startsWith("@keyframes") && !selector.startsWith("@font-face")) rules.push({ selector, body, media });
          selectorStart = i + 1;
        }
      }
    }
  };
  walk(clean, "");
  return rules;
}

function pageQa(page: SitePage, site: QaSite, brief: SiteBrief, assets: string[], pageFiles: string[], business: { name: string; city: string } | undefined, qa: StaticQa) {
  const html = page.html;
  const at = pageFiles.length > 1 ? `[${page.file}] ` : "";
  const text = contentText(html, business);

  if (!/^\s*<!doctype html>/i.test(html)) qa.fixable.push(`${at}Comece o arquivo com <!doctype html>.`);
  if (!/<html[^>]*\blang=["']pt-BR["']/i.test(html)) qa.fixable.push(`${at}Use <html lang="pt-BR">.`);
  if (!/<meta[^>]+name=["']viewport["']/i.test(html)) qa.fixable.push(`${at}Inclua a meta viewport.`);
  if (!/<title>[^<]{3,}<\/title>/i.test(html)) qa.fixable.push(`${at}Inclua um <title> descritivo.`);
  if (!/<meta[^>]+name=["']description["']/i.test(html)) qa.warnings.push(`${at}Sem meta description.`);
  const h1 = (html.match(/<h1\b/gi) ?? []).length;
  if (h1 !== 1) qa.fixable.push(`${at}A página deve ter exatamente um h1 (encontrados: ${h1}).`);
  if (!/<link[^>]+href=["']styles\.css["']/i.test(html)) qa.critical.push(`${at}O HTML não carrega styles.css.`);
  if (!html.includes(NOTICE_CLASS)) qa.critical.push(`${at}Aviso de demonstração ausente.`);
  for (const tag of ["main", "header", "footer"]) if (!new RegExp(`<${tag}\\b`, "i").test(html)) qa.fixable.push(`${at}Falta o elemento <${tag}>.`);

  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  for (let i = 1; i < levels.length; i += 1) if (levels[i] > levels[i - 1] + 1) { qa.fixable.push(`${at}Títulos fora de ordem: h${levels[i - 1]} seguido de h${levels[i]}.`); break; }
  const ids = [...html.matchAll(/\bid=["']([^"']+)["']/gi)].map((m) => m[1]);
  const duplicated = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  if (duplicated.length) qa.fixable.push(`${at}ids repetidos: ${duplicated.slice(0, 4).join(", ")}.`);
  const h2 = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => normalizeCreativeText(visibleText(m[1]))).filter(Boolean);
  const sameH2 = [...new Set(h2.filter((title, index) => h2.indexOf(title) !== index))];
  if (sameH2.length) qa.fixable.push(`${at}Seções com o mesmo título (seção duplicada?): ${sameH2.slice(0, 3).join(", ")}.`);
  const sectionCount = (html.match(/<section\b/gi) ?? []).length;
  if (sectionCount < 2) qa.fixable.push(`${at}A página tem ${sectionCount} <section>; organize o conteúdo em seções com id.`);

  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  for (const [index, img] of images.entries()) {
    if (!/\balt=["'][^"']+["']/i.test(img)) qa.fixable.push(`${at}Toda imagem precisa de alt descritivo.`);
    if (!/\bwidth=["']?\d+/i.test(img) || !/\bheight=["']?\d+/i.test(img)) qa.fixable.push(`${at}Imagem sem width e height (o layout pula ao carregar).`);
    if (index === 0 && page.file === "index.html" && /loading=["']lazy["']/i.test(img)) qa.fixable.push(`${at}A imagem da primeira tela não pode ter loading="lazy".`);
    if (index > 0 && !/loading=["']lazy["']/i.test(img)) qa.warnings.push(`${at}Imagens fora da primeira tela deveriam usar loading="lazy".`);
  }

  const refs = [...html.matchAll(/\b(?:src|href)=["']([^"']*)["']/gi)].map((m) => m[1].trim());
  const anchorsOf = (file: string) => new Set([...(site.pages?.find((p) => p.file === file)?.html ?? (file === page.file ? html : "")).matchAll(/\bid=["']([^"']+)["']/gi)].map((m) => m[1]));
  const own = new Set(ids);
  for (const ref of refs) {
    if (ref === "" || ref === "#") { qa.fixable.push(`${at}Link sem destino (href vazio ou "#").`); continue; }
    if (ref.startsWith("#")) { if (!own.has(ref.slice(1))) qa.fixable.push(`${at}Âncora ${ref} sem seção correspondente.`); continue; }
    if (/^(tel:|mailto:)/i.test(ref) || ref.startsWith("data:")) continue;
    if (/^https?:\/\//i.test(ref)) {
      let host = "";
      try { host = new URL(ref).hostname; } catch { qa.fixable.push(`${at}Endereço externo inválido: ${ref.slice(0, 60)}.`); continue; }
      if (!ALLOWED_HOSTS.includes(host)) qa.fixable.push(`${at}Recurso ou link externo não permitido: ${host}.`);
      continue;
    }
    if (/^(\/|[a-z]:|\.\.|file:|javascript:)/i.test(ref) || ref.includes("/api/") || ref.includes("localhost")) { qa.critical.push(`${at}Referência não portátil: ${ref.slice(0, 80)}.`); continue; }
    const [file, anchor] = ref.split("#");
    const clean = file.split("?")[0];
    if (/\.html$/i.test(clean)) {
      if (!pageFiles.includes(clean)) { qa.critical.push(`${at}Link para página inexistente: ${clean}.`); continue; }
      if (anchor && !anchorsOf(clean).has(anchor)) qa.fixable.push(`${at}Link ${ref} aponta para uma seção que não existe em ${clean}.`);
      continue;
    }
    if (!["styles.css", "script.js", ...assets].includes(clean)) qa.fixable.push(`${at}Arquivo referenciado não existe: ${clean}.`);
  }
  for (const link of html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)) if (!/rel=["'][^"']*noopener/i.test(link[0])) { qa.fixable.push(`${at}Links com target="_blank" precisam de rel="noopener".`); break; }
  if (/<script\b[^>]+src=["']https?:/i.test(html)) qa.critical.push(`${at}Script externo não é permitido.`);
  if (/<(iframe|form|object|embed|video|audio)\b/i.test(html)) qa.fixable.push(`${at}Remova iframes, formulários, vídeos e objetos incorporados.`);
  if (/<blockquote\b/i.test(html)) qa.fixable.push(`${at}Citação/depoimento (<blockquote>) não confirmado no cadastro; remova.`);
  for (const pattern of PLACEHOLDERS) if (pattern.test(text) || pattern.test(html)) qa.fixable.push(`${at}Texto de preenchimento encontrado (${pattern.source}).`);
  const normalized = ` ${normalizeCreativeText(text)} `;
  for (const { phrase, pattern } of STOCK_PATTERNS) if (pattern.test(normalized)) qa.fixable.push(`${at}Expressão genérica de marketing: "${phrase}". Reescreva com algo específico do negócio.`);
  for (const { pattern, label } of INVENTED_FACTS) if (pattern.test(text)) qa.fixable.push(`${at}Possível fato não confirmado (${label}): "${excerpt(text, pattern)}". Remova ou reescreva sem afirmar dados que não estão no cadastro.`);
  const dashes = (text.match(/—/g) ?? []).length;
  if (dashes > 3) qa.fixable.push(`${at}Travessões demais no texto (${dashes}); use frases diretas.`);

  const fonts = families(html);
  if (!fonts.length) qa.fixable.push(`${at}A página não carrega as fontes do briefing pelo Google Fonts.`);
  else {
    if (fonts.length > 2) qa.fixable.push(`${at}Mais de duas famílias tipográficas carregadas (${fonts.join(", ")}).`);
    for (const font of [brief.direction.displayFont, brief.direction.bodyFont]) if (!fonts.includes(font.toLowerCase())) qa.fixable.push(`${at}A fonte ${font} do briefing não é carregada.`);
    if (!/display=swap/.test(html)) qa.warnings.push(`${at}Google Fonts sem display=swap.`);
    if (!/rel=["']preconnect["'][^>]*fonts\.gstatic\.com|fonts\.gstatic\.com[^>]*rel=["']preconnect["']/i.test(html)) qa.warnings.push(`${at}Sem preconnect para fonts.gstatic.com.`);
  }

  // Estrutura genérica: seções feitas de cards de ícone + título + texto.
  const sections = [...html.matchAll(/<section\b[\s\S]*?<\/section>/gi)].map((m) => m[0]);
  const iconGrids = sections.filter((section) => [...section.matchAll(/<svg\b[\s\S]{0,600}?<h3\b/gi)].length >= 3).length;
  if (iconGrids >= 2) qa.fixable.push(`${at}${iconGrids} seções montadas com cards de ícone + título + texto; varie a composição.`);
  else if (iconGrids === 1) qa.warnings.push(`${at}Uma seção usa grade de cards com ícone; confira se a composição é necessária.`);
  if (/<(p|span|div)\b[^>]*class=["'][^"']*\b(eyebrow|kicker|overline)\b[^"']*["']/i.test(html)) qa.warnings.push(`${at}Rótulo pequeno acima de títulos (eyebrow) é recusado pelo guia.`);
  if (/>\s*0[1-9]\s*<\/(span|small|p|div)>/i.test(html)) qa.warnings.push(`${at}Numeração de seções (01, 02…) só quando a ordem informa algo.`);
}

export function staticQa(site: QaSite, brief: SiteBrief, assets: string[], history: { headline: string; texts: string[] }[], business?: { name: string; city: string }): StaticQa {
  const { css, js } = site;
  const pages = site.pages?.length ? site.pages : [{ file: "index.html", html: site.html }];
  const pageFiles = pages.map((page) => page.file);
  const qa: StaticQa = { critical: [], fixable: [], warnings: [] };

  if (pages.length > 2) qa.critical.push("A demo tem mais de duas páginas.");
  for (const page of pages) pageQa(page, site, brief, assets, pageFiles, business, qa);
  // Cada imagem gerada custa cota do Codex: todas precisam aparecer em alguma página (img ou fundo no CSS).
  const used = `${pages.map((page) => page.html).join(" ")} ${css}`;
  for (const asset of assets) if (!used.includes(asset)) qa.fixable.push(`A imagem ${asset} foi gerada para a demo, mas não aparece em nenhuma página; use-a na seção planejada.`);
  const secondary = pages[1];
  if (brief.pages.count === 2 && !secondary) qa.fixable.push(`O briefing prevê a página ${brief.pages.secondary?.file ?? "secundária"}, mas ela não foi entregue.`);
  if (secondary) {
    if (!new RegExp(`href=["']${secondary.file.replace(".", "\\.")}(#[^"']*)?["']`).test(pages[0].html)) qa.fixable.push(`O início não tem link para ${secondary.file}.`);
    if (!/href=["']index\.html(#[^"']*)?["']/.test(secondary.html)) qa.fixable.push(`[${secondary.file}] Falta o link de volta para index.html.`);
    if ((pages[0].html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "a") === (secondary.html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? "b")) qa.warnings.push("As duas páginas têm o mesmo <title>.");
  }

  const ownCss = css.replace(/\/\* Sellora: aviso[\s\S]*$/, "");
  if (!/@media/.test(ownCss)) qa.fixable.push("O CSS não tem regras responsivas (@media).");
  if (/(transition|animation)\s*:/.test(ownCss) && !/prefers-reduced-motion/.test(ownCss)) qa.fixable.push("Animações sem @media (prefers-reduced-motion: reduce).");
  if (/transition\s*:\s*all\b|transition-property\s*:\s*all\b/.test(ownCss)) qa.fixable.push("Evite transition: all; anime só transform e opacity.");
  for (const m of ownCss.matchAll(/transition(-property)?\s*:\s*([^;}]+)/g)) if (LAYOUT_PROPS.test(m[2].replace(/cubic-bezier\([^)]*\)/g, ""))) { qa.fixable.push(`Transição em propriedade de layout (${m[2].trim().slice(0, 60)}); anime transform ou opacity.`); break; }
  for (const m of ownCss.matchAll(/@keyframes\s+([\w-]+)\s*\{([\s\S]*?\})\s*\}/g)) if (/(^|[{;\s])(width|height|top|left|right|bottom|margin|padding)\s*:/.test(m[2])) { qa.fixable.push(`A animação ${m[1]} altera propriedades de layout; use transform/opacity.`); break; }
  // Loop discreto em elemento gráfico é aceitável se parar com movimento reduzido (o navegador confere de verdade).
  if (/animation(-iteration-count)?\s*:[^;}]*\binfinite\b/.test(ownCss)) {
    if (/prefers-reduced-motion/.test(ownCss)) qa.warnings.push("Animação infinita: só em elemento gráfico decorativo, lenta e sutil, nunca em texto ou botão.");
    else qa.fixable.push("Animação infinita sem @media (prefers-reduced-motion: reduce) que a pare.");
  }
  const keyframes = (ownCss.match(/@keyframes\b/g) ?? []).length;
  if (keyframes > 6) qa.warnings.push(`${keyframes} animações @keyframes; confira se cada uma tem propósito.`);
  // Movimento planejado precisa existir no código: "moderada" e "expressiva" pedem revelação ao rolar ou coreografia.
  if (brief.direction.motion !== "calma") {
    const scrollReveal = /IntersectionObserver/.test(js) || /animation-timeline\s*:\s*view\(/.test(ownCss);
    const entrance = /@keyframes\b/.test(ownCss) || /\.js\b[^{]*\{[^}]*(opacity|transform)/.test(ownCss);
    if (!scrollReveal || !entrance) qa.fixable.push(`O briefing planeja movimento "${brief.direction.motion}", mas o código não tem ${!scrollReveal ? "revelação suave ao rolar (IntersectionObserver em script.js, estado inicial dentro de .js)" : "entrada coreografada do hero"}. Implemente o plano de movimento com transform/opacity e fallback sem JavaScript.`);
  }
  if (/background-clip\s*:\s*text|-webkit-background-clip\s*:\s*text/.test(ownCss)) qa.fixable.push("Texto com gradiente (background-clip: text) é recusado pelo guia.");
  if (/\bease-in\b(?!-)/.test(ownCss)) qa.warnings.push("ease-in em interface parece lento; prefira ease-out.");
  if (/100vh/.test(ownCss) && !/svh|dvh/.test(ownCss)) qa.warnings.push("Use 100svh/100dvh no celular em vez de só 100vh.");
  if (!/:focus-visible/.test(ownCss)) qa.fixable.push("Sem estilo de :focus-visible; o foco do teclado precisa ser visível com a paleta.");
  if (/:hover/.test(ownCss) && !/hover\s*:\s*hover/.test(ownCss)) qa.warnings.push("Estados :hover fora de @media (hover: hover) and (pointer: fine) disparam no toque.");
  const hiding = cssRules(ownCss).filter((rule) => /(^|;|\s)opacity\s*:\s*0(\s*[;}]|\s*$)/.test(rule.body) && !/prefers-reduced-motion/.test(rule.media)
    && !/(^|[\s,])(html|:root)?\.js\b|\[data-js|\.is-|\[hidden\]|\[aria-hidden|nav|menu|drawer|overlay|dialog|::(before|after)|:not\(/.test(rule.selector));
  if (hiding.length && js) qa.warnings.push(`Elementos começam invisíveis sem depender de .js (${hiding.slice(0, 2).map((rule) => rule.selector.slice(0, 40)).join("; ")}); sem JavaScript eles somem.`);
  const fontFamilies = new Set([...ownCss.matchAll(/font-family\s*:\s*([^;}]+)/g)].map((m) => m[1].split(",")[0].trim().replace(/["']/g, "").toLowerCase()).filter((f) => !/^(var\(|inherit|serif|sans-serif|monospace|system-ui|ui-)/.test(f)));
  if (fontFamilies.size > 3) qa.warnings.push(`CSS declara ${fontFamilies.size} famílias tipográficas; a escala deve usar as duas do briefing.`);

  if (/(fetch\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|document\.cookie|eval\(|new Function|WebSocket|navigator\.sendBeacon|import\()/.test(js)) qa.critical.push("script.js usa APIs não permitidas (rede, armazenamento ou eval).");
  if (/addEventListener\(\s*["'](wheel|mousewheel|touchmove)["'][\s\S]{0,400}preventDefault/.test(js)) qa.fixable.push("O script bloqueia a rolagem (wheel/touchmove com preventDefault); não sequestre a rolagem.");
  if (js.length > 12_000) qa.warnings.push(`script.js com ${Math.round(js.length / 1000)} KB; mantenha o JavaScript mínimo.`);
  for (const page of pages) for (const button of page.html.matchAll(/<button\b([^>]*)>/gi)) {
    const attrs = button[1];
    if (!/type=/.test(attrs)) qa.warnings.push("Botões sem type=\"button\".");
    const hooks = [...attrs.matchAll(/\b(id|class|data-[a-z-]+|aria-controls|aria-expanded)=["']([^"']*)["']/g)].flatMap((m) => m[1] === "class" ? m[2].split(/\s+/) : m[1] === "id" ? [m[2]] : [m[1], m[2]]);
    if (!hooks.some((hook) => hook && js.includes(hook))) qa.fixable.push("Há <button> sem ação no script.js; use um link ou ligue o botão a uma ação real.");
  }

  const p = brief.direction.palette;
  if (contrast(p.background, p.ink) < 4.5) qa.fixable.push("Contraste entre fundo e texto abaixo de 4,5:1.");
  if (contrast(p.surface, p.ink) < 4.5) qa.fixable.push("Contraste entre superfície e texto abaixo de 4,5:1.");
  if (contrast(p.background, p.muted) < 4.5) qa.fixable.push("Texto secundário com contraste abaixo de 4,5:1 sobre o fundo.");
  if (contrast(p.accent, p.accentInk) < 4.5) qa.fixable.push("Contraste do texto sobre a cor de destaque abaixo de 4,5:1.");

  const headline = normalizeCreativeText(headlineOf(pages[0].html));
  const allText = ` ${normalizeCreativeText(pages.map((page) => contentText(page.html, business)).join(" "))} `;
  for (const previous of history) {
    if (headline.length > 10 && normalizeCreativeText(previous.headline) === headline) qa.fixable.push("Título principal igual ao de uma demo anterior.");
    for (const sentence of previous.texts) if (sentence.length >= 40 && allText.includes(normalizeCreativeText(sentence))) { qa.fixable.push("Trecho de texto repetido de uma demo anterior."); break; }
  }
  if (pages.some((page) => page.html.length > 200_000) || css.length > 150_000) qa.warnings.push("Arquivos grandes demais para uma demo; simplifique.");
  qa.critical = [...new Set(qa.critical)];
  qa.fixable = [...new Set(qa.fixable)];
  qa.warnings = [...new Set(qa.warnings)];
  return qa;
}
