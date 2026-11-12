import { z } from "zod";
import type { DemoBusiness } from "./model";

export const approvedConceptIdSchema = z.enum(["cravo-20261112", "headmasters-20261112"]);
export type ApprovedConceptId = z.infer<typeof approvedConceptIdSchema>;

// IDs imutáveis. Alterações de criação recebem outro ID para preservar links revisados.
export const approvedConcepts = {
  "cravo-20261112": {
    name: "Orgânico e expressivo",
    business: { name: "Cravo e Canela", city: "São Paulo", uf: "SP", segment: "beleza" },
    direction: "organic",
    media: {
      src: "/demos/unique/cravo-portrait.png", cover: "/demos/unique/cravo-cover.png",
      alt: "Retrato ilustrativo de uma mulher com cabelos cacheados, em luz quente, criado por IA",
      width: 1122, height: 1402,
      sourceHash: "d43965f9f268f486d2e0c4f107f074e231a190462524affcdcf74f42af04280d",
      caption: "Retrato criado para este conceito. Modelo fictícia.",
    },
    headline: ["Deixe aparecer", "quem você"], emphasis: "é.",
    intro: ["Suas referências, seu jeito, suas ideias. Um convite para começar uma conversa sobre beleza e expressão."],
    heroCta: "Comece pela sua inspiração",
    story: {
      label: "O seu ponto de partida",
      title: ["O que inspira você", "merece"], emphasis: "espaço.",
      paragraphs: [
        "Uma textura que você gosta. Uma referência que guardou. A vontade de experimentar algo diferente.",
        "O que inspira você é um bom começo para conhecer Cravo e Canela, em São Paulo, e conversar sobre o próximo momento de cuidado.",
      ],
      cta: "Leve suas ideias para a conversa",
    },
    visit: {
      label: "Antes de sair de casa", title: ["Abra espaço", "na sua"], emphasis: "rotina.",
      text: "Converse com o estabelecimento para conhecer os atendimentos disponíveis e combinar sua visita.",
      steps: [],
    },
    contact: { label: "O próximo capítulo começa com você", title: ["Traga suas", "ideias."], back: "Voltar à primeira impressão" },
    message: "Olá! Ao criar uma proposta visual para Cravo e Canela, explorei um caminho orgânico, com um retrato ilustrativo exclusivo e uma página que começa pelas inspirações de quem visita. Gostaria de compartilhar essa demonstração não oficial com quem cuida da comunicação do negócio. Com quem posso conversar?",
  },
  "headmasters-20261112": {
    name: "Gráfico e preciso",
    business: { name: "Headmasters Cabelo & Estética", city: "São Paulo", uf: "SP", segment: "beleza" },
    direction: "graphic",
    media: {
      src: "/demos/unique/headmasters-still-life.png", cover: "/demos/unique/headmasters-cover.png",
      alt: "Composição ilustrativa de tesoura de cabelo, pente e tecido azul-cobalto, criada por IA",
      width: 1536, height: 1024,
      sourceHash: "c30cd256966365addc386d1e7ae4045e5b2c6af56d2d7eae0d07c24ca9aab1db",
      caption: "Composição criada por IA para este conceito. Materiais ilustrativos.",
    },
    headline: ["SEU VISUAL.", "SUA ASSINATURA."], emphasis: "",
    intro: ["Tem referência que muda o olhar.", "Tem escolha que diz quem você é."],
    heroCta: "Encontre uma nova perspectiva",
    story: {
      label: "Uma outra perspectiva", title: ["O detalhe muda", "o"], emphasis: "conjunto.",
      paragraphs: [
        "Um novo olhar sobre o próprio visual pode começar em uma imagem que fica na memória. Use essa referência para abrir um diálogo sobre o que deseja expressar.",
        "Em São Paulo, Headmasters Cabelo & Estética é o ponto de contato para conhecer as possibilidades do estabelecimento e esclarecer dúvidas antes da visita.",
      ],
      cta: "",
    },
    visit: {
      label: "Antes da visita", title: ["CHEGUE COM", "UMA IDEIA."], emphasis: "", text: "",
      steps: [
        { title: "O que te move", text: "Guarde uma imagem que traduza o resultado que você gostaria de explorar." },
        { title: "As possibilidades", text: "Confirme com o estabelecimento os atendimentos disponíveis e tire suas dúvidas." },
        { title: "O encontro", text: "Consulte endereço, horários e formas de agendamento antes de planejar a ida." },
      ],
    },
    contact: { label: "Headmasters Cabelo & Estética", title: ["PRÓXIMO", "PASSO?"], back: "Rever o conceito" },
    message: "Posso mostrar uma proposta de site à pessoa responsável pela Headmasters Cabelo & Estética? Montei uma demonstração não oficial que coloca o nome e a expressão visual em destaque, com uma abertura tipográfica e uma imagem conceitual feita para esse projeto. Se essa direção fizer sentido, podemos conversar sobre os conteúdos e atendimentos que vocês gostariam de apresentar.",
  },
} as const;

export function normalizeCreativeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

export function conceptMatchesBusiness(id: ApprovedConceptId, business: DemoBusiness): boolean {
  const expected = approvedConcepts[id].business;
  return normalizeCreativeText(expected.name) === normalizeCreativeText(business.name)
    && normalizeCreativeText(expected.city) === normalizeCreativeText(business.city)
    && expected.uf === business.uf && expected.segment === business.segment;
}

export function findApprovedConcept(business: DemoBusiness): ApprovedConceptId | undefined {
  return approvedConceptIdSchema.options.find((id) => conceptMatchesBusiness(id, business));
}
