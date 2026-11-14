import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { BUSINESSES, briefFor, goodSite, visualReviewFixture } from "./fixtures/sites";

/**
 * Pipeline V6 com três imagens, bloqueantes e revisão de impacto visual. Claude, Codex e navegador simulados
 * (nenhuma geração real, nenhum crédito); as capturas são PNGs reais para o preparo das imagens do avaliador rodar.
 */
const writer = vi.hoisted(() => ({ structured: vi.fn(), structuredWithImages: vi.fn(), estimatedUsd: 0 }));
const codex = vi.hoisted(() => ({ status: vi.fn(), startThread: vi.fn(), imageBuffer: vi.fn(), close: vi.fn(), suspendTimeout: vi.fn(), restartTimeout: vi.fn() }));
const qa = vi.hoisted(() => ({ browserQa: vi.fn() }));
const scope = vi.hoisted(() => ({ dir: "" }));
vi.mock("../claude-server", () => ({ ClaudeWriter: { forDemos: vi.fn(async () => writer) } }));
vi.mock("../codex-server", () => ({ demoDataRoot: () => scope.dir, LocalCodex: { connect: vi.fn(async () => codex) } }));
vi.mock("./qa-browser", async (original) => ({ ...(await original<typeof import("./qa-browser")>()), browserQa: qa.browserQa }));

import { generateV6 } from "./generator";
import { PRESENCE_RULES } from "./prompts";
import { qaGroups, qaStatusLabel } from "./qa-label";
import { readSiteFile, readSiteManifest, readSiteMeta } from "./store";

let shots: Record<string, Buffer> = {};
const okBrowser = (fixable: string[] = [], blocking: string[] = []) => ({ executed: true, fixable: [...blocking, ...fixable], blocking, warnings: [], shots, viewports: [1440, 1024, 768, 390, 360], checks: ["foco do teclado (Tab)"] });
const request = (o: { phone?: string } = {}) => ({ business: BUSINESSES.restaurante, phone: o.phone ?? "", history: [], imageProvider: "codex" as const });
const run = (id = randomUUID(), checkpoint?: () => Promise<void>) => generateV6(id, request(), { phase: () => {}, checkpoint });
const diagnosticsOf = async (id: string) => JSON.parse((await readSiteMeta(id, "diagnostics.json"))!.toString());
/** Correção visual que recompõe o hero sem trocar título, fontes, seções ou páginas. */
const recomposed = () => { const site = goodSite(); return { ...site, html: site.html.replace('class="hero"', 'class="hero hero-sangra"'), css: `${site.css}.hero-sangra{grid-template-columns:7fr 5fr}`, notes: "hero recomposto" }; };
const low = () => visualReviewFixture({ firstScreen: 6, composition: 6 }); // 7,4

beforeEach(async () => {
  scope.dir = path.join(process.cwd(), "test-results", "v6-visual", randomUUID());
  vi.clearAllMocks();
  const { default: sharp } = await import("sharp");
  const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#efe6d6" } }).png().toBuffer();
  shots = { "shot-1440.png": await png(1440, 900), "shot-390.png": await png(390, 844), "shot-1440-full.png": await png(720, 2400), "shot-390-full.png": await png(312, 3000) };
  codex.status.mockResolvedValue({ available: true, connected: true });
  codex.startThread.mockResolvedValue("thread");
  codex.imageBuffer.mockImplementation(async () => ({ buffer: await sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#b98a5e" } }).png().toBuffer() }));
  qa.browserQa.mockResolvedValue(okBrowser());
  writer.structuredWithImages.mockResolvedValue(visualReviewFixture());
});
afterEach(() => { vi.unstubAllEnvs(); });

it("três imagens com papéis distintos: Codex gera cada uma uma vez, o site usa as três e a revisão visual aprova", async () => {
  writer.structured.mockResolvedValueOnce(briefFor({ imageSet: true, motion: "calma", signature: "Salão em largura total cortando a página clara." })).mockResolvedValueOnce(goodSite({ imageSet: true }));
  const result = await run();
  const prompts = codex.imageBuffer.mock.calls.map((call) => String(call[1]));
  expect(prompts).toHaveLength(3);
  expect(new Set(prompts).size).toBe(3);
  expect(prompts[0]).toContain("Papel no site: hero editorial");
  expect(prompts[1]).toContain(PRESENCE_RULES.figurantes);
  expect(prompts[2]).toContain(PRESENCE_RULES.maos);
  expect(result.site.images.map((image) => [image.path, image.source])).toEqual([["assets/hero.webp", "codex"], ["assets/salao.webp", "codex"], ["assets/preparo.webp", "codex"]]);
  expect(new Set(result.site.images.map((image) => image.sha256)).size).toBeGreaterThanOrEqual(1);
  const html = (await readSiteFile(result.site.id, "index.html"))!.toString();
  for (const file of ["assets/hero.webp", "assets/salao.webp", "assets/preparo.webp"]) expect(html).toContain(file);
  expect(html).toContain("Imagens ilustrativas");
  // Revisão visual com capturas reais: uma chamada, imagens rotuladas, nota calculada pela aplicação.
  expect(writer.structuredWithImages).toHaveBeenCalledTimes(1);
  const [prompt, images, , effort] = writer.structuredWithImages.mock.calls[0];
  expect(String(prompt)).toContain("REVISÃO DE IMPACTO VISUAL");
  expect(String(prompt)).toContain("Salão em largura total");
  expect(effort).toBe("medium");
  expect(images.length).toBeGreaterThanOrEqual(4);
  expect(images[0]).toMatchObject({ label: expect.stringContaining("primeira tela no desktop"), mediaType: "image/jpeg" });
  expect(result.site.qa.visual).toMatchObject({ status: "approved", initial: 8.5, final: 8.5, rounds: 0, target: 8 });
  expect(result.site.qa.status).toBe("warnings"); // só o aviso "sem telefone válido"
  const diagnostics = await diagnosticsOf(result.site.id);
  expect(diagnostics.images).toMatchObject({ engine: "codex", generated: 3, limit: 3 });
  expect(diagnostics.requests.map((item: { presence: string }) => item.presence)).toEqual(["sem-pessoas", "figurantes", "maos"]);
  expect(diagnostics.visualReview).toMatchObject({ calls: 1, status: "approved", limitRounds: 2 });
  expect(diagnostics.text.calls).toBe(2);
  expect(JSON.parse((await readSiteMeta(result.site.id, "visual-review.json"))!.toString()).criteria).toHaveLength(6);
  expect((await readSiteManifest(result.site.id))!.map((file) => file.path)).toEqual(expect.arrayContaining(["assets/hero.webp", "assets/salao.webp", "assets/preparo.webp"]));
});

it("abaixo de 8: correção direcionada, novo QA técnico e reavaliação; a versão melhor entra e o histórico fica registrado", async () => {
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite()).mockResolvedValueOnce(recomposed());
  writer.structuredWithImages.mockResolvedValueOnce(low()).mockResolvedValueOnce(visualReviewFixture());
  const result = await run();
  expect(qa.browserQa).toHaveBeenCalledTimes(2); // QA técnico da versão corrigida antes da reavaliação
  const fix = String(writer.structured.mock.calls[2][0]);
  expect(fix).toContain("correção de impacto visual. Nota atual 7.4; meta 8,0");
  expect(fix).toContain("Correções priorizadas pela avaliação: 1. [hero · seção inicio] Recompor o hero");
  expect(fix).toContain("Preserve o que já funciona: A combinação de serifa");
  expect(fix).toContain("não peça novas");
  expect(writer.structured.mock.calls[2][2]).toBe("high");
  expect((await readSiteFile(result.site.id, "index.html"))!.toString()).toContain("hero-sangra");
  expect(result.site.qa.visual).toMatchObject({ status: "approved", initial: 7.4, final: 8.5, rounds: 1 });
  expect(result.site.qa.visual?.history).toEqual([
    { round: 0, score: 7.4, accepted: true, note: "avaliação inicial" },
    { round: 1, score: 8.5, accepted: true, note: "aceita: 7.4 → 8.5" },
  ]);
  const diagnostics = await diagnosticsOf(result.site.id);
  expect(diagnostics.visualReview).toMatchObject({ calls: 3, initial: 7.4, final: 8.5 });
  expect(diagnostics.text.calls).toBe(2); // briefing + código; a revisão visual tem orçamento próprio
  expect(codex.imageBuffer).toHaveBeenCalledTimes(1); // imagens nunca são regeradas na revisão visual
  expect(qaGroups(result.site.qa).find((group) => group.title.startsWith("Impacto visual"))?.items[0]).toContain("impacto visual 7,4 → 8,5/10 (meta 8,0, atingida)");
});

it("nota baixa persistente: no máximo 2 rodadas (5 chamadas visuais), depois pendente de revisão com os problemas", async () => {
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite()).mockResolvedValueOnce(recomposed()).mockResolvedValueOnce({ ...recomposed(), notes: "segunda tentativa" });
  writer.structuredWithImages.mockResolvedValue(low());
  const result = await run();
  expect(writer.structuredWithImages).toHaveBeenCalledTimes(3);
  expect(writer.structured).toHaveBeenCalledTimes(4);
  expect(result.site.qa.visual).toMatchObject({ status: "below_target", initial: 7.4, final: 7.4, rounds: 2 });
  expect(result.site.qa.visual?.history.slice(1).map((entry) => entry.note)).toEqual(["descartada: nota 7.4 não supera 7.4", "descartada: nota 7.4 não supera 7.4"]);
  expect(result.site.qa.status).toBe("needs_review");
  expect(result.site.qa.review?.join(" ")).toContain("Impacto visual 7.4 abaixo da meta 8 depois de 2 rodada(s)");
  expect((await readSiteFile(result.site.id, "index.html"))!.toString()).not.toContain("hero-sangra"); // a versão original fica
  expect((await diagnosticsOf(result.site.id)).visualReview.calls).toBe(5);
  expect(codex.imageBuffer).toHaveBeenCalledTimes(1);
});

it("correção visual que cria problema técnico (texto sobreposto) é descartada sem gastar reavaliação", async () => {
  vi.stubEnv("SELLORA_DEMO_VISUAL_REVIEW_ROUNDS", "1");
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite()).mockResolvedValueOnce(recomposed());
  writer.structuredWithImages.mockResolvedValue(low());
  const overlap = 'Textos sobrepostos em 390 px: h1 "Comida de cantina" × p "Massas e pratos" (300×40 px, a 120 px do topo).';
  qa.browserQa.mockResolvedValueOnce(okBrowser()).mockResolvedValueOnce(okBrowser([], [overlap]));
  const result = await run();
  expect(writer.structuredWithImages).toHaveBeenCalledTimes(1);
  expect(result.site.qa.visual?.history[1]).toMatchObject({ round: 1, accepted: false, score: null });
  expect(result.site.qa.visual?.history[1].note).toContain("descartada: criou problema técnico (Textos sobrepostos");
  expect(result.site.qa.blocking).toEqual([]); // o site entregue é o anterior, sem o defeito
  expect((await readSiteFile(result.site.id, "index.html"))!.toString()).not.toContain("hero-sangra");
});

it("avaliador indisponível ou genérico: visual_review_unavailable, demo entregue sem nota inventada", async () => {
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  writer.structuredWithImages.mockRejectedValueOnce(new Error("O limite de uso da conta Claude foi atingido."));
  const failed = await run();
  expect(failed.site.qa.visual).toMatchObject({ status: "visual_review_unavailable", initial: null, final: null, criteria: [] });
  expect(failed.site.qa.visual?.reason).toContain("limite de uso");
  expect(failed.site.qa.status).toBe("warnings");
  expect(failed.site.qa.review?.join(" ")).toContain("Revisão de impacto visual indisponível");
  expect(await readSiteMeta(failed.site.id, "visual-review.json")).toBeNull();

  const generic = visualReviewFixture();
  generic.criteria.firstScreen.evidence = "O site é bonito e transmite um visual profissional e moderno para o negócio.";
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  writer.structuredWithImages.mockResolvedValueOnce(generic);
  const vague = await run();
  expect(vague.site.qa.visual?.status).toBe("visual_review_unavailable");
  expect(vague.site.qa.visual?.reason).toContain("genérica");
});

it("revisão visual desligada (0 rodadas) ou sem navegador: nenhuma chamada visual", async () => {
  vi.stubEnv("SELLORA_DEMO_VISUAL_REVIEW_ROUNDS", "0");
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  const off = await run();
  expect(off.site.qa.visual).toMatchObject({ status: "disabled" });
  vi.unstubAllEnvs();
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  qa.browserQa.mockResolvedValue({ executed: false, reason: "Nenhum Edge ou Chrome encontrado.", fixable: [], blocking: [], warnings: [], shots: {}, viewports: [], checks: [] });
  const noBrowser = await run();
  expect(noBrowser.site.qa.visual?.status).toBe("visual_review_unavailable");
  expect(noBrowser.site.qa.visual?.reason).toContain("navegador");
  expect(writer.structuredWithImages).not.toHaveBeenCalled();
});

it("sobreposição bloqueante vem primeiro na correção, é revalidada e some; persistente fica listada e impede aprovação", async () => {
  const overlap = 'Textos sobrepostos em 390 px: h1 "Comida de cantina" × p "Massas e pratos" (300×40 px, a 120 px do topo).';
  const lorem = { ...goodSite(), html: goodSite().html.replace("<p>Veja o caminho no mapa.</p>", "<p>Veja o caminho no mapa. Lorem ipsum.</p>") };
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(lorem).mockResolvedValueOnce(goodSite());
  qa.browserQa.mockResolvedValueOnce(okBrowser([], [overlap])).mockResolvedValue(okBrowser());
  const fixed = await run();
  const prompt = String(writer.structured.mock.calls[2][0]);
  expect(prompt.indexOf("Textos sobrepostos")).toBeGreaterThan(-1);
  expect(prompt.indexOf("Textos sobrepostos")).toBeLessThan(prompt.indexOf("lorem"));
  expect(fixed.site.qa).toMatchObject({ rounds: 1, blocking: [], fixable: [] });
  expect(qa.browserQa.mock.calls.length).toBeGreaterThanOrEqual(2);

  vi.clearAllMocks();
  writer.structuredWithImages.mockResolvedValue(visualReviewFixture());
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite()).mockResolvedValueOnce({ ...goodSite(), notes: "1" }).mockResolvedValueOnce({ ...goodSite(), notes: "2" });
  qa.browserQa.mockResolvedValue(okBrowser([], [overlap]));
  const stuck = await run();
  expect(stuck.site.qa).toMatchObject({ status: "needs_review", rounds: 2, blocking: [overlap] });
  expect(qaStatusLabel(stuck.site.qa)).toContain("1 defeito(s) bloqueante(s)");
  expect(qaGroups(stuck.site.qa)[0]).toEqual({ title: "Bloqueantes (impedem a aprovação)", items: [overlap] });
  expect((await readSiteFile(stuck.site.id, "index.html"))!.toString()).toContain("Comida de cantina"); // arquivos preservados
});

it("pausa logo depois de uma correção visual aceita: a retomada não perde a correção nem refaz imagem ou código", async () => {
  const id = randomUUID();
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite()).mockResolvedValueOnce(recomposed());
  writer.structuredWithImages.mockResolvedValueOnce(low()).mockResolvedValueOnce(visualReviewFixture()).mockResolvedValue(visualReviewFixture());
  let paused = false;
  const pauseAfterAccept = async () => { if (!paused && writer.structuredWithImages.mock.calls.length === 2) { paused = true; throw new Error("Simulando pausa"); } };
  await expect(run(id, pauseAfterAccept)).rejects.toThrow("Simulando pausa");
  const result = await run(id);
  expect(writer.structured).toHaveBeenCalledTimes(3); // briefing, código e uma correção visual; nada refeito
  expect(codex.imageBuffer).toHaveBeenCalledTimes(1);
  expect((await readSiteFile(result.site.id, "index.html"))!.toString()).toContain("hero-sangra");
  expect(result.site.qa.visual).toMatchObject({ status: "approved", final: 8.5 });
  expect(result.site.qa.attempts).toBe(1);
});

it("Codex atinge o limite na segunda de três imagens: as restantes viram composição SVG e a demo fica pendente", async () => {
  writer.structured.mockResolvedValueOnce(briefFor({ imageSet: true })).mockResolvedValueOnce(goodSite({ imageSet: true }));
  const { default: sharp } = await import("sharp");
  codex.imageBuffer.mockReset();
  codex.imageBuffer.mockResolvedValueOnce({ buffer: await sharp({ create: { width: 1024, height: 1536, channels: 3, background: "#b98a5e" } }).png().toBuffer() }).mockRejectedValueOnce(new Error("O limite de imagens da conta foi atingido."));
  const result = await run();
  expect(codex.imageBuffer).toHaveBeenCalledTimes(2);
  expect(result.site.images.map((image) => image.source)).toEqual(["codex", "fallback", "fallback"]);
  const html = (await readSiteFile(result.site.id, "index.html"))!.toString();
  expect(html).toContain("assets/salao.svg");
  expect(html).toContain("assets/preparo.svg");
  expect(result.site.qa).toMatchObject({ status: "needs_review", imageFallback: true });
});
