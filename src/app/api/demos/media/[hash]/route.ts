import { readFile } from "node:fs/promises";
import path from "node:path";
import { demoDataRoot } from "@/lib/demos/codex-server";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ hash: string }> }) {
  const { hash } = await context.params;
  if (!/^[a-f0-9]{64}$/.test(hash)) return new Response(null, { status: 404 });
  try {
    const bytes = await readFile(path.join(demoDataRoot(), "media", `${hash}.png`));
    return new Response(bytes, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response(null, { status: 404 }); }
}
