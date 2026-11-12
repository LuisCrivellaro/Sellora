import { readFile } from "node:fs/promises";
import path from "node:path";
import { demoDataRoot } from "@/lib/demos/codex-server";

export const runtime = "nodejs";
// Codex grava PNG; o Gemini pode devolver JPEG. O hash identifica o arquivo nos dois casos.
const formats = [["png", "image/png"], ["jpg", "image/jpeg"]] as const;
export async function GET(_request: Request, context: { params: Promise<{ hash: string }> }) {
  const { hash } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(hash)) return new Response(null, { status: 404 });
  for (const [extension, type] of formats) {
    try {
      const bytes = await readFile(path.join(demoDataRoot(), "media", `${hash}.${extension}`));
      return new Response(bytes, { headers: { "Content-Type": type, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
    } catch { /* try next format */ }
  }
  return new Response(null, { status: 404 });
}
