import { readFile } from "node:fs/promises";
import path from "node:path";
import { expect, it } from "vitest";
import { CLAUDE_INTEGRATION_NOTE, GENERATOR_BASE_INSTRUCTIONS, claudeSystemPrompt, skillInstructions } from "./generation-prompts";

it("o Claude recebe o mesmo texto-base, a skill completa e as notas do gerador que o Codex recebe", async () => {
  const instructions = await skillInstructions();
  const system = claudeSystemPrompt(instructions);
  const root = path.join(process.cwd(), ".agents", "skills", "unique-site-designer");
  for (const file of ["SKILL.md", "references/validacao.md", "references/fluxo-sellora.md"]) {
    expect(system).toContain(await readFile(path.join(root, file), "utf8"));
  }
  expect(system.startsWith(GENERATOR_BASE_INSTRUCTIONS)).toBe(true);
  expect(system).toContain("Aplicação no gerador integrado");
  expect(system).toContain(CLAUDE_INTEGRATION_NOTE);
  expect(system.endsWith(instructions)).toBe(true);
});
