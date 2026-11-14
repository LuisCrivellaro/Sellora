import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { ClaudeWriter } from "../claude-server";
import { loadV6Guide, v6SystemPrompt, visualReviewPrompt } from "./prompts";
import { siteBriefSchema } from "./schema";
import { briefForReview, reviewImages, reviewProblems, reviewSummary, visualReviewSchema, weightedScore } from "./visual-review";

/**
 * Avaliação visual real (consome cota da conta Claude das demos): o Claude Code recebe as capturas de uma demo V6 já
 * gravada, com as mesmas flags da produção. Rode com SELLORA_LIVE_VISUAL=<pasta do site>, a pasta que contém meta/.
 */
const site = process.env.SELLORA_LIVE_VISUAL;
it.skipIf(!site)("avalia capturas reais de uma demo gravada pelo Claude Code com imagens", async () => {
  const meta = path.join(site!, "meta");
  const shots = Object.fromEntries(await Promise.all((await readdir(meta)).filter((name) => name.endsWith(".png")).map(async (name) => [name, await readFile(path.join(meta, name))] as const)));
  const brief = siteBriefSchema.parse(JSON.parse(await readFile(path.join(meta, "brief.json"), "utf8")));
  const business = JSON.parse(await readFile(path.join(meta, "site.json"), "utf8"));
  const images = await reviewImages(shots);
  expect(images.length).toBeGreaterThanOrEqual(2);
  const workspace = path.join(process.cwd(), "test-results", "visual-live");
  await mkdir(workspace, { recursive: true });
  const guide = await loadV6Guide();
  const writer = await ClaudeWriter.forDemos(workspace, v6SystemPrompt(guide));
  const started = Date.now();
  const review = await writer.structuredWithImages(visualReviewPrompt({ name: business.businessName, city: business.city, uf: business.uf, segment: "servicos" }, briefForReview(brief), guide, images.map((image) => image.label), 0), images, visualReviewSchema, "medium");
  const result = { seconds: Math.round((Date.now() - started) / 1000), estimatedUsd: writer.estimatedUsd, images: images.map((image) => image.label), score: weightedScore(review), invalid: reviewProblems(review), ...reviewSummary(review), preserve: review.preserve };
  await writeFile(path.join(workspace, "ultima-avaliacao.json"), JSON.stringify(result, null, 2), "utf8");
  expect(result.invalid).toEqual([]);
  expect(result.score).toBeGreaterThanOrEqual(0);
}, 400_000);
