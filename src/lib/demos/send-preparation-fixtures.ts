import type { GenerationResult } from "./creation";

export const preparationLeadInput = { name: "Café São João", city: "Campinas", uf: "SP", segment: "restaurantes" as const, source: "manual" as const, website: "", websiteSituation: "sem_site" as const, stage: "novo" as const, priority: "alta" as const, phone: "(19) 99999-1234", email: "", instagram: "", potentialValue: 590, nextAction: "", nextActionAt: null, notes: "" };

export function preparationResult(): GenerationResult {
  const id = crypto.randomUUID();
  return { textProvider: "claude", imageProvider: "codex", message: "Olá! Preparei uma demonstração não oficial de site para o café. Podemos conversar sobre essa ideia?", site: {
    id, generator: "v6", title: "Café de esquina", createdAt: new Date().toISOString(),
    files: [{ path: "index.html", size: 10, sha256: "a".repeat(64) }, { path: "styles.css", size: 5, sha256: "b".repeat(64) }],
    images: [], preview: false,
    qa: { status: "passed", browser: "executed", rounds: 1, issues: [], pages: ["index.html"], viewports: [1440, 1024, 768, 390, 360], imageFallback: false,
      originality: { compared: 0, partial: 0, nearest: null, notes: [] },
      visual: { status: "approved", target: 8, initial: 8, final: 8.5, rounds: 0, criteria: [], problems: [], fixes: [], history: [], reason: null } },
    summary: { headline: "Uma pausa para café no centro", texts: ["Café de esquina em Campinas"], fonts: ["Fraunces"], palette: ["#f4efe6"], sections: ["inicio", "contato", "mapa"], hero: "foto", signature: `fraunces|${id}` },
  } };
}
