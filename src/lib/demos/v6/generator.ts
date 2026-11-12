import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { ClaudeWriter, type ClaudeEffort } from "../claude-server";
import { demoDataRoot, LocalCodex } from "../codex-server";
import { normalizeCreativeText } from "../concepts";
import type { DemoImageProvider, DemoTextProvider } from "../creation";
import { fallbackArtwork, optimizeForWeb, type ImageEngine } from "./images";
import { postprocessSite } from "./postprocess";
import { normalizeWhatsappPhone } from "../whatsapp";
import { briefPrompt, codePrompt, correctBriefPrompt, fixPrompt, imagePrompt, v6Instructions, type V6Business, type V6HistoryItem } from "./prompts";
import { browserQa } from "./qa-browser";
import { headlineOf, staticQa, visibleText } from "./qa-static";
import { siteBriefSchema, siteCodeSchema, siteRefSchema, siteSignature, type SiteBrief, type SiteCode, type SiteRef } from "./schema";
import { sha256, writeSite } from "./store";

/** Limites de consumo por demo: evitam loops e gasto excessivo de cota. */
export const V6_LIMITS = { generatedImages: 3, briefCorrections: 1, fixRounds: 1 } as const;

export interface V6Request {
  business: V6Business;
  phone: string;
  history: V6HistoryItem[];
  textProvider: DemoTextProvider;
  imageProvider: DemoImageProvider;
}
export interface V6Progress { phase: (text: string) => void }
export interface V6Result { site: SiteRef; message: string; estimatedUsd: number | null; imageEngine: ImageEngine }

interface Writer { structured<T>(prompt: string, schema: z.ZodType<T>, effort: ClaudeEffort): Promise<T>; estimatedUsd: number | null; close(): void }

async function openWriter(provider: DemoTextProvider, workspace: string, instructions: string): Promise<Writer> {
  if (provider === "claude") {
    const claude = await ClaudeWriter.withSystemPrompt(workspace, instructions, "v6-system-prompt.md");
    return { structured: (prompt, schema, effort) => claude.structured(prompt, schema, effort), get estimatedUsd() { return Math.round(claude.estimatedUsd * 10_000) / 10_000; }, close() {} };
  }
  const codex = await LocalCodex.connect(workspace, () => {}, 20 * 60_000);
  const status = await codex.status();
  if (!status.connected) { codex.close(); throw new Error(status.message); }
  const thread = await codex.startThread(workspace, instructions);
  return { structured: (prompt, schema) => codex.structured(thread, prompt, schema), estimatedUsd: null, close: () => codex.close() };
}

/**
 * Imagens só pelo Codex da conta ChatGPT do computador (sem API paga). Sem Codex com geração de imagem
 * disponível, cada imagem vira a composição gráfica gratuita (SVG) e o motivo fica registrado.
 */
async function resolveImageEngine(workspace: string): Promise<{ engine: ImageEngine; codex?: LocalCodex; thread?: string; note?: string }> {
  try {
    const codex = await LocalCodex.connect(workspace, () => {}, 20 * 60_000);
    const status = await codex.status();
    if (status.available) return { engine: "codex", codex, thread: await codex.startThread(workspace, "Você gera imagens ilustrativas para sites de demonstração. Use somente a ferramenta nativa de geração de imagens.") };
    codex.close();
    return { engine: "fallback", note: status.message };
  } catch (error) {
    return { engine: "fallback", note: error instanceof Error ? error.message : "Codex indisponível." };
  }
}

function historyIssues(brief: SiteBrief, history: V6HistoryItem[], segment: string): string[] {
  const issues: string[] = [];
  const same = history.filter((item) => item.segment === segment).slice(0, 12);
  const font = brief.direction.displayFont.toLowerCase();
  const sections = brief.sections.map((section) => section.id).join(">");
  for (const item of same) {
    if (item.fonts[0]?.toLowerCase() === font) issues.push(`A fonte de destaque ${brief.direction.displayFont} já foi usada em outra demo do segmento.`);
    if (item.sections.join(">") === sections) issues.push("A sequência de seções repete uma demo anterior do segmento.");
    if (item.palette[4] && item.palette[4].toLowerCase() === brief.direction.palette.accent.toLowerCase()) issues.push("A cor de destaque repete uma demo anterior do segmento.");
    if (normalizeCreativeText(item.hero) === normalizeCreativeText(brief.direction.heroComposition)) issues.push("A composição do hero repete uma demo anterior do segmento.");
  }
  return [...new Set(issues)];
}

export function summarize(html: string, brief: SiteBrief): SiteRef["summary"] {
  const chunks = [...html.matchAll(/<(h1|h2|h3|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => visibleText(m[2])).filter((t) => t.length >= 12 && !t.startsWith("Demonstração não oficial criada pela Sellora"));
  const p = brief.direction.palette;
  return {
    headline: (headlineOf(html) || brief.direction.concept).slice(0, 200),
    texts: chunks.slice(0, 24).map((t) => t.slice(0, 600)),
    fonts: [brief.direction.displayFont, brief.direction.bodyFont],
    palette: [p.background, p.surface, p.ink, p.muted, p.accent, p.accentInk],
    sections: brief.sections.map((section) => section.id),
    hero: brief.direction.heroComposition,
    signature: siteSignature(brief).slice(0, 300),
  };
}

export async function generateV6(jobId: string, request: V6Request, progress: V6Progress): Promise<V6Result> {
  const workspace = path.join(demoDataRoot(), "workspace", jobId);
  await mkdir(workspace, { recursive: true });
  const instructions = await v6Instructions();
  // Só um telefone que vira link válido conta: um número inválido seria apagado no pós-processamento e
  // deixaria chamadas como "Ligar para" sem o número.
  const contact = { hasPhone: !!normalizeWhatsappPhone(request.phone) };
  let writer: Writer | undefined;
  let images: Awaited<ReturnType<typeof resolveImageEngine>> | undefined;
  try {
    progress.phase("Conferindo geradores de texto e imagem");
    images = await resolveImageEngine(workspace);
    writer = await openWriter(request.textProvider, workspace, instructions);

    progress.phase("Etapas 1–3: analisando o negócio e definindo a direção de arte");
    const firstPrompt = briefPrompt(request.business, contact, request.history);
    let brief = await writer.structured(firstPrompt, siteBriefSchema, "high");
    for (let round = 0; round < V6_LIMITS.briefCorrections; round += 1) {
      const issues = historyIssues(brief, request.history, request.business.segment);
      if (!issues.length) break;
      progress.phase("Revisando a direção para não repetir demos anteriores");
      brief = await writer.structured(`${firstPrompt}\n\nSeu briefing anterior: ${JSON.stringify(brief)}\n\n${correctBriefPrompt(issues)}`, siteBriefSchema, "medium");
    }

    progress.phase(`Etapa 4: escrevendo o código e gerando ${brief.images.length} imagem(ns)`);
    const imageJob = produceImages(brief, request, images, progress);
    // Com Codex escrevendo o texto e gerando a imagem, o mesmo app-server atende um turno por vez.
    const codeFirst = request.textProvider === "codex";
    let code: SiteCode;
    let assets: Awaited<typeof imageJob>;
    if (codeFirst) { code = await writer.structured(codePrompt(request.business, brief, contact), siteCodeSchema, "high"); assets = await imageJob; }
    else [code, assets] = await Promise.all([writer.structured(codePrompt(request.business, brief, contact), siteCodeSchema, "high"), imageJob]);

    const assetPaths = new Map(assets.map((asset) => [asset.id, asset.path]));
    const assetFiles = assets.map((asset) => asset.path);
    const historyTexts = request.history.filter((item) => item.segment === request.business.segment).map((item) => ({ headline: item.headline, texts: item.texts }));
    let rounds = 0;
    let final = postprocessSite({ code, business: request.business, phone: request.phone, assets: assetPaths });
    let checked = await audit(final, brief, assetFiles, assets, historyTexts, workspace, progress);
    while ((checked.critical.length || checked.fixable.length) && rounds < V6_LIMITS.fixRounds) {
      rounds += 1;
      progress.phase(`Etapa 5: corrigindo ${checked.critical.length + checked.fixable.length} problema(s) encontrados`);
      code = await writer.structured(`${codePrompt(request.business, brief, contact)}\n\n${fixPrompt(code, [...checked.critical, ...checked.fixable])}`, siteCodeSchema, "medium");
      final = postprocessSite({ code, business: request.business, phone: request.phone, assets: assetPaths });
      checked = await audit(final, brief, assetFiles, assets, historyTexts, workspace, progress);
    }
    if (checked.critical.length) throw new Error(`A demo não passou nas verificações obrigatórias: ${checked.critical.join(" ")}`);

    progress.phase("Etapa 7: salvando código, imagens e capturas");
    const siteId = randomUUID();
    const files = new Map<string, Buffer>([["index.html", Buffer.from(final.html, "utf8")], ["styles.css", Buffer.from(final.css, "utf8")]]);
    if (final.js) files.set("script.js", Buffer.from(final.js, "utf8"));
    for (const asset of assets) files.set(asset.path, asset.data);
    const qa = {
      status: checked.fixable.length || checked.warnings.length ? "warnings" as const : "passed" as const,
      browser: checked.browser ? "executed" as const : "unavailable" as const,
      rounds,
      issues: [...checked.fixable, ...checked.warnings, ...final.notes, ...(checked.browserNote ? [checked.browserNote] : []), ...assets.filter((a) => a.error).map((a) => `Imagem ${a.id}: ${a.error}`)].slice(0, 30).map((issue) => issue.slice(0, 300)),
    };
    const manifest = await writeSite(siteId, files, {
      "brief.json": JSON.stringify(brief, null, 2),
      "qa.json": JSON.stringify({ ...qa, viewports: checked.browser ? [1440, 1024, 768, 390] : [], imageEngine: images.engine, imageNote: images.note ?? null }, null, 2),
      "site.json": JSON.stringify({ businessName: request.business.name, city: request.business.city, uf: request.business.uf, generator: "v6", textProvider: request.textProvider, createdAt: new Date().toISOString() }, null, 2),
      ...checked.shots,
    });
    const site = siteRefSchema.parse({
      id: siteId, generator: "v6", title: brief.direction.concept.slice(0, 120), createdAt: new Date().toISOString(), files: manifest,
      images: assets.map((asset) => ({ id: asset.id, path: asset.path, source: asset.source, sha256: sha256(asset.data), alt: asset.alt })),
      preview: !!checked.shots["shot-1440.png"], summary: summarize(final.html, brief), qa,
    });
    return { site, message: brief.message, estimatedUsd: writer.estimatedUsd, imageEngine: images.engine };
  } finally {
    writer?.close();
    images?.codex?.close();
    await rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}

async function produceImages(brief: SiteBrief, request: V6Request, images: Awaited<ReturnType<typeof resolveImageEngine>>, progress: V6Progress) {
  const out: { id: string; path: string; data: Buffer; source: ImageEngine; alt: string; error?: string }[] = [];
  let engine = images.engine;
  for (const [index, image] of brief.images.entries()) {
    const hero = index === 0;
    let error: string | undefined;
    if (engine !== "fallback" && index < V6_LIMITS.generatedImages) {
      try {
        progress.phase(`Gerando imagem ${index + 1} de ${brief.images.length} (Codex)`);
        const raw = (await images.codex!.imageBuffer(images.thread!, imagePrompt(image, brief))).buffer;
        const optimized = await optimizeForWeb(raw, hero);
        out.push({ id: image.id, path: `assets/${image.id}.${optimized.extension}`, data: optimized.data, source: engine, alt: image.alt });
        continue;
      } catch (failure) {
        error = failure instanceof Error ? failure.message : "falha na geração";
        if (/limite|cota|saldo/i.test(error)) engine = "fallback";
      }
    } else if (index >= V6_LIMITS.generatedImages) error = `limite de ${V6_LIMITS.generatedImages} imagens geradas por demo`;
    else if (images.note) error = `sem gerador de imagem (${images.note})`;
    out.push({ id: image.id, path: `assets/${image.id}.svg`, data: fallbackArtwork(image, brief.direction.palette, request.business.name), source: "fallback", alt: image.alt, error: error ? `${error}; composição SVG usada no lugar` : undefined });
  }
  return out;
}

async function audit(final: ReturnType<typeof postprocessSite>, brief: SiteBrief, assetFiles: string[], assets: { path: string; data: Buffer }[], history: { headline: string; texts: string[] }[], workspace: string, progress: V6Progress) {
  progress.phase("Etapa 6: verificando código, links, contraste e originalidade");
  const fixed = staticQa(final, brief, assetFiles, history);
  const dir = path.join(workspace, `qa-${Date.now()}`);
  await mkdir(path.join(dir, "assets"), { recursive: true });
  await writeFile(path.join(dir, "index.html"), final.html);
  await writeFile(path.join(dir, "styles.css"), final.css);
  if (final.js) await writeFile(path.join(dir, "script.js"), final.js);
  for (const asset of assets) await writeFile(path.join(dir, ...asset.path.split("/")), asset.data);
  progress.phase("Etapa 6: testando em navegador real (1440, 1024, 768 e 390 px)");
  const browser = await browserQa(dir);
  return {
    critical: fixed.critical,
    fixable: [...new Set([...fixed.fixable, ...browser.fixable])],
    warnings: [...new Set([...fixed.warnings, ...browser.warnings])],
    browser: browser.executed,
    browserNote: browser.executed ? null : `Auditoria visual não executada: ${browser.reason}`,
    shots: browser.shots,
  };
}
