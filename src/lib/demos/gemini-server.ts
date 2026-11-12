import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { demoDataRoot } from "./codex-server";
import type { CreationDraft, DemoTextProviderStatus, GeneratedCreation } from "./creation";
import { IMAGE_CONTENT_RULES } from "./generation-prompts";

/**
 * Imagens das demos com a API do Google Gemini (família Nano Banana, a mesma da skill `imagen`).
 * Implementação própria em Node: a skill de terceiros não tem licença e exigiria Python no computador do app.
 * A chave vem só de GEMINI_API_KEY no ambiente do servidor e nunca é enviada ao navegador.
 */
const API = "https://generativelanguage.googleapis.com/v1beta";
export const GEMINI_IMAGE_MODEL = "gemini-nano-banana-2.1";
const imageModel = () => process.env.SELLORA_GEMINI_IMAGE_MODEL || GEMINI_IMAGE_MODEL;
const apiKey = () => process.env.GEMINI_API_KEY?.trim() || "";

/** Proporção pela composição da primeira dobra (ver generated-demo-site.module.css). */
export const LAYOUT_ASPECT: Record<CreationDraft["layout"], string> = {
  split: "1:1", masthead: "16:9", panorama: "16:9", poster: "16:9", portrait: "2:3", offset: "5:4",
};

export async function geminiImageStatus(): Promise<DemoTextProviderStatus> {
  const key = apiKey();
  if (!key) return { available: false, message: "Configure a variável GEMINI_API_KEY neste computador e reabra o Sellora para gerar imagens com o Gemini." };
  try {
    const response = await fetch(`${API}/models/${encodeURIComponent(imageModel())}`, { headers: { "x-goog-api-key": key }, signal: AbortSignal.timeout(15_000) });
    if (response.status === 400 || response.status === 401 || response.status === 403) return { available: false, message: "A chave do Gemini foi recusada. Confira a GEMINI_API_KEY e o faturamento no Google AI Studio." };
    if (response.status === 404) return { available: false, message: `O modelo de imagem ${imageModel()} não está disponível para esta chave.` };
    if (!response.ok) return { available: false, message: "O Gemini não respondeu agora. Tente verificar a conexão novamente." };
    return { available: true, message: "Gemini conectado para as imagens. Cada imagem é cobrada na conta Google AI Studio (sem plano gratuito para imagens)." };
  } catch {
    return { available: false, message: "Não foi possível conectar ao Gemini. Confira a internet e tente novamente." };
  }
}

export function geminiImageInput(draft: Pick<CreationDraft, "imagePrompt">): string {
  return `Gere uma única imagem fotográfica ou ilustrativa para a primeira dobra de um site.\n\n${draft.imagePrompt}\n\nRestrição importante: ${IMAGE_CONTENT_RULES}`;
}

const responseSchema = z.object({
  status: z.string().optional(),
  steps: z.array(z.object({ type: z.string(), content: z.array(z.object({ type: z.string(), data: z.string().optional(), mime_type: z.string().optional() }).loose()).optional() }).loose()).optional(),
}).loose();

/** Lê largura e altura de PNG (IHDR) ou JPEG (marcador SOF). */
export function imageDimensions(buffer: Buffer): { format: "png" | "jpg"; width: number; height: number } | null {
  if (buffer.length > 24 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue; }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { format: "jpg", height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }
  return null;
}

/** Extrai a última imagem final (passos model_output; imagens intermediárias de raciocínio são ignoradas). */
export function geminiImageFromResponse(json: unknown): Buffer {
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) throw new Error("O Gemini não retornou a imagem da demo.");
  const blocks = (parsed.data.steps ?? []).filter((step) => step.type === "model_output").flatMap((step) => step.content ?? []);
  const image = blocks.filter((block) => block.type === "image" && block.data).at(-1);
  if (!image?.data) throw new Error(parsed.data.status && parsed.data.status !== "completed" ? "O Gemini não concluiu a imagem (filtro de segurança ou falha). Gere novamente." : "O Gemini não retornou a imagem da demo.");
  return Buffer.from(image.data, "base64");
}

export async function generateGeminiImage(draft: CreationDraft, timeoutMs = 4 * 60_000): Promise<GeneratedCreation["image"]> {
  const key = apiKey();
  if (!key) throw new Error("Configure a variável GEMINI_API_KEY para gerar imagens com o Gemini.");
  let response: Response;
  try {
    response = await fetch(`${API}/interactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        model: imageModel(), input: geminiImageInput(draft), store: false,
        response_format: { type: "image", mime_type: "image/png", aspect_ratio: LAYOUT_ASPECT[draft.layout], image_size: "2K" },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch { throw new Error("Não foi possível conectar ao Gemini para gerar a imagem. A demo anterior continua disponível."); }
  if (response.status === 429) throw new Error("O limite ou o saldo da conta Gemini foi atingido. Confira o faturamento no Google AI Studio.");
  if (response.status === 400 || response.status === 401 || response.status === 403) throw new Error("O Gemini recusou o pedido de imagem. Confira a chave, o faturamento e tente gerar novamente.");
  if (!response.ok) throw new Error("O Gemini não gerou a imagem agora. A demo anterior continua disponível para revisão.");
  const buffer = geminiImageFromResponse(await response.json().catch(() => null));
  const info = imageDimensions(buffer);
  if (!info || buffer.length > 20_000_000) throw new Error("A imagem retornada pelo Gemini não é um PNG ou JPEG válido.");
  if (info.width < 256 || info.height < 256 || info.width > 4096 || info.height > 4096) throw new Error("A imagem tem dimensões incompatíveis com a demo.");
  const sourceHash = createHash("sha256").update(buffer).digest("hex");
  const destination = path.join(demoDataRoot(), "media");
  await mkdir(destination, { recursive: true });
  await writeFile(path.join(destination, `${sourceHash}.${info.format}`), buffer);
  return { src: `/api/demos/media/${sourceHash}`, sourceHash, width: info.width, height: info.height, alt: draft.imageAlt };
}
