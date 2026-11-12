import { requireAccess, json } from "@/lib/prospecting/access";
import { readSiteFile, readSiteManifest, readSiteMeta } from "@/lib/demos/v6/store";
import { createZip, zipFolderName } from "@/lib/demos/v6/zip";

export const runtime = "nodejs";

/** ZIP portátil: só os arquivos do manifesto (o que a prévia usa), numa pasta com o nome do estabelecimento. */
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireAccess(request);
  if (access instanceof Response) return access;
  const { id } = await context.params;
  const manifest = await readSiteManifest(id);
  if (!manifest) return json({ error: "Código desta demo não encontrado neste computador." }, 404);
  const site = await readSiteMeta(id, "site.json");
  const folder = zipFolderName(site ? String(JSON.parse(site.toString("utf8")).businessName ?? "") : "");
  const entries = [];
  for (const file of manifest) {
    const data = await readSiteFile(id, file.path);
    if (!data) return json({ error: `Arquivo ${file.path} ausente ou alterado. Gere a demo novamente.` }, 409);
    entries.push({ name: `${folder}/${file.path}`, data });
  }
  return new Response(new Uint8Array(createZip(entries)), { headers: {
    "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${folder}.zip"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
  } });
}
