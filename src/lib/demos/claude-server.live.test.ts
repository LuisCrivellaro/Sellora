import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { ClaudeWriter } from "./claude-server";
import { draftIssues } from "./generation-server";
import { draftPrompt, skillInstructions } from "./generation-prompts";

// Chamada real à conta Claude (consome cota do plano). Só roda com SELLORA_LIVE_CLAUDE=1.
it.skipIf(process.env.SELLORA_LIVE_CLAUDE !== "1")("gera direção e textos reais com o prompt completo do gerador", async () => {
  const workspace = path.join(process.cwd(), "test-results", "claude-live");
  await mkdir(workspace, { recursive: true });
  const writer = await ClaudeWriter.create(workspace, await skillInstructions());
  const business = { name: "Padaria Trigo Fino", city: "Campinas", uf: "SP", segment: "restaurantes" as const, category: "Padaria" };
  const started = Date.now();
  const draft = await writer.draft(draftPrompt(business, []));
  await writeFile(path.join(workspace, "ultimo-resultado.json"), JSON.stringify({ seconds: Math.round((Date.now() - started) / 1000), estimatedUsd: writer.estimatedUsd, draft }, null, 2), "utf8");
  expect(draftIssues(draft, { id: crypto.randomUUID(), business, history: [], textProvider: "claude", imageProvider: "gemini", generator: "v5", phone: "" })).toEqual([]);
}, 400_000);
