import { requireAccess } from "@/lib/prospecting/access";
import { readSiteMeta } from "@/lib/demos/v6/store";

export const runtime = "nodejs";

/** Captura real feita na auditoria do navegador (1440 px), usada como miniatura na fila. Não faz parte do site exportado. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAccess(request);
  if (access instanceof Response) return access;
  const { id } = await context.params;
  const shot = await readSiteMeta(id, "shot-1440.png");
  if (!shot) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(shot), { headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
