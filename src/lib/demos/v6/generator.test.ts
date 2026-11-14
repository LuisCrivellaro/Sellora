import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { serialize } from "node:v8";
import { beforeEach, expect, it, vi } from "vitest";
import { BUSINESSES, briefFor, goodSite } from "./fixtures/sites";
import { siteRefSchema } from "./schema";

/**
 * Pipeline V6 com Claude e Codex simulados (nenhuma geração real). O guia da skill é lido do disco de verdade,
 * então estes testes também confirmam que as referências certas entram em cada etapa.
 */
const writer = vi.hoisted(() => ({ structured: vi.fn(), estimatedUsd: 0.1 }));
const codex = vi.hoisted(() => ({ status: vi.fn(), startThread: vi.fn(), imageBuffer: vi.fn(), close: vi.fn(), suspendTimeout: vi.fn(), restartTimeout: vi.fn() }));
const qa = vi.hoisted(() => ({ browserQa: vi.fn() }));
const scope = vi.hoisted(() => ({ dir: "" }));
vi.mock("../claude-server", () => ({ ClaudeWriter: { forDemos: vi.fn(async () => writer) } }));
vi.mock("../codex-server", () => ({ demoDataRoot: () => scope.dir, LocalCodex: { connect: vi.fn(async () => codex) } }));
vi.mock("./qa-browser", async (original) => ({ ...(await original<typeof import("./qa-browser")>()), browserQa: qa.browserQa }));

import { ClaudeWriter } from "../claude-server";
import { generateV6, V6GenerationError, regressions } from "./generator";
import { postprocessSite } from "./postprocess";
import { readSiteFile, readSiteManifest, readSiteMeta } from "./store";
import { createZip, readZip } from "./zip";

const shot = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);
const okBrowser = (fixable: string[] = []) => ({ executed: true, fixable, warnings: [], shots: { "shot-1440.png": shot, "shot-390.png": shot }, viewports: [1440, 1024, 768, 390, 360], checks: ["foco do teclado (Tab)"] });
async function realPng(width = 1024, height = 1536) {
  const { default: sharp } = await import("sharp");
  return sharp({ create: { width, height, channels: 3, background: "#b98a5e" } }).png().toBuffer();
}
const request = (o: { business?: typeof BUSINESSES[keyof typeof BUSINESSES] | { name: string; city: string; uf: string; segment: string }; phone?: string; history?: Parameters<typeof generateV6>[1]["history"] } = {}) => ({ business: o.business ?? BUSINESSES.restaurante, phone: o.phone ?? "", history: o.history ?? [], imageProvider: "codex" as const });
const history = (segment: string, hero: string, fonts = ["Antonio", "Figtree"]) => ({ segment, fonts, palette: ["#101418", "#1b2128", "#f4f4f4", "#b8c0c8", "#2f7de1", "#ffffff"], sections: ["topo", "frentes", "contato"], hero, headline: "Outro título", texts: [] });

beforeEach(async () => {
  scope.dir = path.join(process.cwd(), "test-results", "v6-generator", randomUUID());
  vi.clearAllMocks();
  codex.status.mockResolvedValue({ available: true, connected: true });
  codex.startThread.mockResolvedValue("thread");
  codex.imageBuffer.mockResolvedValue({ buffer: await realPng(), width: 1024, height: 1536 });
  qa.browserQa.mockResolvedValue(okBrowser());
});

it("uma página: Claude escreve tudo, a originalidade é revalidada após a revisão, a correção resolve o problema e o ZIP bate com a prévia", async () => {
  writer.structured
    .mockResolvedValueOnce(briefFor({ hero: "colunas" }))
    .mockResolvedValueOnce(briefFor({ hero: "tipografico" }))
    .mockResolvedValueOnce({ ...goodSite(), html: goodSite().html.replace("<p>Veja o caminho no mapa.</p>", "<p>Veja o caminho no mapa. Lorem ipsum.</p>") })
    .mockResolvedValueOnce(goodSite());
  const phases: string[] = [];
  const result = await generateV6(randomUUID(), request({ history: [history("beleza", "[colunas] a"), history("saude", "[colunas] b")] }), { phase: (p) => phases.push(p) });

  expect(ClaudeWriter.forDemos).toHaveBeenCalledTimes(1);
  expect(writer.structured).toHaveBeenCalledTimes(4);
  const [brief, revision, code, fix] = writer.structured.mock.calls;
  // Cada etapa recebe só a referência dela.
  expect(brief[0]).toContain("Direção de arte e planejamento");
  expect(brief[0]).toContain("## perfil: comida");
  expect(brief[0]).not.toContain("## perfil: oficina");
  expect(brief[0]).not.toContain("Contrato técnico");
  expect(revision[0]).toContain("[colunas]");
  expect(revision[2]).toBe("medium");
  expect(code[0]).toContain("Contrato técnico");
  expect(code[0]).not.toContain("Direção de arte e planejamento");
  expect(fix[0]).toContain("Revisão e correção");
  expect(fix[0]).toContain("lorem");
  expect(fix[0]).toContain("Mantenha a direção aprovada");
  expect(fix[2]).toBe("medium");
  // Codex só recebe a especificação fotográfica, sem nome nem cidade do lead.
  const imageRequest = String(codex.imageBuffer.mock.calls[0][1]);
  expect(imageRequest).toContain("Assunto: mesa de madeira");
  expect(imageRequest).not.toContain(BUSINESSES.restaurante.name);
  for (const stage of ["Etapa 1", "Etapas 2–5", "Etapa 4", "Etapa 6", "Etapa 7", "Etapa 8", "Etapa 9", "Etapa 10", "Etapa 11"]) expect(phases.some((p) => p.startsWith(stage))).toBe(true);

  const site = result.site;
  expect(site.summary.identity?.hero).toBe("tipografico");
  expect(site.summary.hero).toMatch(/^\[tipografico\]/);
  expect(site.qa).toMatchObject({ browser: "executed", rounds: 1, fixable: [], pages: ["index.html"], imageFallback: false });
  expect(site.qa.status).toBe("warnings"); // só o aviso "sem telefone válido"
  expect(site.qa.resolved).toBeGreaterThanOrEqual(1);
  expect(site.images).toEqual([expect.objectContaining({ source: "codex", path: "assets/hero.webp" })]);
  const { default: sharp } = await import("sharp");
  const meta = await sharp((await readSiteFile(site.id, "assets/hero.webp"))!).metadata();
  expect(meta.width! / meta.height!).toBeCloseTo(0.8, 2); // recortada para a proporção 4:5 planejada

  // ZIP x prévia: os mesmos bytes que /sites/<id>/ serve.
  const manifest = (await readSiteManifest(site.id))!;
  expect(manifest.map((file) => file.path).sort()).toEqual(["assets/hero.webp", "index.html", "script.js", "styles.css"]);
  const entries = await Promise.all(manifest.map(async (file) => ({ name: `demo/${file.path}`, data: (await readSiteFile(site.id, file.path))! })));
  const zip = readZip(createZip(entries));
  for (const entry of entries) expect(zip.get(entry.name)).toEqual(entry.data);
  const html = (await readSiteFile(site.id, "index.html"))!.toString();
  expect(html).toContain("google.com/maps/search");
  expect(html).not.toContain("wa.me");
  const diagnostics = JSON.parse((await readSiteMeta(site.id, "diagnostics.json"))!.toString());
  expect(diagnostics).toMatchObject({ text: { provider: "claude", calls: 4 }, images: { engine: "codex", generated: 1, limit: 3 }, briefRounds: 1, fixRounds: 1, attempts: 1, profile: "comida" });
  expect(diagnostics.rounds[0]).toMatchObject({ accepted: true });
  expect(siteRefSchema.safeParse(site).success).toBe(true);
});

it("duas páginas: arquivos, navegação e QA por página; telefone válido vira WhatsApp", async () => {
  writer.structured.mockResolvedValueOnce(briefFor({ twoPages: true })).mockResolvedValueOnce(goodSite({ twoPages: true, phone: true }));
  const result = await generateV6(randomUUID(), request({ business: BUSINESSES.oficina, phone: "(19) 99999-0000" }), { phase: () => {} });
  expect(String(writer.structured.mock.calls[0][0])).toContain("há telefone válido");
  expect(String(writer.structured.mock.calls[0][0])).toContain("## perfil: oficina");
  expect(String(writer.structured.mock.calls[1][0])).toContain("Duas páginas: index.html e servicos.html");
  expect(qa.browserQa.mock.calls[0][1]).toMatchObject({ pages: ["index.html", "servicos.html"], fonts: ["Fraunces", "Work Sans"] });
  const site = result.site;
  expect(site.qa.pages).toEqual(["index.html", "servicos.html"]);
  expect(site.summary.pages).toEqual(["index.html", "servicos.html"]);
  const manifest = (await readSiteManifest(site.id))!.map((file) => file.path);
  expect(manifest).toEqual(expect.arrayContaining(["index.html", "servicos.html", "styles.css"]));
  const index = (await readSiteFile(site.id, "index.html"))!.toString();
  const second = (await readSiteFile(site.id, "servicos.html"))!.toString();
  expect(index).toContain('href="servicos.html"');
  expect(second).toContain('href="index.html#contato"');
  expect(index).toContain("https://wa.me/5519999990000");
  for (const page of [index, second]) expect(page).toContain("sellora-demo-notice");
});

it("cadastro com poucas informações: perfil genérico, aviso de categoria ausente e nada inventado", async () => {
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  const result = await generateV6(randomUUID(), request({ business: { name: "Casa Azul Teste", city: "Bauru", uf: "SP", segment: "outros" } }), { phase: () => {} });
  expect(String(writer.structured.mock.calls[0][0])).toContain("## perfil: presenca");
  expect(result.site.qa.warnings?.join(" ")).toContain("Cadastro sem categoria");
});

it("Codex com falha: composição SVG, demo pendente de revisão (nunca aprovada como premium)", async () => {
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  codex.imageBuffer.mockRejectedValueOnce(new Error("O limite de imagens da conta foi atingido."));
  const result = await generateV6(randomUUID(), request(), { phase: () => {} });
  expect(result.site.images).toEqual([expect.objectContaining({ source: "fallback", path: "assets/hero.svg" })]);
  expect(result.site.qa).toMatchObject({ status: "needs_review", imageFallback: true });
  expect(result.site.qa.review?.join(" ")).toContain("Imagem do Codex indisponível");
});

it("Codex indisponível: não chama a geração de imagem nem serviço pago; Claude continua escrevendo o código", async () => {
  codex.status.mockResolvedValue({ available: false, connected: false, message: "Codex sem login" });
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  qa.browserQa.mockResolvedValue({ executed: false, reason: "Nenhum Edge ou Chrome encontrado.", fixable: [], warnings: [], shots: {}, viewports: [], checks: [] });
  const result = await generateV6(randomUUID(), request({ phone: "(00) 0000-0000" }), { phase: () => {} });
  expect(String(writer.structured.mock.calls[0][0])).toContain("não há telefone válido");
  expect(codex.imageBuffer).not.toHaveBeenCalled();
  expect(result.site.qa).toMatchObject({ status: "needs_review", browser: "unavailable", viewports: [] });
  expect(result.site.qa.warnings?.join(" ")).toContain("Auditoria visual em navegador não executada");
  expect(result.site.preview).toBe(false);
});

it("Claude atinge o limite no código: falha recuperável; a retomada não refaz briefing nem imagem", async () => {
  const id = randomUUID();
  writer.structured.mockResolvedValueOnce(briefFor()).mockRejectedValueOnce(new Error("O limite de uso da conta Claude foi atingido."));
  const failure = await generateV6(id, request(), { phase: () => {} }).catch((error) => error);
  expect(failure).toBeInstanceOf(V6GenerationError);
  expect(failure.recoverable).toBe(true);
  expect(failure.message).toContain("etapas concluídas ficaram salvas");
  writer.structured.mockResolvedValueOnce(goodSite());
  const result = await generateV6(id, request(), { phase: () => {} });
  expect(writer.structured).toHaveBeenCalledTimes(3); // briefing + código que falhou + código
  expect(codex.imageBuffer).toHaveBeenCalledTimes(1);
  expect(result.site.qa.attempts).toBe(2);
});

it("problema corrigível persistente: duas rodadas, depois pendente de revisão com o problema listado", async () => {
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite()).mockResolvedValueOnce({ ...goodSite(), notes: "tentativa 1" }).mockResolvedValueOnce({ ...goodSite(), notes: "tentativa 2" });
  qa.browserQa.mockResolvedValue(okBrowser(["Rolagem horizontal em 390 px (40px a mais)."]));
  const result = await generateV6(randomUUID(), request(), { phase: () => {} });
  expect(writer.structured).toHaveBeenCalledTimes(4);
  expect(result.site.qa).toMatchObject({ status: "needs_review", rounds: 2, fixable: ["Rolagem horizontal em 390 px (40px a mais)."] });
  const diagnostics = JSON.parse((await readSiteMeta(result.site.id, "diagnostics.json"))!.toString());
  expect(diagnostics.rounds.map((round: { accepted: boolean }) => round.accepted)).toEqual([false, false]);
});

it("correção que destrói a direção (remove seções e troca o título) é descartada e a melhor versão fica", async () => {
  const destroyed = goodSite();
  destroyed.html = destroyed.html.replace(/<section id="cozinha">[\s\S]*?<\/section>/, "").replace("Comida de cantina no centro de Ribeirão Preto", "Outro título qualquer");
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite()).mockResolvedValueOnce(destroyed);
  qa.browserQa.mockResolvedValueOnce(okBrowser(["Contraste insuficiente em 390 px: p 3.9:1."])).mockResolvedValue(okBrowser());
  const result = await generateV6(randomUUID(), request(), { phase: () => {} });
  const html = (await readSiteFile(result.site.id, "index.html"))!.toString();
  expect(html).toContain('id="cozinha"');
  expect(result.site.qa.status).toBe("needs_review");
  const diagnostics = JSON.parse((await readSiteMeta(result.site.id, "diagnostics.json"))!.toString());
  expect(diagnostics.rounds[0].note).toContain("removeu seções");
  const before = postprocessSite({ code: goodSite(), business: BUSINESSES.restaurante, phone: "", assets: new Map() });
  const after = postprocessSite({ code: destroyed, business: BUSINESSES.restaurante, phone: "", assets: new Map() });
  expect(regressions(before, after).join(" ")).toMatch(/título.*seções/);
});

it("problema crítico persistente não vira demo: falha recuperável com checkpoint, até o limite de tentativas", async () => {
  const broken = { ...goodSite(), html: goodSite().html.replace('<link rel="stylesheet" href="styles.css">', "") };
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValue(broken);
  const id = randomUUID();
  const first = await generateV6(id, request(), { phase: () => {} }).catch((error) => error);
  expect(first).toBeInstanceOf(V6GenerationError);
  expect(first.message).toContain("não carrega styles.css");
  expect(first.recoverable).toBe(true);
  const second = await generateV6(id, request(), { phase: () => {} }).catch((error) => error);
  expect(second.recoverable).toBe(true);
  const third = await generateV6(id, request(), { phase: () => {} }).catch((error) => error);
  expect(third.recoverable).toBe(false);
  expect(codex.imageBuffer).toHaveBeenCalledTimes(1);
  expect(writer.structured.mock.calls.filter((call) => String(call[0]).includes("ETAPAS 2 a 5"))).toHaveLength(1);
});

it("repetição que persiste após duas revisões do briefing vira pendência de originalidade", async () => {
  const same = history("restaurantes", "[colunas] x", ["Fraunces", "Work Sans"]);
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  const result = await generateV6(randomUUID(), request({ history: [same] }), { phase: () => {} });
  expect(writer.structured.mock.calls.filter((call) => String(call[0]).includes("Revise o planejamento"))).toHaveLength(2);
  expect(result.site.qa.status).toBe("needs_review");
  expect(result.site.qa.review?.join(" ")).toContain("Fraunces");
  expect(result.site.qa.originality).toMatchObject({ compared: 1, partial: 1 });
});

it("pausa e retomada usam o checkpoint sem refazer imagem ou código; checkpoint de versão antiga é descartado com segurança", async () => {
  const id = randomUUID();
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  let steps = 0;
  await expect(generateV6(id, request(), { phase: () => {}, checkpoint: async () => { if (++steps === 2) throw new Error("Simulando fechamento após salvar etapa"); } })).rejects.toThrow("Simulando fechamento");
  const result = await generateV6(id, request(), { phase: () => {} });
  expect(codex.imageBuffer).toHaveBeenCalledTimes(1);
  expect(writer.structured).toHaveBeenCalledTimes(2);
  expect(result.site.qa.attempts).toBe(1); // pausar não conta como tentativa falha

  const legacy = randomUUID();
  const { mkdir } = await import("node:fs/promises");
  await mkdir(path.join(scope.dir, "workspace", legacy), { recursive: true });
  await writeFile(path.join(scope.dir, "workspace", legacy, "checkpoint.bin"), serialize({ brief: { analysis: {}, direction: {} }, approved: true, rounds: 0 }));
  writer.structured.mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  await generateV6(legacy, request(), { phase: () => {} });
  expect(String(writer.structured.mock.calls.at(-2)?.[0])).toContain("ETAPAS 2 a 5");
});

it("briefing com fato inventado, contraste ruim e WhatsApp sem telefone é revisado antes do código", async () => {
  const bad = briefFor({ headline: "Há 20 anos a melhor cantina, uma experiência única" });
  bad.direction.palette.muted = "#d8d0c4";
  bad.copy.primaryCta = "Chamar no WhatsApp";
  writer.structured.mockResolvedValueOnce(bad).mockResolvedValueOnce(briefFor()).mockResolvedValueOnce(goodSite());
  await generateV6(randomUUID(), request(), { phase: () => {} });
  const revision = String(writer.structured.mock.calls[1][0]);
  for (const expected of ["tempo de mercado", "experiencia unica", "texto secundário", "WhatsApp"]) expect(revision).toContain(expected);
});
