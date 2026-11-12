import type { GeneratedCreation } from "./creation";
import type { Lead } from "../types";

export const generatedFixture: GeneratedCreation = {
  id: "7bc0fa69-9589-4298-ac92-a0bac8ba7594", name: "Luz e movimento", layout: "offset", typography: "serif",
  photoSide: "right", photoShape: "arch", sectionStyle: "alternating", paper: "#f6eddf", ink: "#352b23", accent: "#724527",
  headline: "O seu próximo olhar começa aqui.", intro: "Uma referência guardada, uma ideia nova e um momento para conversar sobre o que você imagina.", cta: "Traga sua inspiração",
  sections: [{ title: "Referências que abrem possibilidades", body: "Conheça o negócio e compartilhe a ideia que chamou sua atenção. As opções de atendimento precisam ser confirmadas diretamente." }, { title: "Planeje o seu momento", body: "Converse com o estabelecimento para confirmar endereço, horários e as informações necessárias antes de uma visita." }],
  image: { src: "/api/demos/media/" + "a".repeat(64), sourceHash: "a".repeat(64), alt: "Composição ilustrativa exclusiva criada por IA", width: 1536, height: 1024 },
};
export const demoLeadFixture = {
  id: "568b172a-4d72-4858-9882-c04bb438aeda", name: "Studio Horizonte", city: "Campinas", uf: "SP", segment: "beleza", phone: "", email: "", notes: "PRIVADO", createdAt: "2026-11-12T12:00:00Z", updatedAt: "2026-11-12T12:00:00Z",
} as Lead;
