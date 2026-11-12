import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { generatedFixture } from "./generation-fixtures";
import { creationDraftSchema, creationSignature } from "./creation";
import { draftIssues, getDemoGenerationJob, startDemoGeneration } from "./generation-server";

const client = vi.hoisted(() => ({
  status: vi.fn(), startThread: vi.fn(), draft: vi.fn(), image: vi.fn(), close: vi.fn(),
}));
const testScope = vi.hoisted(() => ({ id: "" }));
vi.mock("./codex-server", () => ({
  demoDataRoot: () => process.cwd() + "/test-results/generator-unit/" + testScope.id,
  LocalCodex: { connect: vi.fn(async () => client) },
}));
const writer = vi.hoisted(() => ({ draft: vi.fn(), estimatedUsd: 0.0123 }));
vi.mock("./claude-server", () => ({ ClaudeWriter: { create: vi.fn(async () => writer) } }));
const gemini = vi.hoisted(() => ({ status: vi.fn(), image: vi.fn() }));
vi.mock("./gemini-server", () => ({ geminiImageStatus: gemini.status, generateGeminiImage: gemini.image }));
const draft = creationDraftSchema.parse({ ...Object.fromEntries(Object.entries(generatedFixture).filter(([key]) => !["id", "image"].includes(key))), imagePrompt: "Composição conceitual com luz lateral, objetos sem marca e enquadramento inédito.", imageAlt: generatedFixture.image.alt, message: "Um estudo visual concebido a partir de luz e movimento para abrir uma conversa sobre o negócio." });
const request = () => ({ id: randomUUID(), business: { name: "Studio Teste", city: "Campinas", uf: "SP", segment: "beleza" as const }, history: [], textProvider: "codex" as "codex" | "claude", imageProvider: "codex" as "codex" | "gemini" });
beforeEach(() => {
  testScope.id = randomUUID();
  vi.clearAllMocks();
  client.status.mockResolvedValue({ available: true });
  client.startThread.mockResolvedValue("thread");
  client.draft.mockResolvedValue(draft);
  client.image.mockResolvedValue(generatedFixture.image);
  writer.draft.mockResolvedValue(draft);
  gemini.status.mockResolvedValue({ available: true, message: "ok" });
  gemini.image.mockResolvedValue({ ...generatedFixture.image, src: "/api/demos/media/" + "c".repeat(64), sourceHash: "c".repeat(64) });
});

it("Claude nos textos e Gemini na imagem: o Codex nem é aberto", async () => {
  const { LocalCodex } = await import("./codex-server");
  const input = { ...request(), textProvider: "claude" as const, imageProvider: "gemini" as const };
  await startDemoGeneration(input);
  await expect.poll(async () => (await getDemoGenerationJob(input.id))?.status).toBe("completed");
  const job = await getDemoGenerationJob(input.id);
  expect(LocalCodex.connect).not.toHaveBeenCalled();
  expect(gemini.image).toHaveBeenCalledExactlyOnceWith(draft);
  expect(job?.result?.creation.image.sourceHash).toBe("c".repeat(64));
  expect(job?.result?.imageProvider).toBe("gemini");
});

it("sem Gemini configurado, falha antes de gastar a cota do Claude", async () => {
  gemini.status.mockResolvedValue({ available: false, message: "Configure a variável GEMINI_API_KEY neste computador." });
  const input = { ...request(), textProvider: "claude" as const, imageProvider: "gemini" as const };
  await startDemoGeneration(input);
  await expect.poll(async () => (await getDemoGenerationJob(input.id))?.status).toBe("failed");
  expect((await getDemoGenerationJob(input.id))?.error).toContain("GEMINI_API_KEY");
  expect(writer.draft).not.toHaveBeenCalled();
});

it("com Claude escolhido, os textos vêm do Claude e a imagem continua com o Codex", async () => {
  const input = { ...request(), textProvider: "claude" as const };
  await startDemoGeneration(input);
  await expect.poll(async () => (await getDemoGenerationJob(input.id))?.status).toBe("completed");
  const job = await getDemoGenerationJob(input.id);
  expect(writer.draft).toHaveBeenCalledTimes(1);
  expect(client.draft).not.toHaveBeenCalled();
  expect(client.image).toHaveBeenCalledExactlyOnceWith("thread", draft);
  expect(job?.result?.textProvider).toBe("claude");
  expect(job?.textEstimatedUsd).toBe(0.0123);
  // Mesmas instruções da skill que o Codex recebe na thread.
  const { ClaudeWriter } = await import("./claude-server");
  expect(vi.mocked(ClaudeWriter.create).mock.calls[0][1]).toBe(client.startThread.mock.calls[0][1]);
});

it("com Claude, a correção reenvia a proposta anterior antes de gastar uma imagem", async () => {
  const input = { ...request(), textProvider: "claude" as const, history: [{ segment: "beleza", signature: creationSignature(draft), photoOrigin: null, texts: [], message: "" }] };
  const next = { ...draft, layout: "panorama" as const };
  writer.draft.mockResolvedValueOnce(draft).mockResolvedValueOnce(next);
  await startDemoGeneration(input);
  await expect.poll(async () => (await getDemoGenerationJob(input.id))?.status).toBe("completed");
  expect(writer.draft).toHaveBeenCalledTimes(2);
  expect(writer.draft.mock.calls[1][1]).toEqual(draft);
  expect(client.image).toHaveBeenCalledExactlyOnceWith("thread", next);
});

it("não chama o Claude quando o Codex não pode gerar a imagem", async () => {
  client.status.mockResolvedValue({ available: false, message: "Entre no Codex com sua conta ChatGPT neste computador." });
  const input = { ...request(), textProvider: "claude" as const };
  await startDemoGeneration(input);
  await expect.poll(async () => (await getDemoGenerationJob(input.id))?.status).toBe("failed");
  expect(writer.draft).not.toHaveBeenCalled();
});

it("compara também versões anteriores salvas pelo gerador que saíram do snapshot atual", async () => {
  const first = request();
  await startDemoGeneration(first);
  await expect.poll(async () => (await getDemoGenerationJob(first.id))?.status).toBe("completed");
  const next = { ...draft, layout: "panorama" as const, headline: "Outra leitura do seu momento.", intro: "Um texto novo para o segundo conceito visual e seu primeiro contato.", cta: "Explore uma possibilidade diferente", sections: [{ title: "Um olhar que pode mudar", body: "Uma conversa aberta permite conhecer melhor o estabelecimento e o que ele tem para apresentar." }, { title: "Dê contexto à sua referência", body: "Compartilhe sua inspiração e pergunte ao negócio pelas informações que deseja conhecer." }], message: "Posso compartilhar um estudo de site que parte de outra composição para apresentar o negócio?" };
  client.draft.mockResolvedValueOnce(draft).mockResolvedValueOnce(next);
  client.image.mockResolvedValueOnce({ ...generatedFixture.image, src: "/api/demos/media/" + "b".repeat(64), sourceHash: "b".repeat(64) });
  const second = request();
  await startDemoGeneration(second);
  await expect.poll(async () => (await getDemoGenerationJob(second.id))?.status).toBe("completed");
  expect(client.draft.mock.calls.at(-2)?.[1]).toContain("o seu proximo olhar comeca aqui");
  expect(client.draft).toHaveBeenCalledTimes(3);
});

it("reutiliza um trabalho concluído sem gerar outra imagem nem aceitar outro negócio", async () => {
  const input = request();
  await startDemoGeneration(input);
  await expect.poll(async () => (await getDemoGenerationJob(input.id))?.status).toBe("completed");
  const again = await startDemoGeneration(input);
  expect(again.result?.creation.image).toEqual(generatedFixture.image);
  expect(again.result?.creation).not.toHaveProperty("imagePrompt");
  expect(client.image).toHaveBeenCalledTimes(1);
  await expect(startDemoGeneration({ ...input, business: { ...input.business, name: "Outro negócio" } })).rejects.toThrow(/outro cadastro/);
});

it("refaz uma direção repetida antes de consumir uma geração de imagem", async () => {
  const input = { ...request(), history: [{ segment: "beleza", signature: creationSignature(draft), photoOrigin: null, texts: [], message: "" }] };
  const next = { ...draft, layout: "panorama" as const };
  client.draft.mockResolvedValueOnce(draft).mockResolvedValueOnce(next);
  await startDemoGeneration(input);
  await expect.poll(async () => (await getDemoGenerationJob(input.id))?.status).toBe("completed");
  expect(client.draft).toHaveBeenCalledTimes(2);
  expect(client.image).toHaveBeenCalledExactlyOnceWith("thread", next);
  expect(draftIssues(draft, input).join(" ")).toContain("composição");
});

it("mantém falha explícita quando a conta atinge limite, sem produzir uma demo incompleta", async () => {
  client.image.mockRejectedValue(new Error("Limite de imagens atingido."));
  const input = request();
  await startDemoGeneration(input);
  await expect.poll(async () => (await getDemoGenerationJob(input.id))?.status).toBe("failed");
  const job = await getDemoGenerationJob(input.id);
  expect(job?.result).toBeNull();
  expect(job?.error).toContain("Limite");
  expect(client.close).toHaveBeenCalled();
});
