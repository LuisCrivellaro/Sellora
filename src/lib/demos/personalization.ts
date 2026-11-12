import { z } from "zod";
import type { DemoBusiness } from "./model";
import { demoDesigns } from "./designs";
import type { Segment } from "../types";
import { approvedConcepts, type ApprovedConceptId } from "./concepts";
import { demoVariant } from "./kinds";

const color = z.string().regex(/^#[0-9a-f]{6}$/i);
export const demoPersonalizationSchema = z.object({
  layout: z.enum(["editorial", "poster", "portrait", "banner", "framed"]),
  typography: z.enum(["classic", "modern", "expressive"]),
  paper: color,
  ink: color,
  accent: color,
  headline: z.string().min(1).max(220),
  photoPosition: z.enum(["center", "left", "right"]),
  informationFirst: z.boolean(),
});
export type DemoPersonalization = z.infer<typeof demoPersonalizationSchema>;

// Paletas de alto contraste. O acento também é usado em texto e foco.
const palettes: Record<Segment, readonly (readonly [string, string, string])[]> = {
  restaurantes: [["#192c28", "#f4f2e9", "#e0c6a1"], ["#f6eee1", "#39251e", "#8b3d2c"], ["#3b2028", "#fff3e4", "#edc58f"], ["#f4f0de", "#273c32", "#426046"]],
  beleza: [["#f0ebee", "#382c36", "#654654"], ["#292c26", "#f4f2e8", "#dccea5"], ["#f7eee6", "#46312e", "#8d4d39"], ["#eaeef1", "#253643", "#435e77"]],
  saude: [["#f5f9fa", "#193f52", "#235f7b"], ["#edf3e9", "#284337", "#3d6651"], ["#253d45", "#f4f6ef", "#acd4cf"], ["#f5eee8", "#493934", "#805448"]],
  servicos: [["#132c41", "#f4f6fa", "#f0c575"], ["#f4f1e9", "#2e3633", "#485d48"], ["#342d2a", "#f7f2e7", "#dfbe8b"], ["#eaf0f2", "#233b50", "#315e7e"]],
  comercio: [["#faf8f3", "#20382f", "#326653"], ["#302b3b", "#f9f1e6", "#dbc3a7"], ["#f6ebe3", "#462f26", "#874735"], ["#eaeff5", "#23364d", "#3b577b"]],
  outros: [["#eef1f8", "#1c2d49", "#37558a"], ["#f3efe5", "#373b2b", "#59613a"], ["#233732", "#f5f3e9", "#c6d9af"], ["#f4eae8", "#493035", "#8d4d5a"]],
};

const headlines: Record<Segment, readonly string[]> = {
  restaurantes: ["Uma mesa, uma conversa, um encontro.", "O próximo encontro começa aqui.", "Sabores para conhecer de perto.", "Um convite para sair da rotina."],
  beleza: ["Um momento para o seu cuidado.", "Sua próxima mudança começa aqui.", "Encontre o seu momento.", "Beleza com espaço para você."],
  saude: ["O primeiro passo é uma conversa.", "Cuidado começa com informação.", "Um caminho para conhecer o atendimento.", "Seu próximo contato, com clareza."],
  servicos: ["Vamos dar forma ao seu próximo projeto.", "O que você precisa começa com uma conversa.", "Conheça o trabalho. Converse com a equipe.", "Uma ideia merece um primeiro passo."],
  comercio: ["Sua próxima descoberta está por perto.", "Conheça a loja no seu tempo.", "Uma nova forma de olhar a vitrine.", "Do primeiro olhar à próxima visita."],
  outros: ["Perto de você. Aberto a uma conversa.", "Uma história para conhecer de perto.", "O próximo contato começa aqui.", "Conheça o que acontece por aqui."],
};

function designHash(value: string): number {
  let hash = 2166136261;
  for (const character of value) {
    hash = Math.imul(hash ^ character.codePointAt(0)!, 16777619);
  }
  return hash >>> 0;
}

/** A composição vira parte do snapshot, com a mesma aparência em qualquer navegador. */
export function createDemoPersonalization(business: DemoBusiness): DemoPersonalization {
  const identity = `${business.name.normalize("NFC").toLocaleLowerCase("pt-BR")}|${business.city}|${business.uf}|${business.segment}`;
  const choose = <T,>(axis: string, options: readonly T[]): T => options[designHash(`${identity}|${axis}`) % options.length];
  const [paper, ink, accent] = choose("palette", palettes[business.segment]);
  return {
    layout: choose("layout", demoPersonalizationSchema.shape.layout.options),
    typography: choose("type", demoPersonalizationSchema.shape.typography.options),
    paper, ink, accent,
    headline: `${business.name}. ${choose("headline", headlines[business.segment])}`,
    photoPosition: choose("crop", demoPersonalizationSchema.shape.photoPosition.options),
    informationFirst: designHash(`${identity}|sections`) % 2 === 0,
  };
}

export const demoLayoutNames: Record<DemoPersonalization["layout"], string> = {
  editorial: "Editorial", poster: "Capa fotográfica", portrait: "Retrato", banner: "Panorama", framed: "Emoldurado",
};

export function demoDesignName(demo: { version: number; business: DemoBusiness; design?: DemoPersonalization; conceptId?: ApprovedConceptId; creation?: { name: string } }): string {
  if (demo.version === 5 && demo.creation) return demo.creation.name;
  if (demo.version === 4 && demo.conceptId) return approvedConcepts[demo.conceptId].name;
  if (demo.version === 1) return "Visual original";
  if (demo.version === 3 && demo.design) return demoLayoutNames[demo.design.layout];
  if (demo.version === 3) return demoVariant(demo.business).styleName;
  return demoDesigns[demo.business.segment].name;
}
