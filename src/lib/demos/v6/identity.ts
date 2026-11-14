import { normalizeCreativeText } from "../concepts";
import { HERO_ARCHETYPES, SECTION_FUNCTIONS, type SiteBrief, type VisualIdentity } from "./schema";

/**
 * Identidade visual estruturada de uma demo V6 e comparação entre demos.
 *
 * A comparação pesa mais os eixos estruturais (hero, esqueleto de seções, tipografia, imagem) do que os
 * superficiais (cor, CTA). Assim, trocar só a cor não torna uma demo "diferente", e coincidências comuns
 * (mesmo rótulo "Ver como chegar", mesma fonte de leitura) não reprovam sozinhas.
 * Pesos e limites calibrados com as 5 demos reais de teste de 2026-11-12 (ver identity.test.ts).
 */

export const IDENTITY_WEIGHTS = { hero: 0.22, sections: 0.2, typography: 0.16, palette: 0.12, image: 0.08, copy: 0.1, photo: 0.06, cta: 0.06 } as const;
type Dimension = keyof typeof IDENTITY_WEIGHTS;
/** Acima destes valores a demo é tratada como repetição (mesmo segmento / outro segmento). */
export const REPEAT_THRESHOLD = { sameSegment: 0.62, crossSegment: 0.72 } as const;
/** Acima destes valores fica registrada como "parecida" para revisão humana. */
export const SIMILAR_THRESHOLD = { sameSegment: 0.45, crossSegment: 0.5 } as const;

const FUNCTION_HINTS: [string, RegExp][] = [
  ["hero", /^(hero|inicio|topo|abertura|capa|home)/],
  ["rodape", /^(rodape|footer)/],
  ["perguntas", /(duvida|pergunta|faq)/],
  ["contato", /(contato|fale|whats|agend|reserv)/],
  ["localizacao", /(chegar|local|mapa|endereco|visita|onde)/],
  ["processo", /(atendimento|como|processo|etapa|passo|funciona)/],
  ["oferta", /(servico|cuidado|cardapio|menu|produto|oferta|trabalho|tratamento|catalogo|mesa|prato|corte)/],
  ["espaco", /(espaco|ambiente|casa|lugar|salao|loja|oficina|clinica|cozinha)/],
  ["galeria", /(galeria|fotos|imagens)/],
  ["diferenciais", /(diferencia|porque|por-que|motivo)/],
  ["chamada", /(faixa|chamada|cta|convite)/],
  ["apresentacao", /(sobre|apresenta|historia|quem)/],
];

/** Função de uma seção a partir do id (demos antigas, sem o campo `function`). */
export function sectionFunctionFromId(id: string): string {
  const clean = normalizeCreativeText(id).replace(/\s+/g, "-");
  if ((SECTION_FUNCTIONS as readonly string[]).includes(clean)) return clean;
  return FUNCTION_HINTS.find(([, pattern]) => pattern.test(clean))?.[0] ?? "apresentacao";
}

/** Arquétipo do hero: id explícito, marcado entre colchetes ou inferido das palavras (briefs antigos). */
export function heroArchetype(text: string | null | undefined): string | null {
  if (!text) return null;
  const tagged = text.match(/^\s*\[([a-z-]+)\]/i)?.[1]?.toLowerCase();
  if (tagged && (HERO_ARCHETYPES as readonly string[]).includes(tagged)) return tagged;
  if ((HERO_ARCHETYPES as readonly string[]).includes(text.trim())) return text.trim();
  const t = normalizeCreativeText(text);
  if (/ponta a ponta|full ?bleed|tela inteira|fundo fotografic/.test(t) && /painel|faixa|cartao|caixa|bloco|sobre/.test(t)) return "foto-painel";
  return null;
}

function luminance(color: string) {
  const [r, g, b] = color.slice(1).match(/../g)!.map((part) => {
    const value = parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Distância perceptual aproximada (CIE76 em Lab, 0 = igual, ~100 = preto x branco). */
export function colorDistance(a: string, b: string): number {
  const lab = (color: string) => {
    const [r, g, bl] = color.slice(1).match(/../g)!.map((part) => {
      const v = parseInt(part, 16) / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    const x = (r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047, y = r * 0.2126 + g * 0.7152 + bl * 0.0722, z = (r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883;
    const f = (t: number) => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const [l1, a1, b1] = lab(a), [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

const STOP = new Set(["de", "da", "do", "das", "dos", "em", "no", "na", "e", "o", "a", "os", "as", "para", "com", "um", "uma", "seu", "sua", "que", "por", "ao"]);
const words = (text: string) => normalizeCreativeText(text).split(" ").filter((word) => word.length > 2 && !STOP.has(word));
const PHOTO_TERMS = ["natureza-morta", "ambiente", "detalhe", "retrato", "maos", "close", "macro", "aerea", "plano aberto", "documental", "editorial", "luz natural", "luz quente", "luz fria", "contraluz", "noturna", "estudio", "grao", "monocromatica", "preto e branco", "ferramenta", "mesa", "bancada", "vitrine", "fachada", "interior", "exterior", "textura"];
function photoKeywords(text: string): string[] {
  const t = ` ${normalizeCreativeText(text).replace(/-/g, " ")} `;
  return PHOTO_TERMS.filter((term) => t.includes(` ${normalizeCreativeText(term).replace(/-/g, " ")} `)).slice(0, 10);
}

function categoryOf(font: string): string | null {
  const f = normalizeCreativeText(font);
  if (/mono|code/.test(f)) return "mono";
  if (/condensed|compressed|narrow|big shoulders|bebas|oswald|anton|barlow condensed|league gothic/.test(f)) return "condensada";
  if (/slab|zilla|roboto slab|arvo|bitter/.test(f)) return "slab";
  if (/script|hand|caveat|dancing|pacifico/.test(f)) return "manuscrita";
  if (/serif|garamond|playfair|fraunces|young serif|lora|cormorant|libre baskerville|dm serif|instrument serif|newsreader|spectral|crimson/.test(f) && !/sans/.test(f)) return "serifa";
  return null;
}

/** Identidade a partir do briefing (geração atual). `headline` já deve vir sem nome e cidade. */
export function identityFromBrief(brief: SiteBrief, headline = brief.copy.headline): VisualIdentity {
  const p = brief.direction.palette;
  const hero = brief.images.find((image) => brief.sections[0]?.imageId === image.id) ?? brief.images[0];
  return {
    v: 1,
    hero: brief.direction.heroArchetype,
    imageAspect: hero?.aspect ?? null,
    displayFont: brief.direction.displayFont.slice(0, 40),
    displayCategory: brief.direction.displayCategory,
    bodyFont: brief.direction.bodyFont.slice(0, 40),
    tone: luminance(p.background) < 0.2 ? "escuro" : "claro",
    background: p.background.toLowerCase(),
    accent: p.accent.toLowerCase(),
    sections: [...brief.sections, ...(brief.pages.secondary?.sections ?? [])].map((section) => section.function).slice(0, 16),
    pages: brief.pages.count,
    motion: brief.direction.motion,
    photo: photoKeywords(`${brief.direction.imageStyle} ${brief.images.map((image) => `${image.style} ${image.framing} ${image.light} ${image.subject}`).join(" ")}`),
    headline: normalizeCreativeText(headline).slice(0, 200),
    ctas: [brief.copy.primaryCta, brief.copy.secondaryCta].filter((cta): cta is string => !!cta).map((cta) => normalizeCreativeText(cta).slice(0, 40)),
  };
}

export interface IdentitySource { segment: string; identity?: VisualIdentity; fonts?: string[]; palette?: string[]; sections?: string[]; hero?: string; headline?: string }

/** Identidade parcial para demos antigas (só fontes, paleta, seções, hero e título). */
export function identityOf(source: IdentitySource): { identity: VisualIdentity; partial: boolean } {
  if (source.identity) return { identity: source.identity, partial: false };
  const palette = source.palette ?? [];
  const background = /^#[0-9a-f]{6}$/i.test(palette[0] ?? "") ? palette[0].toLowerCase() : "#ffffff";
  return {
    partial: true,
    identity: {
      v: 1, hero: heroArchetype(source.hero), imageAspect: null,
      displayFont: source.fonts?.[0] ?? "", displayCategory: source.fonts?.[0] ? categoryOf(source.fonts[0]) : null, bodyFont: source.fonts?.[1] ?? "",
      tone: luminance(background) < 0.2 ? "escuro" : "claro", background,
      accent: /^#[0-9a-f]{6}$/i.test(palette[4] ?? "") ? palette[4].toLowerCase() : background,
      sections: (source.sections ?? []).map(sectionFunctionFromId), pages: 1, motion: null, photo: [],
      headline: normalizeCreativeText(source.headline ?? ""), ctas: [],
    },
  };
}

function lcs(a: string[], b: string[]): number {
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i += 1) for (let j = 1; j <= b.length; j += 1) table[i][j] = a[i - 1] === b[j - 1] ? table[i - 1][j - 1] + 1 : Math.max(table[i - 1][j], table[i][j - 1]);
  return table[a.length][b.length];
}
const jaccard = (a: string[], b: string[]) => { const x = new Set(a), y = new Set(b); if (!x.size || !y.size) return null; return [...x].filter((v) => y.has(v)).length / new Set([...x, ...y]).size; };
const orientation = (aspect: string) => { const [w, h] = aspect.split(":").map(Number); return w > h * 1.1 ? "h" : h > w * 1.1 ? "v" : "q"; };

export interface IdentityComparison {
  score: number;
  dims: Partial<Record<Dimension, number>>;
  /** "cor": estrutura igual com troca de cor; "repetida"/"parecida" pelo limite do segmento. */
  verdict: "distinta" | "parecida" | "repetida" | "cor";
  reasons: string[];
}

/** Compara duas identidades. Dimensões desconhecidas (demos antigas) saem do cálculo, sem contar como diferença. */
export function compareIdentity(a: VisualIdentity, b: VisualIdentity, sameSegment: boolean): IdentityComparison {
  const dims: Partial<Record<Dimension, number>> = {};
  const reasons: string[] = [];
  if (a.hero && b.hero) { dims.hero = a.hero === b.hero ? 1 : 0; if (dims.hero) reasons.push(`mesmo hero [${a.hero}]`); }
  const core = (list: string[]) => list.filter((item) => item !== "rodape");
  if (a.sections.length && b.sections.length) {
    const x = core(a.sections), y = core(b.sections);
    dims.sections = (2 * lcs(x, y)) / (x.length + y.length || 1);
    if (dims.sections >= 0.8) reasons.push("mesmo esqueleto de seções");
  }
  if (a.displayFont && b.displayFont) {
    const display = normalizeCreativeText(a.displayFont) === normalizeCreativeText(b.displayFont) ? 1 : a.displayCategory && a.displayCategory === b.displayCategory ? 0.45 : 0;
    const body = a.bodyFont && normalizeCreativeText(a.bodyFont) === normalizeCreativeText(b.bodyFont) ? 1 : 0;
    dims.typography = 0.7 * display + 0.3 * body;
    if (display === 1) reasons.push(`mesma fonte de destaque (${a.displayFont})`);
  }
  {
    const bg = Math.max(0, 1 - colorDistance(a.background, b.background) / 45);
    const accent = Math.max(0, 1 - colorDistance(a.accent, b.accent) / 45);
    dims.palette = a.tone === b.tone ? 0.55 * bg + 0.45 * accent : Math.min(0.25, 0.55 * bg + 0.45 * accent);
  }
  if (a.imageAspect && b.imageAspect) dims.image = a.imageAspect === b.imageAspect ? 1 : orientation(a.imageAspect) === orientation(b.imageAspect) ? 0.6 : 0;
  const copy = jaccard(words(a.headline), words(b.headline));
  if (copy !== null) { dims.copy = copy; if (copy >= 0.6) reasons.push("título com a mesma construção"); }
  const photo = jaccard(a.photo, b.photo);
  if (photo !== null) dims.photo = photo;
  const cta = jaccard(a.ctas, b.ctas);
  if (cta !== null) dims.cta = cta;
  let total = 0, weight = 0;
  for (const [key, value] of Object.entries(dims) as [Dimension, number][]) { total += value * IDENTITY_WEIGHTS[key]; weight += IDENTITY_WEIGHTS[key]; }
  const score = weight ? Math.round((total / weight) * 100) / 100 : 0;
  const structural = ["hero", "sections", "typography", "image"].map((key) => dims[key as Dimension]).filter((value): value is number => value !== undefined);
  const structuralMean = structural.length >= 3 ? structural.reduce((s, v) => s + v, 0) / structural.length : 0;
  const repeat = sameSegment ? REPEAT_THRESHOLD.sameSegment : REPEAT_THRESHOLD.crossSegment;
  const similar = sameSegment ? SIMILAR_THRESHOLD.sameSegment : SIMILAR_THRESHOLD.crossSegment;
  const verdict = structuralMean >= 0.85 && (dims.palette ?? 1) < 0.5 ? "cor" : score >= repeat ? "repetida" : score >= similar ? "parecida" : "distinta";
  return { score, dims, verdict, reasons };
}

export interface OriginalityReport {
  /** Problemas que voltam ao modelo para replanejar o briefing. */
  issues: string[];
  /** Observações para a revisão humana (semelhanças moderadas, cobertura do histórico). */
  notes: string[];
  compared: number;
  partial: number;
  nearest: number | null;
}

/**
 * Compara a identidade nova com o histórico (mais novo primeiro). Além da comparação par a par, aplica regras
 * de acervo: fonte de destaque recente, fonte de leitura dominante, esqueleto de seções recorrente e arquétipo
 * de hero das duas demos mais recentes.
 */
export function originalityReport(current: VisualIdentity, segment: string, history: IdentitySource[]): OriginalityReport {
  const report: OriginalityReport = { issues: [], notes: [], compared: 0, partial: 0, nearest: null };
  const items = history.slice(0, 60).map((item) => ({ ...identityOf(item), segment: item.segment }));
  report.compared = items.length;
  report.partial = items.filter((item) => item.partial).length;
  let worst: { cmp: IdentityComparison; index: number; same: boolean } | null = null;
  for (const [index, item] of items.entries()) {
    const same = item.segment === segment;
    const cmp = compareIdentity(current, item.identity, same);
    if (!worst || cmp.score > worst.cmp.score) worst = { cmp, index, same };
    const where = `${same ? "do mesmo segmento" : "de outro segmento"} (${index + 1}ª mais recente, ${Math.round(cmp.score * 100)}% semelhante)`;
    if (cmp.verdict === "cor") report.issues.push(`A estrutura repete a demo ${where} e só a cor muda (${cmp.reasons.join(", ")}). Mude o arquétipo do hero, o esqueleto de seções e a tipografia.`);
    else if (cmp.verdict === "repetida") report.issues.push(`Parecida demais com a demo ${where}: ${cmp.reasons.join(", ") || "eixos estruturais próximos"}. Mude pelo menos dois eixos estruturais (hero, seções, tipografia, imagem).`);
    else if (cmp.verdict === "parecida") report.notes.push(`Semelhança moderada com a demo ${where}: ${cmp.reasons.join(", ") || "vários eixos próximos"}.`);
  }
  report.nearest = worst ? worst.cmp.score : null;

  const recent = items.slice(0, 2).map((item) => item.identity.hero).filter(Boolean);
  if (current.hero && recent.includes(current.hero)) report.issues.push(`O hero repete o arquétipo [${current.hero}] de uma das duas demos mais recentes; escolha outro arquétipo.`);
  const display = normalizeCreativeText(current.displayFont);
  const recentDisplay = items.slice(0, 4).filter((item) => normalizeCreativeText(item.identity.displayFont) === display).length;
  const segmentDisplay = items.filter((item) => item.segment === segment).slice(0, 12).filter((item) => normalizeCreativeText(item.identity.displayFont) === display).length;
  if (display && (recentDisplay || segmentDisplay)) report.issues.push(`A fonte de destaque ${current.displayFont} já aparece ${segmentDisplay ? "em demos do mesmo segmento" : "entre as quatro demos mais recentes"}; escolha outra família com o mesmo papel.`);
  const body = normalizeCreativeText(current.bodyFont);
  const recentBody = items.slice(0, 4).filter((item) => normalizeCreativeText(item.identity.bodyFont) === body).length;
  if (body && recentBody >= 2) report.issues.push(`A fonte de leitura ${current.bodyFont} já foi usada em ${recentBody} das quatro demos mais recentes; varie a família de leitura.`);
  const skeleton = (list: string[]) => list.filter((item) => !["hero", "contato", "rodape"].includes(item)).join(">");
  const mine = skeleton(current.sections);
  const sameSkeleton = items.slice(0, 6).filter((item) => item.identity.sections.length && skeleton(item.identity.sections) === mine).length;
  if (mine && sameSkeleton >= 2) report.issues.push(`A sequência de funções das seções (${mine}) já apareceu em ${sameSkeleton} das seis demos mais recentes; reorganize as seções a partir da necessidade deste negócio.`);
  if (!items.length) report.notes.push("Sem histórico V6 acessível para comparar; originalidade conferida só contra regras gerais.");
  else if (report.partial) report.notes.push(`${report.partial} de ${items.length} demos do histórico não têm identidade completa (geradas antes da assinatura estruturada): comparadas só por hero, fontes, paleta, seções e título.`);
  report.issues = [...new Set(report.issues)];
  report.notes = [...new Set(report.notes)].slice(0, 10);
  return report;
}
