import { expect, it } from "vitest";
import { claudeDraftArgs, claudeStatusFromAuth, parseClaudeDraft } from "./claude-server";
import { generationRequestSchema } from "./generation-server";

it("cria com Sonnet 5.5 em esforço alto, ajusta em esforço médio e roda sem ferramentas", () => {
  const create = claudeDraftArgs("system.md", "high");
  const adjust = claudeDraftArgs("system.md", "medium");
  expect(create[create.indexOf("--model") + 1]).toBe("claude-sonnet-5-5");
  expect(create[create.indexOf("--effort") + 1]).toBe("high");
  expect(adjust[adjust.indexOf("--effort") + 1]).toBe("medium");
  expect(create[create.indexOf("--tools") + 1]).toBe("");
  expect(create).toEqual(expect.arrayContaining(["--safe-mode", "--strict-mcp-config", "--no-session-persistence"]));
});

it("o gerador usa o Claude quando o pedido não escolhe provedor", () => {
  const parsed = generationRequestSchema.parse({ id: crypto.randomUUID(), business: { name: "Padaria Teste", city: "Campinas", uf: "SP", segment: "restaurantes" }, history: [] });
  expect(parsed.textProvider).toBe("claude");
  expect(parsed.imageProvider).toBe("codex");
});
import { generatedFixture } from "./generation-fixtures";

const draft = { ...Object.fromEntries(Object.entries(generatedFixture).filter(([key]) => !["id", "image"].includes(key))), imagePrompt: "Composição conceitual com luz lateral e enquadramento inédito.", imageAlt: generatedFixture.image.alt, message: "Um estudo visual para abrir uma conversa sobre o negócio." };

it("aceita só login de conta Claude e nunca repassa e-mail ou organização", () => {
  const ok = claudeStatusFromAuth(JSON.stringify({ loggedIn: true, authMethod: "claude.ai", email: "pessoa@exemplo.com", orgName: "Org" }));
  expect(ok.available).toBe(true);
  expect(JSON.stringify(ok)).not.toContain("exemplo.com");
  expect(claudeStatusFromAuth(JSON.stringify({ loggedIn: false })).available).toBe(false);
  expect(claudeStatusFromAuth(JSON.stringify({ loggedIn: true, authMethod: "api_key" })).available).toBe(false);
  expect(claudeStatusFromAuth("não é json").available).toBe(false);
});

it("lê a saída estruturada do Claude Code e valida com o schema da demo", () => {
  const parsed = parseClaudeDraft(JSON.stringify({ type: "result", subtype: "success", is_error: false, structured_output: draft, total_cost_usd: 0.05 }));
  expect(parsed.draft.headline).toBe(generatedFixture.headline);
  expect(parsed.estimatedUsd).toBe(0.05);
  expect(parseClaudeDraft(JSON.stringify({ subtype: "success", result: JSON.stringify(draft) })).draft.layout).toBe("offset");
});

it("recusa conteúdo fora do schema e explica limite da conta", () => {
  expect(() => parseClaudeDraft(JSON.stringify({ subtype: "success", structured_output: { ...draft, layout: "outro" } }))).toThrow(/validação/);
  expect(() => parseClaudeDraft(JSON.stringify({ is_error: true, api_error_status: 429, result: "rate limited" }))).toThrow(/limite de uso/);
  expect(() => parseClaudeDraft("{")).toThrow(/não retornou/);
});

it("conta dedicada às demos: pasta própria só no ambiente do processo filho, nunca a conta principal", async () => {
  const { childEnv, demoClaudeProfile } = await import("./claude-server");
  const { homedir } = await import("node:os");
  const path = await import("node:path");
  expect(demoClaudeProfile({})).toEqual({ kind: "default" });
  const dir = path.join(homedir(), "AppData", "Roaming", "sellora", "claude-demos");
  const profile = demoClaudeProfile({ SELLORA_DEMO_CLAUDE_CONFIG_DIR: dir });
  expect(profile).toEqual({ kind: "dedicated", dir: path.resolve(dir) });
  for (const bad of ["relativa/pasta", path.join(homedir(), ".claude"), homedir()]) expect(demoClaudeProfile({ SELLORA_DEMO_CLAUDE_CONFIG_DIR: bad }).error).toBeTruthy();
  const before = { ...process.env };
  process.env.ANTHROPIC_API_KEY = "nao-usar";
  try {
    const env = childEnv(profile);
    expect(env.CLAUDE_CONFIG_DIR).toBe(path.resolve(dir));
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.SELLORA_DEMO_CLAUDE_CONFIG_DIR).toBeUndefined();
    expect(process.env.CLAUDE_CONFIG_DIR).toBe(before.CLAUDE_CONFIG_DIR); // o processo do app não muda
    expect(() => childEnv({ kind: "dedicated", error: "pasta inválida" })).toThrow("pasta inválida");
  } finally { if (before.ANTHROPIC_API_KEY === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = before.ANTHROPIC_API_KEY; }
});

it("status da conta dedicada: desconectada mostra o procedimento de login e nunca fica disponível", () => {
  const profile = { kind: "dedicated" as const, dir: String.raw`C:\Users\x\AppData\Roaming\sellora\claude-demos` };
  const off = claudeStatusFromAuth(JSON.stringify({ loggedIn: false, authMethod: "none" }), profile, "claude.exe");
  expect(off).toMatchObject({ available: false, profile: "dedicated" });
  expect(off.message).toContain("não usa a conta principal");
  expect(off.setup).toContain(`$env:CLAUDE_CONFIG_DIR="${profile.dir}"`);
  expect(off.setup).toContain("auth login --claudeai");
  const on = claudeStatusFromAuth(JSON.stringify({ loggedIn: true, authMethod: "claude.ai", email: "secundaria@exemplo.com" }), profile);
  expect(on).toMatchObject({ available: true, profile: "dedicated" });
  expect(JSON.stringify(on)).not.toContain("exemplo.com");
  expect(claudeStatusFromAuth(JSON.stringify({ loggedIn: true, authMethod: "console" }), profile).available).toBe(false);
  expect(claudeStatusFromAuth(JSON.stringify({ loggedIn: true, authMethod: "claude.ai" })).message).toContain("perfil padrão");
});
