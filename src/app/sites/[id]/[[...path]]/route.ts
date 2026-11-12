import { readSiteFile, safeSitePath } from "@/lib/demos/v6/store";
import { siteHeaders } from "@/lib/demos/v6/serve";

export const runtime = "nodejs";

/** Site V6 publicado (público como /demo: só conteúdo comercial validado, sem CRM). */
export async function GET(request: Request, context: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path = [] } = await context.params;
  if (!path.length) return Response.redirect(new URL(`/sites/${encodeURIComponent(id)}/index.html`, request.url), 308);
  const relative = safeSitePath(path.join("/"));
  if (!relative) return new Response("Arquivo não encontrado.", { status: 404 });
  const data = await readSiteFile(id, relative);
  if (!data) return new Response("Arquivo não encontrado.", { status: 404 });
  return new Response(new Uint8Array(data), { headers: siteHeaders(relative.split(".").pop() ?? "", request.headers.get("host")) });
}
