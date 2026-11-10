import type { Segment } from "../types";
import type { OpportunityType } from "./types";

/**
 * Segmentos pesquisáveis e como cada um vira consulta no OpenStreetMap.
 * `crm` é o segmento usado ao importar para o CRM (enum existente).
 */
export interface ProspectSegment {
  id: string;
  label: string;
  crm: Segment;
  /** Pares chave OSM → valores aceitos. */
  tags: Record<string, string[]>;
}

export const PROSPECT_SEGMENTS: ProspectSegment[] = [
  {
    id: "restaurantes",
    label: "Restaurantes, cafés e lanchonetes",
    crm: "restaurantes",
    tags: { amenity: ["restaurant", "cafe", "fast_food", "bar", "pub", "ice_cream", "food_court"], shop: ["bakery", "confectionery", "pastry", "deli", "butcher"] },
  },
  {
    id: "saude",
    label: "Saúde (clínicas, dentistas, consultórios)",
    crm: "saude",
    tags: { amenity: ["clinic", "dentist", "doctors", "veterinary"], healthcare: ["clinic", "dentist", "doctor", "physiotherapist", "psychotherapist", "laboratory", "optometrist", "speech_therapist", "nutrition_counselling"] },
  },
  {
    id: "academias",
    label: "Academias e estúdios",
    crm: "saude",
    tags: { leisure: ["fitness_centre", "sports_centre", "dance"], amenity: ["dojo"] },
  },
  {
    id: "beleza",
    label: "Beleza (salões, barbearias, estética)",
    crm: "beleza",
    tags: { shop: ["hairdresser", "beauty", "cosmetics", "massage", "tattoo", "nails"] },
  },
  {
    id: "servicos",
    label: "Serviços (oficinas, pet, lavanderias, escritórios)",
    crm: "servicos",
    tags: {
      shop: ["car_repair", "tyres", "laundry", "dry_cleaning", "pet_grooming", "tailor", "photo", "copyshop", "funeral_directors"],
      amenity: ["car_wash", "driving_school", "language_school", "music_school"],
      office: ["lawyer", "accountant", "estate_agent", "architect", "insurance"],
      craft: ["electrician", "plumber", "carpenter", "photographer", "upholsterer", "locksmith"],
    },
  },
  {
    id: "comercio",
    label: "Comércio local (lojas)",
    crm: "comercio",
    tags: {
      shop: ["clothes", "shoes", "gift", "furniture", "hardware", "florist", "pet", "books", "jewelry", "optician", "mobile_phone", "electronics", "variety_store", "toys", "sports", "bicycle", "stationery", "garden_centre", "houseware", "interior_decoration", "fabric", "bag", "boutique"],
    },
  },
];

export const ALL_SEGMENTS_ID = "todos";

export const segmentOptions = [
  ...PROSPECT_SEGMENTS.map((s) => ({ value: s.id, label: s.label })),
  { value: ALL_SEGMENTS_ID, label: "Todos os segmentos acima" },
];

export const prospectSegmentIds: [string, ...string[]] = [ALL_SEGMENTS_ID, ...PROSPECT_SEGMENTS.map((s) => s.id)];

export function segmentsFor(id: string): ProspectSegment[] {
  return id === ALL_SEGMENTS_ID ? PROSPECT_SEGMENTS : PROSPECT_SEGMENTS.filter((s) => s.id === id);
}

/** Segmento CRM a partir das tags do estabelecimento (primeiro que casar). */
export function crmSegmentFromTags(tags: Record<string, string>, fallback: Segment = "outros"): { segment: Segment; category: string } {
  for (const s of PROSPECT_SEGMENTS) {
    for (const [key, values] of Object.entries(s.tags)) {
      const v = tags[key];
      if (v && values.includes(v)) return { segment: s.crm, category: CATEGORY_LABELS[v] ?? v.replace(/_/g, " ") };
    }
  }
  return { segment: fallback, category: "Estabelecimento" };
}

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: "Restaurante",
  cafe: "Café",
  fast_food: "Lanchonete",
  bar: "Bar",
  pub: "Bar",
  ice_cream: "Sorveteria",
  food_court: "Praça de alimentação",
  bakery: "Padaria",
  confectionery: "Doceria",
  pastry: "Confeitaria",
  deli: "Empório",
  butcher: "Açougue",
  clinic: "Clínica",
  dentist: "Dentista",
  doctors: "Consultório médico",
  doctor: "Consultório médico",
  veterinary: "Veterinário",
  physiotherapist: "Fisioterapia",
  psychotherapist: "Psicologia",
  laboratory: "Laboratório",
  optometrist: "Optometria",
  speech_therapist: "Fonoaudiologia",
  nutrition_counselling: "Nutrição",
  fitness_centre: "Academia",
  sports_centre: "Centro esportivo",
  dance: "Escola de dança",
  dojo: "Artes marciais",
  hairdresser: "Cabeleireiro / barbearia",
  beauty: "Estética",
  cosmetics: "Cosméticos",
  massage: "Massagem",
  tattoo: "Tatuagem",
  nails: "Manicure",
  car_repair: "Oficina mecânica",
  tyres: "Borracharia",
  laundry: "Lavanderia",
  dry_cleaning: "Lavanderia",
  pet_grooming: "Banho e tosa",
  tailor: "Costura",
  photo: "Fotografia",
  copyshop: "Copiadora",
  funeral_directors: "Funerária",
  car_wash: "Lava-rápido",
  driving_school: "Autoescola",
  language_school: "Escola de idiomas",
  music_school: "Escola de música",
  lawyer: "Advocacia",
  accountant: "Contabilidade",
  estate_agent: "Imobiliária",
  architect: "Arquitetura",
  insurance: "Seguros",
  electrician: "Eletricista",
  plumber: "Encanador",
  carpenter: "Marcenaria",
  photographer: "Fotógrafo",
  upholsterer: "Estofaria",
  locksmith: "Chaveiro",
  clothes: "Loja de roupas",
  shoes: "Calçados",
  gift: "Presentes",
  furniture: "Móveis",
  hardware: "Material de construção",
  florist: "Floricultura",
  pet: "Pet shop",
  books: "Livraria",
  jewelry: "Joalheria",
  optician: "Ótica",
  mobile_phone: "Celulares",
  electronics: "Eletrônicos",
  variety_store: "Variedades",
  toys: "Brinquedos",
  sports: "Artigos esportivos",
  bicycle: "Bicicletaria",
  stationery: "Papelaria",
  garden_centre: "Jardinagem",
  houseware: "Utilidades domésticas",
  interior_decoration: "Decoração",
  fabric: "Tecidos",
  bag: "Bolsas",
  boutique: "Boutique",
};

export const opportunityMeta: Record<OpportunityType, { label: string; hint: string }> = {
  sem_site: { label: "Sem site", hint: "Nenhum site próprio registrado" },
  desatualizado: { label: "Site desatualizado", hint: "Site próprio com problemas verificáveis" },
  so_redes: { label: "Só redes sociais", hint: "Instagram, Facebook, WhatsApp ou Linktree" },
  todas: { label: "Todas", hint: "Qualquer situação, classificada" },
};

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"] as const;

export const UF_NAMES: Record<(typeof UFS)[number], string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal", ES: "Espírito Santo",
  GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais", PA: "Pará", PB: "Paraíba",
  PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte", RS: "Rio Grande do Sul",
  RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};
