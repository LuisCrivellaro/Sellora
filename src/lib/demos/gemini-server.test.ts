import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GEMINI_IMAGE_MODEL, generateGeminiImage, geminiImageFromResponse, geminiImageInput, geminiImageStatus, imageDimensions, LAYOUT_ASPECT } from "./gemini-server";
import { creationDraftSchema } from "./creation";
import { generatedFixture } from "./generation-fixtures";
import { IMAGE_CONTENT_RULES } from "./generation-prompts";

const png = (width: number, height: number) => {
  const buffer = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(buffer);
  buffer.write("IHDR", 12, "ascii");
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
};
const jpeg = (width: number, height: number) => Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, height >> 8, height & 255, width >> 8, width & 255, 0x03, 0, 0, 0, 0]);
const draft = creationDraftSchema.parse({ ...Object.fromEntries(Object.entries(generatedFixture).filter(([key]) => !["id", "image"].includes(key))), layout: "panorama", imagePrompt: "Fotografia de pão rústico sobre bancada de madeira com luz lateral.", imageAlt: generatedFixture.image.alt, message: "Mensagem de teste para a padaria." });

beforeEach(() => {
  process.env.SELLORA_DATA_DIR = path.join(process.cwd(), "test-results", "gemini-unit", randomUUID());
  process.env.GEMINI_API_KEY = "chave-de-teste";
});
afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY; delete process.env.SELLORA_DATA_DIR; });

it("lê dimensões de PNG e JPEG", () => {
  expect(imageDimensions(png(2048, 1152))).toEqual({ format: "png", width: 2048, height: 1152 });
  expect(imageDimensions(jpeg(1600, 900))).toEqual({ format: "jpg", width: 1600, height: 900 });
  expect(imageDimensions(Buffer.from("não é imagem"))).toBeNull();
});

it("usa só a imagem final, ignora rascunhos do raciocínio", () => {
  const final = png(1024, 1024).toString("base64");
  const response = { status: "completed", steps: [
    { type: "thought", content: [{ type: "image", data: png(300, 300).toString("base64"), mime_type: "image/png" }] },
    { type: "model_output", content: [{ type: "text", text: "pronto" }, { type: "image", data: final, mime_type: "image/png" }] },
  ] };
  expect(geminiImageFromResponse(response).toString("base64")).toBe(final);
  expect(() => geminiImageFromResponse({ status: "failed", steps: [] })).toThrow(/não concluiu/);
});

it("o pedido leva as mesmas regras de conteúdo do Codex", () => {
  const input = geminiImageInput(draft);
  expect(input).toContain(draft.imagePrompt);
  expect(input).toContain(IMAGE_CONTENT_RULES);
});

it("sem chave, fica indisponível com instrução de configuração e sem chamar a rede", async () => {
  delete process.env.GEMINI_API_KEY;
  const fetch = vi.fn();
  vi.stubGlobal("fetch", fetch);
  expect((await geminiImageStatus()).message).toContain("GEMINI_API_KEY");
  expect(fetch).not.toHaveBeenCalled();
});

it("gera a imagem com proporção do layout, sem guardar o pedido no Google, e salva pelo hash", async () => {
  const image = png(2752, 1536);
  const fetch = vi.fn(async () => Response.json({ status: "completed", steps: [{ type: "model_output", content: [{ type: "image", data: image.toString("base64"), mime_type: "image/png" }] }] }));
  vi.stubGlobal("fetch", fetch);
  const result = await generateGeminiImage(draft);
  const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
  const body = JSON.parse(init.body as string);
  expect(url).toMatch(/\/v1beta\/interactions$/);
  expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("chave-de-teste");
  expect(body).toMatchObject({ model: GEMINI_IMAGE_MODEL, store: false, response_format: { type: "image", aspect_ratio: LAYOUT_ASPECT.panorama, image_size: "2K" } });
  expect(result).toMatchObject({ width: 2752, height: 1536, alt: draft.imageAlt });
  expect(result.src).toBe(`/api/demos/media/${result.sourceHash}`);
  expect(await readFile(path.join(process.env.SELLORA_DATA_DIR!, "media", `${result.sourceHash}.png`))).toEqual(image);
});

it("explica saldo ou limite atingido no Gemini", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 429 })));
  await expect(generateGeminiImage(draft)).rejects.toThrow(/saldo/);
});
