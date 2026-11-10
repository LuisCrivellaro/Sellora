import type { Segment } from "../types";
import type { Classification, Confidence, Evidence, Presence, ProspectResult, ScorePart, SiteCheck } from "./types";

/**
 * Classificação HOT/WARM/LOW/SKIP e score 0–100 (critérios documentados em
 * .claude/skills/local-client-prospector/SKILL.md). Funções puras: mesma
 * entrada, mesmo resultado — cobertas por testes.
 */

export interface Candidate {
  id: string;
  name: string;
  category: string;
  segment: Segment;
  city: string;
  uf: string;
  address: string;
  addressComplete: boolean;
  distanceKm: number | null;
  phone: string;
  email: string;
  /** URL declarada pela fonte (pode ser rede social). */
  website: string;
  instagram: string;
  otherSocials: string[];
  openingHours: string;
  brand: string | null;
  closed: boolean;
  sourceLabel: string;
  sourceUrl: string;
}

const SOCIAL_HOSTS: Record<string, string> = {
  "instagram.com": "Instagram",
  "facebook.com": "Facebook",
  "fb.com": "Facebook",
  "fb.me": "Facebook",
  "wa.me": "WhatsApp",
  "whatsapp.com": "WhatsApp",
  "linktr.ee": "Linktree",
  "tiktok.com": "TikTok",
  "twitter.com": "X/Twitter",
  "x.com": "X/Twitter",
  "youtube.com": "YouTube",
  "linkedin.com": "LinkedIn",
  "ifood.com.br": "iFood",
  "goomer.app": "Goomer",
  "anota.ai": "Anota AI",
  "booksy.com": "Booksy",
  "trinks.com": "Trinks",
  "doctoralia.com.br": "Doctoralia",
  "business.site": "Google Sites (desativado)",
  "g.page": "Google Maps",
  "maps.google.com": "Google Maps",
  "goo.gl": "Link encurtado do Google",
  "mercadolivre.com.br": "Mercado Livre",
  "shopee.com.br": "Shopee",
};

const FREE_HOSTS = ["wixsite.com", "wordpress.com", "blogspot.com", "weebly.com", "webnode.page", "webnode.com.br", "squarespace.com", "sites.google.com", "netlify.app", "vercel.app", "github.io", "carrd.co", "site123.me", "godaddysites.com"];

export function hostOf(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    return u.hostname.toLowerCase().replace(/^www\./, "").replace(/^m\./, "");
  } catch {
    return null;
  }
}

function matchHost(host: string, list: string[]): string | null {
  return list.find((h) => host === h || host.endsWith(`.${h}`)) ?? null;
}

/** Plataforma social/marketplace a que a URL pertence, ou null se for site próprio. */
export function socialPlatform(url: string): string | null {
  const host = hostOf(url);
  if (!host) return null;
  const key = matchHost(host, Object.keys(SOCIAL_HOSTS));
  if (key) return SOCIAL_HOSTS[key];
  if (host === "google.com" && /\/maps/.test(url)) return "Google Maps";
  return null;
}

export function freeHostOf(url: string): string | null {
  const host = hostOf(url);
  return host ? matchHost(host, FREE_HOSTS) : null;
}

/** "@perfil" a partir de URL ou texto livre do Instagram. */
export function instagramHandle(value: string): string {
  const v = value.trim();
  if (!v) return "";
  const m = v.match(/instagram\.com\/([A-Za-z0-9._]{1,30})/i);
  const raw = m ? m[1] : v.replace(/^@/, "");
  if (!/^[A-Za-z0-9._]{1,30}$/.test(raw) || ["p", "reel", "explore", "accounts"].includes(raw.toLowerCase())) return "";
  return `@${raw}`;
}

/** Problemas verificáveis a partir da conferência HTTP. */
export function siteProblems(check: SiteCheck, now = new Date()): string[] {
  if (!check.reachable) return [`Site não respondeu (${check.error ?? (check.httpStatus ? `HTTP ${check.httpStatus}` : "sem resposta")})`];
  if (check.blocked) return [];
  const out: string[] = [];
  const analyzed = check.hasViewport !== null;
  if (!check.https) out.push("Sem HTTPS: o navegador mostra o aviso \"Não seguro\"");
  if (check.hasViewport === false) out.push("Sem meta viewport: a página não declara adaptação para celular");
  if (check.copyrightYear && check.copyrightYear <= now.getFullYear() - 3) out.push(`Rodapé com © ${check.copyrightYear}: indício de conteúdo sem atualização`);
  if (check.hasPhoneLink === false) out.push("Sem link clicável de telefone ou WhatsApp na página inicial");
  if (check.freeHost) out.push(`Domínio gratuito de construtor de sites (${check.freeHost})`);
  if (analyzed && !check.scriptRendered && !check.title) out.push("Página inicial sem título (<title>)");
  return out;
}

export function presenceOf(c: Candidate, check: SiteCheck | null): Presence {
  if (!c.website) return c.instagram || c.otherSocials.length ? "so_redes" : "sem_site";
  if (socialPlatform(c.website)) return "so_redes";
  if (!check) return "site_com_problemas";
  return siteProblems(check).length ? "site_com_problemas" : "site_adequado";
}

export const classificationMeta: Record<Classification, { label: string; description: string }> = {
  HOT: { label: "HOT", description: "Sem site próprio" },
  WARM: { label: "WARM", description: "Site com problemas verificáveis" },
  LOW: { label: "LOW", description: "Presença adequada" },
  SKIP: { label: "SKIP", description: "Duplicado, insuficiente ou irrelevante" },
};

export const presenceLabel: Record<Presence, string> = {
  sem_site: "Sem site registrado",
  so_redes: "Só redes sociais",
  site_com_problemas: "Site com problemas",
  site_adequado: "Site adequado",
};

interface Context {
  radiusKm: number;
  now?: Date;
  /** Nome do registro anterior quando este é duplicado dentro da mesma pesquisa. */
  duplicateOf?: string | null;
}

function skipReason(c: Candidate, duplicateOf?: string | null): string | null {
  if (c.closed) return "Marcado como fechado ou desativado na fonte";
  if (!c.name.trim()) return "Sem nome na fonte";
  if (c.brand) return `Rede ou franquia (${c.brand}): fora do público da Sellora`;
  if (duplicateOf) return `Duplicado de "${duplicateOf}" nesta pesquisa`;
  if (!c.phone && !c.email && !c.website && !c.instagram && !c.otherSocials.length) return "Dados insuficientes: nenhum canal de contato público";
  return null;
}

/** Calcula classe, score, confiança, diagnóstico, justificativa e evidências. */
export function classify(c: Candidate, check: SiteCheck | null, ctx: Context): ProspectResult {
  const now = ctx.now ?? new Date();
  const checkedAt = check?.checkedAt ?? now.toISOString();
  const social = c.website ? socialPlatform(c.website) : null;
  const ownSite = c.website && !social ? c.website : "";
  const instagram = c.instagram || (social === "Instagram" ? instagramHandle(c.website) : "");
  const otherSocials = [...c.otherSocials, ...(social && social !== "Instagram" ? [c.website] : [])];
  const presence = presenceOf({ ...c, instagram, otherSocials }, check);
  const problems = ownSite && check ? siteProblems(check, now) : [];
  const evidence: Evidence[] = [{ claim: `${c.name} (${c.category}) cadastrado em ${c.sourceLabel}`, status: "fonte", source: c.sourceLabel }];
  const sources = [{ label: c.sourceLabel, url: c.sourceUrl }];

  if (c.distanceKm !== null) evidence.push({ claim: `A ${c.distanceKm.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km do centro de ${c.city}`, status: "verificado", source: "Cálculo pelas coordenadas da fonte" });
  if (c.phone) evidence.push({ claim: `Telefone comercial publicado: ${c.phone}`, status: "fonte", source: c.sourceLabel });
  if (c.email) evidence.push({ claim: `E-mail comercial publicado: ${c.email}`, status: "fonte", source: c.sourceLabel });
  if (instagram) evidence.push({ claim: `Perfil ${instagram} informado (não aberto: o Instagram exige login)`, status: "fonte", source: c.sourceLabel });
  if (c.openingHours) evidence.push({ claim: `Horário publicado: ${c.openingHours}`, status: "fonte", source: c.sourceLabel });

  if (!c.website) {
    evidence.push({ claim: "Nenhum site registrado na fonte", status: "fonte", source: c.sourceLabel });
    evidence.push({ claim: "Ausência de site próprio não confirmada por busca do nome na web", status: "nao_verificado", source: "Pendente" });
  } else if (social) {
    evidence.push({ claim: `O site informado aponta para ${social} (${hostOf(c.website)})`, status: "verificado", source: "Análise do endereço" });
    evidence.push({ claim: "Existência de outro site próprio não confirmada por busca do nome na web", status: "nao_verificado", source: "Pendente" });
  } else if (check) {
    sources.push({ label: "Site do estabelecimento", url: check.finalUrl ?? check.url });
    if (check.blocked) evidence.push({ claim: `Site existe, mas recusou a verificação automática (HTTP ${check.httpStatus})`, status: "verificado", source: "Conferência HTTP da Sellora" });
    else if (check.reachable) evidence.push({ claim: `Site respondeu HTTP ${check.httpStatus} em ${check.finalUrl ?? check.url}`, status: "verificado", source: "Conferência HTTP da Sellora" });
    for (const p of problems) evidence.push({ claim: p, status: "verificado", source: "Conferência HTTP da Sellora" });
    if (check.scriptRendered) evidence.push({ claim: "Página montada por JavaScript: links e conteúdo não conferidos sem navegador", status: "nao_verificado", source: "Pendente" });
    if (check.reachable) evidence.push({ claim: "Layout, velocidade e conteúdo não foram avaliados visualmente", status: "nao_verificado", source: "Pendente (skill website-audit)" });
  }

  const skip = skipReason({ ...c, instagram, otherSocials }, ctx.duplicateOf);
  const base = { id: c.id, name: c.name, category: c.category, segment: c.segment, city: c.city, uf: c.uf, address: c.address, distanceKm: c.distanceKm, phone: c.phone, email: c.email, website: ownSite, instagram, otherSocials, openingHours: c.openingHours, presence, problems, evidence, sources, siteCheck: check, checkedAt };

  if (skip) {
    return { ...base, classification: "SKIP", score: 0, scoreParts: [{ label: skip, points: 0 }], confidence: "alta", diagnosis: skip, justification: `SKIP: ${skip}.` };
  }

  const parts: ScorePart[] = [];
  const reachable = check?.reachable ?? false;
  if (presence === "sem_site") parts.push({ label: "Sem site registrado", points: 50 });
  else if (presence === "so_redes") parts.push({ label: `Só redes sociais/plataforma${social ? ` (${social})` : ""}`, points: 45 });
  else if (presence === "site_adequado") parts.push({ label: "Site próprio sem problemas detectados", points: 5 });
  else if (!reachable) parts.push({ label: "Site fora do ar", points: 40 });
  else parts.push({ label: `Site com ${problems.length} problema(s) verificável(is)`, points: Math.min(40, 15 + 7 * problems.length) });

  if (c.phone) parts.push({ label: "Telefone comercial publicado", points: 15 });
  if (instagram || otherSocials.length) parts.push({ label: "Rede social publicada", points: 5 });
  if (c.email) parts.push({ label: "E-mail comercial publicado", points: 5 });
  if (c.openingHours) parts.push({ label: "Horário de funcionamento publicado", points: 8 });
  if (c.addressComplete) parts.push({ label: "Endereço completo", points: 7 });
  if (c.distanceKm !== null) {
    const share = c.distanceKm / ctx.radiusKm;
    parts.push({ label: share <= 0.25 ? "Perto do centro da busca" : share <= 0.5 ? "Distância média" : "Longe do centro da busca", points: share <= 0.25 ? 10 : share <= 0.5 ? 6 : 3 });
  }
  const score = Math.max(0, Math.min(100, parts.reduce((s, p) => s + p.points, 0)));

  const classification: Classification = presence === "sem_site" || presence === "so_redes" ? "HOT" : presence === "site_com_problemas" ? "WARM" : "LOW";
  const confidence: Confidence = ownSite && check ? (check.blocked || check.scriptRendered ? "baixa" : "alta") : social ? "media" : "baixa";
  const contact = c.phone ? "telefone comercial publicado" : instagram ? `perfil ${instagram}` : otherSocials.length ? "rede social publicada" : "e-mail comercial";

  let diagnosis: string;
  let justification: string;
  if (presence === "sem_site") {
    diagnosis = "Sem site registrado";
    justification = `HOT: nenhum site próprio registrado e ${contact}. Ausência de site ainda não confirmada por busca do nome.`;
  } else if (presence === "so_redes") {
    diagnosis = `Só redes sociais${social ? ` (${social})` : instagram ? " (Instagram)" : ""}`;
    justification = `HOT: presença apenas em rede social/plataforma, sem endereço próprio; contato por ${contact}.`;
  } else if (presence === "site_com_problemas") {
    diagnosis = reachable ? `${problems.length} problema(s): ${problems[0]}` : "Site fora do ar";
    justification = `WARM: site próprio com problema verificável (${problems.slice(0, 3).join("; ")}).`;
  } else if (check?.blocked) {
    diagnosis = "Site próprio existe, mas recusou a verificação automática";
    justification = `LOW: há site próprio (${hostOf(ownSite)}); a qualidade não pôde ser verificada (HTTP ${check.httpStatus}). Revisar manualmente.`;
  } else {
    diagnosis = "Site próprio no ar, sem problemas detectados";
    justification = "LOW: site próprio respondeu e passou nas verificações automáticas; abordar só com demanda específica.";
  }

  return { ...base, classification, score, scoreParts: parts, confidence, diagnosis, justification };
}

/** Chave de duplicidade dentro da mesma pesquisa: nome normalizado + telefone. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function phoneDigits(phone: string): string {
  const d = phone.replace(/\D/g, "");
  // Normaliza +55 e mantém DDD + número (10 ou 11 dígitos).
  return d.length > 11 && d.startsWith("55") ? d.slice(2) : d;
}
