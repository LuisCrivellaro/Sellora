import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

/** Servidor de geração no fluxo V6, com o pipeline simulado (nenhuma chamada a Claude ou Codex). */
const scope = vi.hoisted(() => ({ id: "" }));
const v6 = vi.hoisted(() => ({ generateV6: vi.fn() }));
vi.mock("./codex-server", () => ({ demoDataRoot: () => `${process.cwd()}/test-results/generator-v6-server/${scope.id}`, LocalCodex: { connect: vi.fn() } }));
vi.mock("./claude-server", () => ({ ClaudeWriter: { create: vi.fn() } }));
vi.mock("./v6/generator", async (original) => ({ ...(await original<typeof import("./v6/generator")>()), generateV6: v6.generateV6 }));

import { V6GenerationError } from "./v6/generator";
import { getDemoGenerationJob, startDemoGeneration } from "./generation-server";

const site = {
  id: randomUUID(), generator: "v6", title: "Cantina", createdAt: new Date().toISOString(),
  files: [{ path: "index.html", size: 1, sha256: "a".repeat(64) }, { path: "styles.css", size: 1, sha256: "b".repeat(64) }], images: [], preview: false,
  summary: { headline: "Cantina", texts: [], fonts: ["Fraunces", "Work Sans"], palette: ["#ffffff"], sections: ["inicio"], hero: "[colunas] x", signature: "s" },
  qa: { status: "needs_review", browser: "executed", rounds: 2, issues: ["x"], fixable: ["x"] },
};
const request = (textProvider: "codex" | "claude" = "codex") => ({ id: randomUUID(), business: { name: "Cantina Teste", city: "Campinas", uf: "SP", segment: "restaurantes" as const }, history: [], textProvider, imageProvider: "codex" as const, generator: "v6" as const, phone: "" });
const settle = async (id: string) => { for (let i = 0; i < 100; i += 1) { const job = await getDemoGenerationJob(id); if (job && job.status !== "running") return job; await new Promise((r) => setTimeout(r, 10)); } throw new Error("job não terminou"); };

beforeEach(() => { scope.id = randomUUID(); vi.clearAllMocks(); });

it("V6 usa sempre o Claude para texto e código, mesmo quando o pedido antigo diz Codex", async () => {
  v6.generateV6.mockResolvedValue({ site, message: "Olá! Demonstração não oficial.", estimatedUsd: 0.2, imageEngine: "codex" });
  const req = request("codex");
  const job = await startDemoGeneration(req);
  expect(job.textProvider).toBe("claude");
  const done = await settle(req.id);
  expect(v6.generateV6.mock.calls[0][1].textProvider).toBe("claude");
  expect(done).toMatchObject({ status: "completed", phase: "Demo pronta, com pendências para revisão", result: { textProvider: "claude" } });
});

it("falha recuperável fica marcada e o mesmo id retoma do checkpoint; falha definitiva não retoma", async () => {
  v6.generateV6.mockRejectedValueOnce(new V6GenerationError("O limite de uso da conta Claude foi atingido.", true));
  const req = request("claude");
  await startDemoGeneration(req);
  const failed = await settle(req.id);
  expect(failed).toMatchObject({ status: "failed", recoverable: true, phase: "Geração interrompida (etapas salvas para retomar)" });

  v6.generateV6.mockResolvedValueOnce({ site, message: "Olá! Demonstração não oficial.", estimatedUsd: 0.1, imageEngine: "codex" });
  const retry = await startDemoGeneration(req);
  expect(retry.status).toBe("running");
  expect(await settle(req.id)).toMatchObject({ status: "completed" });
  expect(v6.generateV6).toHaveBeenCalledTimes(2);
  expect(v6.generateV6.mock.calls[1][0]).toBe(req.id); // mesmo workspace/checkpoint

  v6.generateV6.mockRejectedValueOnce(new V6GenerationError("Cadastro sem nome.", false));
  const other = request();
  await startDemoGeneration(other);
  expect(await settle(other.id)).toMatchObject({ status: "failed", recoverable: false });
  const again = await startDemoGeneration(other);
  expect(again.status).toBe("failed");
  expect(v6.generateV6).toHaveBeenCalledTimes(3);
});
