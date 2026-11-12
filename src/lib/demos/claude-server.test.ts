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
