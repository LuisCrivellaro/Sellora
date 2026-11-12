import { requireAccess, json } from "@/lib/prospecting/access";
import { readSiteFile, readSiteManifest, readSiteMeta } from "@/lib/demos/v6/store";

export const runtime = "nodejs";

/** Código-fonte do site V6 para o visualizador interno: exatamente os arquivos servidos em /sites/<id>/. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAccess(request);
  if (access instanceof Response) return access;
  const { id } = await context.params;
  const manifest = await readSiteManifest(id);
  if (!manifest) return json({ error: "Código desta demo não encontrado neste computador." }, 404);
  const files = await Promise.all(manifest.map(async (file) => {
    const textual = /\.(html|css|js|svg)$/.test(file.path);
    const data = textual ? await readSiteFile(id, file.path) : null;
    return { ...file, kind: textual ? "text" : "binary", content: data?.toString("utf8") ?? null };
  }));
  const qa = await readSiteMeta(id, "qa.json");
  return json({ id, files, qa: qa ? JSON.parse(qa.toString("utf8")) : null });
}
