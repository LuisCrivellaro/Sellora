import { randomUUID } from "node:crypto";
import path from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { siteBriefSchema } from "./schema";

const writer = vi.hoisted(() => ({ structured: vi.fn(), estimatedUsd: 0.1 }));
const codex = vi.hoisted(() => ({ status: vi.fn(), startThread: vi.fn(), imageBuffer: vi.fn(), close: vi.fn(), suspendTimeout: vi.fn(), restartTimeout: vi.fn() }));
const qa = vi.hoisted(() => ({ browserQa: vi.fn() }));
const scope = vi.hoisted(() => ({ dir: "" }));
vi.mock("../claude-server", () => ({ ClaudeWriter: { withSystemPrompt: vi.fn(async () => writer) } }));
vi.mock("../codex-server", () => ({ demoDataRoot: () => scope.dir, LocalCodex: { connect: vi.fn(async () => codex) } }));
vi.mock("./qa-browser", () => ({ browserQa: qa.browserQa }));

import { generateV6 } from "./generator";
import { readSiteFile, readSiteManifest, readSiteMeta } from "./store";

const brief = (font: string) => siteBriefSchema.parse({
  analysis: { businessType: "lugar", specificSegment: "barbearia", confirmed: ["Nome e cidade"], unknown: ["Horários"], audienceInference: "Inferência: moradores.", commercialGoal: "Contato." },
  direction: { concept: "Barbearia de bairro com luz quente", mood: "sóbrio", displayFont: font, bodyFont: "Work Sans", typographyReason: "x", palette: { background: "#f4efe6", surface: "#e9e1d3", ink: "#1d1a16", muted: "#5a5248", accent: "#7a2e1f", accentInk: "#ffffff" }, paletteReason: "x", imageStyle: "foto quente", motion: "calma", motionPlan: "hero", tone: "direto", primaryAction: "Ver como chegar", heroComposition: "[colunas] foto ampla à direita" },
  sections: [{ id: "inicio", purpose: "hero", composition: "foto", imageId: "hero" }, { id: "servicos", purpose: "s", composition: "lista", imageId: null }, { id: "contato", purpose: "c", composition: "faixa", imageId: null }],
  images: [{ id: "hero", role: "hero", aspect: "16:9", prompt: "Cadeira de barbeiro.", alt: "Cadeira de barbeiro" }],
  differentiation: "x", message: "Olá! Preparei uma demonstração não oficial de site para a barbearia. Posso enviar o link?",
});
const page = (h1: string, extra = "") => ({ html: `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Barbearia em Campinas</title><meta name="description" content="d"><link rel="stylesheet" href="styles.css"></head><body><main><section id="inicio"><h1>${h1}</h1><img src="assets/hero.webp" alt="Cadeira" width="10" height="10"><a href="{{MAPS_LINK}}" target="_blank" rel="noopener">Ver como chegar</a></section><section id="contato">${extra}</section></main></body></html>`, css: "body{margin:0}@media (max-width:600px){h1{font-size:2rem}}", js: "", notes: "" });
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), Buffer.alloc(30)]);

beforeEach(() => {
  scope.dir = path.join(process.cwd(), "test-results", "v6-generator", randomUUID());
  vi.clearAllMocks();
  codex.status.mockResolvedValue({ available: true, connected: true });
  codex.startThread.mockResolvedValue("thread");
  qa.browserQa.mockResolvedValue({ executed: true, fixable: [], warnings: [], shots: { "shot-1440.png": png } });
});

it("executa as etapas, corrige direção repetida e código com problema, usa fallback quando a imagem falha e grava o site", async () => {
  writer.structured
    .mockResolvedValueOnce(brief("Bebas Neue"))
    .mockResolvedValueOnce(brief("Fraunces"))
    .mockResolvedValueOnce(page("Barbearia em Campinas", "<p>Lorem ipsum</p>"))
    .mockResolvedValueOnce(page("Barbearia em Campinas"));
  codex.imageBuffer.mockRejectedValueOnce(new Error("falha temporária"));
  const phases: string[] = [];
  const history = [{ segment: "beleza", fonts: ["Bebas Neue", "Inter"], palette: [], sections: ["a"], hero: "outro", headline: "x", texts: [] }];
  const result = await generateV6(randomUUID(), { business: { name: "Barbearia Teste", city: "Campinas", uf: "SP", segment: "beleza" }, phone: "", history, textProvider: "claude", imageProvider: "codex" }, { phase: (p) => phases.push(p) });

  expect(writer.structured).toHaveBeenCalledTimes(4);
  expect(writer.structured.mock.calls[1][2]).toBe("medium");
  expect(writer.structured.mock.calls[3][2]).toBe("medium");
  expect(writer.structured.mock.calls[3][0]).toContain("lorem");
  expect(phases.some((p) => p.startsWith("Etapa 6"))).toBe(true);
  const site = result.site;
  expect(site.summary.fonts[0]).toBe("Fraunces");
  expect(site.qa).toMatchObject({ browser: "executed", rounds: 1 });
  expect(site.images.map((image) => image.source)).toEqual(["fallback"]);
  expect(site.qa.issues.join(" ")).toContain("falha temporária");
  const manifest = await readSiteManifest(site.id);
  expect(manifest?.map((file) => file.path)).toEqual(expect.arrayContaining(["index.html", "styles.css", site.images[0].path]));
  const html = (await readSiteFile(site.id, "index.html"))!.toString();
  expect(html).toContain(site.images[0].path);
  expect(html).toContain("google.com/maps/search");
  expect(html).toContain("sellora-demo-notice");
  expect(await readSiteMeta(site.id, "shot-1440.png")).toEqual(png);
  expect(JSON.parse((await readSiteMeta(site.id, "qa.json"))!.toString()).imageEngine).toBe("codex");
  expect(codex.close).toHaveBeenCalled();
  expect(codex.imageBuffer).toHaveBeenCalledTimes(1);
});

it("sem nenhum gerador de imagem a demo sai com composições SVG, sem chamar serviço pago", async () => {
  codex.status.mockResolvedValue({ available: false, connected: false, message: "Codex sem login" });
  writer.structured.mockResolvedValueOnce(brief("Fraunces")).mockResolvedValueOnce(page("Barbearia em Campinas"));
  qa.browserQa.mockResolvedValue({ executed: false, reason: "Nenhum Edge ou Chrome encontrado.", fixable: [], warnings: [], shots: {} });
  // Telefone inválido conta como "sem telefone": o modelo não pode criar "Ligar para" sem número.
  const result = await generateV6(randomUUID(), { business: { name: "Barbearia Teste", city: "Campinas", uf: "SP", segment: "beleza" }, phone: "(00) 0000-0000", history: [], textProvider: "claude", imageProvider: "codex" }, { phase: () => {} });
  expect(String(writer.structured.mock.calls[0][0])).toContain("não há telefone cadastrado");
  expect(result.site.images.every((image) => image.source === "fallback" && image.path.endsWith(".svg"))).toBe(true);
  expect(result.site.qa.browser).toBe("unavailable");
  expect(result.site.preview).toBe(false);
  expect(codex.imageBuffer).not.toHaveBeenCalled();
});

it("hero: arquétipo marcado ou inferido e rotação entre as duas demos mais recentes de qualquer segmento", async () => {
  const { heroArchetype, recentHeroIssue } = await import("./generator");
  // As três demos de teste de 2026-11-12 (briefs reais, sem id de arquétipo) caem em foto-painel.
  expect(heroArchetype("Fotografia de ponta a ponta em 100svh. Um painel plano de cor creme, ancorado embaixo à esquerda.")).toBe("foto-painel");
  expect(heroArchetype("[colunas] texto à esquerda e imagem recortada à direita")).toBe("colunas");
  expect(heroArchetype("[inventado] algo")).toBeNull();
  const recent = [{ hero: "Fotografia de ponta a ponta com faixa escura" }, { hero: "[grade] três imagens" }, { hero: "[colunas] antigo" }];
  expect(recentHeroIssue("[foto-painel] foto inteira com painel", recent)).toContain("[foto-painel]");
  expect(recentHeroIssue("[grade] duas imagens", recent)).toContain("[grade]");
  expect(recentHeroIssue("[colunas] texto e imagem", recent)).toBeNull();
  expect(recentHeroIssue("hero bonito", recent)).toContain("arquétipo do guia");
});

it("retoma do checkpoint salvo sem gerar novamente a imagem ou o código", async () => {
  const id = randomUUID();
  const input = { business: { name: "Barbearia Teste", city: "Campinas", uf: "SP", segment: "beleza" }, phone: "", history: [], textProvider: "claude" as const, imageProvider: "codex" as const };
  writer.structured.mockResolvedValueOnce(brief("Fraunces")).mockResolvedValueOnce(page("Barbearia em Campinas"));
  codex.imageBuffer.mockResolvedValueOnce({ buffer: png, width: 1600, height: 900 });
  let steps = 0;
  await expect(generateV6(id, input, { phase: () => {}, checkpoint: async () => { if (++steps === 2) throw new Error("Simulando fechamento após salvar etapa"); } })).rejects.toThrow("Simulando fechamento");
  const result = await generateV6(id, input, { phase: () => {} });
  expect(result.site.images).toHaveLength(1);
  expect(codex.imageBuffer).toHaveBeenCalledTimes(1);
  expect(writer.structured).toHaveBeenCalledTimes(2);
  expect(result.site.qa.browser).toBe("executed");
});
