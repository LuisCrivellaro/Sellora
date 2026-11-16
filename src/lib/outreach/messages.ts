import type { Activity, Lead, Segment } from "../types";

/**
 * Abordagem comercial (sem IA, sem envio): mensagens montadas a partir de blocos variados,
 * escolhidos por lead e conferidos contra as mensagens recentes de outros leads.
 *
 * Regras (docs/DECISIONS.md, 2026-11-16):
 * - Primeiro contato curto, sem link, terminando com uma pergunta simples.
 * - Só usa nome, cidade, segmento/categoria e a situação do site quando verificada.
 * - Nunca afirma que o negócio não tem site; pergunta.
 * - Demonstração só é oferecida; o link vai na resposta a quem demonstrou interesse,
 *   sempre identificada como conceito não oficial, com imagens ilustrativas.
 * - Sem promessas de resultado, números ou depoimentos.
 */

export type OutreachKind = "first_contact" | "interested" | "undecided" | "declined";

export const outreachKindLabel: Record<OutreachKind, string> = {
  first_contact: "Primeiro contato",
  interested: "Lead interessado",
  undecided: "Lead indeciso",
  declined: "Lead recusou",
};

export const DEMO_TRANSPARENCY = "É um conceito não oficial, feito só para vocês visualizarem a ideia: as imagens são ilustrativas e as informações precisam ser confirmadas por vocês.";

/** O que a mensagem pode afirmar sobre o lead, com o nível de confirmação de cada dado. */
export interface OutreachFacts {
  name: string;
  city: string;
  segment: Segment;
  category: string | null;
  /** Site conhecido no cadastro. `verified` = conferido por HTTP pela Prospecção IA. */
  site: { known: boolean; verified: boolean };
  /** Oportunidade de melhoria que pode ser citada (só com verificação). */
  opportunity: "mobile" | "modernize" | "complement" | null;
  hasDemo: boolean;
  sender: string | null;
}

type FactsLead = Pick<Lead, "id" | "name" | "city" | "segment" | "website" | "websiteSituation" | "source"> & { demo?: Lead["demo"] };

const DEFAULT_PROFILE_NAMES = new Set(["fundador sellora", "administrador", "revisor local", ""]);

export function outreachFacts(lead: FactsLead, profileName = ""): OutreachFacts {
  const known = !!lead.website?.trim();
  // A Prospecção IA abre o site por HTTP antes de classificar; cadastro manual não é verificação.
  const verified = known && lead.source === "prospeccao_ia";
  const opportunity = !known ? null
    : !verified ? "complement"
    : lead.websiteSituation === "sem_mobile" ? "mobile"
    : lead.websiteSituation === "desatualizado" ? "modernize"
    : "complement";
  const first = profileName.trim().split(/\s+/)[0] ?? "";
  return {
    name: lead.name.trim(),
    city: lead.city.trim(),
    segment: lead.segment,
    category: lead.demo?.business.category?.trim() || null,
    site: { known, verified },
    opportunity,
    hasDemo: !!lead.demo && lead.demo.status !== "rejected",
    sender: DEFAULT_PROFILE_NAMES.has(profileName.trim().toLowerCase()) || first.length < 2 ? null : first,
  };
}

// FNV-1a: escolha estável por lead, sem aleatoriedade (o mesmo lead recebe o mesmo rascunho).
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const pick = <T,>(items: readonly T[], seed: number, slot: number): T => items[hash(`${seed}:${slot}`) % items.length];

/** O que uma página poderia mostrar, por segmento. Ideias, nunca afirmações sobre o lead. */
const PAGE_IDEAS: Record<Segment, readonly string[]> = {
  restaurantes: ["cardápio, horário e como chegar", "fotos dos pratos e pedido direto pelo WhatsApp", "cardápio atualizado e reservas pelo WhatsApp"],
  saude: ["especialidades, horários e agendamento pelo WhatsApp", "informações de atendimento e um caminho rápido para marcar horário", "localização, horários e contato direto para agendar"],
  beleza: ["serviços, fotos dos trabalhos e agendamento rápido", "um portfólio dos trabalhos e agendamento pelo WhatsApp", "lista de serviços, horários e botão para marcar"],
  servicos: ["serviços, área atendida e pedido de orçamento", "o que vocês fazem e orçamento direto pelo WhatsApp", "trabalhos realizados e um jeito simples de pedir orçamento"],
  comercio: ["produtos, horário e como chegar", "uma vitrine dos produtos com contato direto", "destaques da loja, horário e WhatsApp"],
  outros: ["o que vocês oferecem, horário e contato", "as informações principais e contato direto", "serviços, localização e WhatsApp num lugar só"],
};

// O nome entra como vocativo: evita errar o artigo ("a"/"o") antes de nomes de estabelecimentos.
const GREETINGS = ["Olá, {name}! Tudo bem?", "Oi, {name}, tudo bem por aí?", "Olá, equipe {name}! Tudo certo?", "Oi, {name}! Como vão as coisas?", "Olá, {name}, tudo bem?"] as const;

/** Como o cliente procura esse tipo de negócio. A categoria da fonte, quando existe, é mais precisa. */
const SEARCH_PHRASE: Record<Segment, string> = {
  restaurantes: "onde comer", saude: "atendimento de saúde", beleza: "serviços de beleza",
  servicos: "esse tipo de serviço", comercio: "onde comprar", outros: "o que vocês oferecem",
};

function intro(facts: OutreachFacts, seed: number): string {
  const who = facts.sender ? `Aqui é ${facts.sender}, da Sellora` : "Aqui é da Sellora";
  return pick([
    `${who}. A gente cria sites para negócios locais.`,
    `${who}; trabalho criando sites para negócios locais.`,
    `${who}. Criamos sites e páginas para negócios locais.`,
    `${who}, fazemos páginas para comércios e serviços.`,
  ], seed, 2);
}

/** Frase sobre a presença digital. Sem site confirmado, nenhuma afirmação (a pergunta trata disso). */
function presence(facts: OutreachFacts, seed: number): string {
  if (!facts.site.known) return "";
  if (facts.opportunity === "mobile") return pick([
    "Dei uma olhada no site de vocês e ele não parece adaptado para celular.",
    "Abri o site de vocês e ele não se ajusta às telas de celular.",
  ], seed, 3);
  if (facts.opportunity === "modernize") return pick([
    "Vi o site de vocês e acho que dá para deixar o visual mais atual e o contato mais direto.",
    "Passei pelo site de vocês e enxerguei espaço para modernizar a apresentação.",
  ], seed, 3);
  return pick([
    "Sei que vocês já têm site, e pensei em algo para diferenciar ainda mais a presença de vocês.",
    "Como vocês já têm site, pensei numa ideia complementar.",
  ], seed, 3);
}

function idea(facts: OutreachFacts, seed: number): string {
  const content = pick(PAGE_IDEAS[facts.segment], seed, 4);
  const audience = `quem procura ${facts.category ? facts.category.toLowerCase() : SEARCH_PHRASE[facts.segment]} em ${facts.city}`;
  // Com site existente, a proposta é uma nova versão dele, não uma página do zero.
  const page = facts.site.known ? "uma nova versão do site" : "uma página";
  if (facts.hasDemo) return pick([
    `Esbocei ${page} para vocês, pensando em ${audience}: ${content}.`,
    `Montei um rascunho visual de ${page} para vocês, com ${content}, pensando em ${audience}.`,
    `Fiz um esboço de como poderia ficar ${page} de vocês para ${audience}, com ${content}.`,
  ], seed, 5);
  return pick([
    `Tenho uma ideia de ${page} para vocês, pensando em ${audience}: ${content}.`,
    `Pensei em ${page} feita para ${audience} encontrar vocês com facilidade, com ${content}.`,
    `Fiquei com uma ideia de ${page} para vocês, mostrando ${content} para ${audience}.`,
  ], seed, 5);
}

function question(facts: OutreachFacts, seed: number): string {
  if (!facts.site.known) return pick([
    "Vocês já têm um site próprio ou hoje o contato é mais pelo WhatsApp e Instagram?",
    "Hoje os clientes chegam até vocês mais pelo Instagram, pelo Google ou por indicação?",
    facts.hasDemo ? "Posso te mostrar? Antes, só queria saber: vocês já têm um site próprio?" : "Isso faria sentido para vocês hoje?",
    facts.hasDemo ? "Quer que eu te mostre?" : "Vocês já pensaram em ter uma página própria?",
  ], seed, 6);
  return pick(facts.hasDemo
    ? ["Quer que eu te mostre?", "Posso te mandar para você dar uma olhada?", "Topa ver como ficou?"]
    : ["Faz sentido eu te contar a ideia?", "Posso te explicar em poucas linhas?", "Vocês estariam abertos a ver uma proposta?"], seed, 6);
}

/** Estruturas diferentes (ordem e junção dos blocos) para o texto não seguir um molde só. */
const FRAMES: readonly ((parts: { greeting: string; intro: string; presence: string; idea: string; question: string }) => string)[] = [
  (p) => [`${p.greeting} ${p.intro}`, [p.presence, p.idea].filter(Boolean).join(" "), p.question].join("\n\n"),
  (p) => [`${p.greeting} ${p.intro} ${p.presence}`.trim(), `${p.idea} ${p.question}`].join("\n\n"),
  (p) => [p.greeting, [p.intro, p.presence, p.idea].filter(Boolean).join(" "), p.question].join("\n\n"),
  (p) => [`${p.greeting} ${p.intro}`, `${[p.idea, p.presence].filter(Boolean).join(" ")} ${p.question}`].join("\n\n"),
];

function firstContactCandidate(facts: OutreachFacts, seed: number): string {
  const parts = {
    greeting: pick(GREETINGS, seed, 1).replace("{name}", facts.name),
    intro: intro(facts, seed),
    presence: presence(facts, seed),
    idea: idea(facts, seed),
    question: question(facts, seed),
  };
  return pick(FRAMES, seed, 7)(parts).replace(/[ \t]+/g, " ").trim();
}

function reply(kind: Exclude<OutreachKind, "first_contact">, facts: OutreachFacts, seed: number, demoUrl: string | null): string {
  if (kind === "interested") {
    if (demoUrl) return [
      pick(["Que bom! Segue a demonstração que preparei para vocês:", "Ótimo! Aqui está o esboço que montei para vocês:", "Que legal! Te mando o rascunho da página:"], seed, 11),
      demoUrl,
      DEMO_TRANSPARENCY,
      pick(["O que achou? Se quiser, me conta o que mudaria.", "Me diz o que achou e o que gostaria de ver diferente?", "Dá uma olhada com calma e me fala: faz sentido para vocês?"], seed, 12),
    ].join("\n\n");
    return [
      pick(["Que bom! Vou preparar uma demonstração pensando em vocês e te mando por aqui.", "Ótimo! Vou montar um esboço da página e te envio por aqui."], seed, 11),
      pick(["Para acertar mais, me conta: o que os clientes mais perguntam para vocês?", "Tem algo que vocês gostariam de destacar primeiro na página?", "Qual é o principal serviço que vocês querem mostrar?"], seed, 12),
    ].join(" ");
  }
  if (kind === "undecided") return [
    pick(["Sem problema, entendo.", "Tranquilo, faz parte decidir com calma.", "Claro, sem pressa."], seed, 13),
    facts.hasDemo
      ? pick(["Se ajudar, posso te mandar a demonstração para vocês verem como ficaria, sem compromisso.", "Posso te mostrar o esboço que fiz; olhar não compromete nada."], seed, 14)
      : pick(["Se ajudar, posso preparar uma demonstração para vocês verem como ficaria, sem compromisso.", "Se quiser, preparo um esboço rápido só para vocês visualizarem."], seed, 14),
    pick(["Prefere que eu mande por aqui?", "Quer que eu faça isso?", "Fica melhor eu te chamar outro dia?"], seed, 15),
  ].join(" ");
  return [
    pick(["Tudo bem, obrigado pelo retorno!", "Entendido, agradeço por responder!", "Sem problema, obrigado por avisar!"], seed, 16),
    pick(["Se em algum momento quiserem conversar sobre o site, é só chamar por aqui.", "Fico à disposição se precisarem no futuro.", "Se mudarem de ideia, meu contato fica aqui."], seed, 17),
    pick([`Sucesso, ${facts.name}!`, "Um abraço e bom trabalho!", `Bom trabalho aí em ${facts.city}!`], seed, 18),
  ].join(" ");
}

// ---- Similaridade e conferência -------------------------------------------------------------

const normalize = (text: string, facts?: Pick<OutreachFacts, "name" | "city">) => {
  let t = text.toLowerCase();
  if (facts) for (const value of [facts.name, facts.city]) if (value) t = t.split(value.toLowerCase()).join(" ");
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/https?:\/\/\S+/g, " ").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
};
function trigrams(words: string[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) out.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return out;
}
/** Semelhança 0–1 entre duas mensagens (trigramas de palavras, ignorando nome e cidade). */
export function messageSimilarity(a: string, b: string, names: { name: string; city: string }[] = []): number {
  const strip = (text: string) => names.reduce((words, n) => normalize(words.join(" "), n), normalize(text));
  const x = trigrams(strip(a)), y = trigrams(strip(b));
  if (!x.size || !y.size) return 0;
  let common = 0;
  for (const g of x) if (y.has(g)) common++;
  return common / (x.size + y.size - common);
}

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|com\.br|net|org|app|site|br|io)\b|wa\.me)/i;
const PROMISES = /(garant|aument\w* (as |suas |seu |o |a )?(vendas|faturamento|clientes)|mais clientes|resultado garantido|retorno garantido|\d+ ?%)/i;
const NO_SITE_CLAIM = /(n[aã]o (tem|t[eê]m|possui|possuem) (um )?site|sem site|n[aã]o existe (um )?site)/i;

/** Problemas de uma mensagem (gerada ou editada). Avisos para o operador; a edição continua livre. */
export function outreachIssues(text: string, kind: OutreachKind): string[] {
  const issues: string[] = [];
  const t = text.trim();
  if (kind === "first_contact") {
    if (LINK.test(t)) issues.push("O primeiro contato não deve ter link; envie a demonstração depois que o lead responder com interesse.");
    if (t.length > 600) issues.push("Mensagem longa para um primeiro contato; tente ficar abaixo de 600 caracteres.");
    if (!t.endsWith("?")) issues.push("Termine com uma pergunta simples para facilitar a resposta.");
  }
  if (NO_SITE_CLAIM.test(t)) issues.push("Evite afirmar que o negócio não tem site sem confirmação; pergunte.");
  if (PROMISES.test(t)) issues.push("Evite prometer resultados ou citar números sem comprovação.");
  if (kind === "interested" && LINK.test(t) && !/n[aã]o oficial/i.test(t)) issues.push("Ao enviar a demonstração, diga que é um conceito não oficial com imagens ilustrativas.");
  return issues;
}

// ---- Montagem ------------------------------------------------------------------------------

export interface OutreachOptions {
  /** Mensagens recentes de outros leads (mesmo tipo), para evitar repetição. */
  recent?: { text: string; name: string; city: string }[];
  /** "Outra versão": percorre as próximas melhores opções. */
  variant?: number;
  /** Link da demonstração (só na resposta a lead interessado). */
  demoUrl?: string | null;
}

const CANDIDATES = 32;

export function buildOutreachMessage(facts: OutreachFacts, kind: OutreachKind, options: OutreachOptions = {}): string {
  const base = hash(`${facts.name}|${facts.city}|${kind}`);
  const variant = Math.max(0, Math.floor(options.variant ?? 0));
  const recent = (options.recent ?? []).slice(0, 40);
  const names = recent.map(({ name, city }) => ({ name, city }));
  const build = (seed: number) => kind === "first_contact" ? firstContactCandidate(facts, seed) : reply(kind, facts, seed, kind === "interested" ? options.demoUrl ?? null : null);
  const scored = new Map<string, number>();
  for (let i = 0; i < CANDIDATES; i++) {
    const text = build(base + i);
    if (scored.has(text) || outreachIssues(text, kind).length) continue;
    const similarity = recent.reduce((max, item) => Math.max(max, messageSimilarity(text, item.text, [...names, facts])), 0);
    scored.set(text, similarity);
  }
  // Ordem estável: menor semelhança com o histórico, depois a ordem de geração.
  const ranked = [...scored.entries()].sort((a, b) => a[1] - b[1]).map(([text]) => text);
  return ranked[variant % ranked.length] ?? build(base);
}

// ---- Registro no CRM (atividade) -----------------------------------------------------------

const ACTIVITY_PREFIX: Record<OutreachKind, string> = {
  first_contact: "Primeiro contato manual (sem link) declarado pelo operador. Entrega não verificada. Texto: ",
  interested: "Resposta manual a lead interessado declarada pelo operador. Texto: ",
  undecided: "Resposta manual a lead indeciso declarada pelo operador. Texto: ",
  declined: "Resposta manual a lead que recusou declarada pelo operador. Texto: ",
};

export function outreachActivityDescription(kind: OutreachKind, text: string): string {
  const prefix = ACTIVITY_PREFIX[kind];
  const body = text.trim().replace(/\s+/g, " ");
  const room = 500 - prefix.length;
  return prefix + (body.length > room ? `${body.slice(0, room - 1)}…` : body);
}

export function outreachActivityKind(activity: Pick<Activity, "description">): OutreachKind | null {
  for (const kind of Object.keys(ACTIVITY_PREFIX) as OutreachKind[]) if (activity.description.startsWith(ACTIVITY_PREFIX[kind])) return kind;
  return null;
}

/** Primeiros contatos já registrados em outros leads, do mais recente ao mais antigo. */
export function recentFirstContacts(activities: Activity[], leads: Pick<Lead, "id" | "name" | "city">[], excludeLeadId: string, limit = 40): { text: string; name: string; city: string }[] {
  const byId = new Map(leads.map((lead) => [lead.id, lead]));
  return activities
    .filter((a) => a.leadId && a.leadId !== excludeLeadId && outreachActivityKind(a) === "first_contact")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit)
    .flatMap((a) => {
      const lead = byId.get(a.leadId!);
      return lead ? [{ text: a.description.slice(ACTIVITY_PREFIX.first_contact.length), name: lead.name, city: lead.city }] : [];
    });
}
