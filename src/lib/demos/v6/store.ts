import { createHash } from "node:crypto";
import { access, cp, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { demoDataRoot } from "../codex-server";
import { siteFileSchema, type SiteFile } from "./schema";

/**
 * Sites V6 ficam em <dados>/sites/<id>/files (o que é servido e exportado) e <id>/meta (briefing, QA, capturas).
 * Um id nunca é regravado: nova geração = novo id. Assim uma demo aprovada não muda por geração posterior.
 */
const siteId = z.uuid();
export const sitesRoot = () => path.join(demoDataRoot(), "sites");
const siteDir = (id: string) => path.join(sitesRoot(), siteId.parse(id));

export const TEXT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8", css: "text/css; charset=utf-8", js: "text/javascript; charset=utf-8", svg: "image/svg+xml",
};
export const CONTENT_TYPES: Record<string, string> = { ...TEXT_TYPES, png: "image/png", jpg: "image/jpeg", webp: "image/webp" };

export function safeSitePath(relative: string): string | null {
  return siteFileSchema.shape.path.safeParse(relative).success ? relative : null;
}

export const sha256 = (data: Buffer | string) => createHash("sha256").update(data).digest("hex");

/** Grava todos os arquivos numa pasta temporária e só então a torna visível: não existe site pela metade. */
export async function writeSite(id: string, files: Map<string, Buffer>, meta: Record<string, Buffer | string>): Promise<SiteFile[]> {
  const final = siteDir(id);
  if (await access(final).then(() => true, () => false)) throw new Error("Este site já existe e não pode ser regravado.");
  const staging = `${final}.tmp-${process.pid}`;
  await rm(staging, { recursive: true, force: true });
  const manifest: SiteFile[] = [];
  for (const [relative, data] of [...files.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (!safeSitePath(relative)) throw new Error(`Caminho de arquivo não permitido: ${relative}`);
    const target = path.join(staging, "files", ...relative.split("/"));
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, data);
    manifest.push({ path: relative, size: data.length, sha256: sha256(data) });
  }
  await mkdir(path.join(staging, "meta"), { recursive: true });
  for (const [name, data] of Object.entries(meta)) {
    if (!/^[a-z0-9-]+\.(json|png)$/.test(name)) throw new Error("Metadado inválido.");
    await writeFile(path.join(staging, "meta", name), data);
  }
  await writeFile(path.join(staging, "meta", "manifest.json"), JSON.stringify({ id, files: manifest }, null, 2));
  await publishDirectory(staging, final);
  return manifest;
}

/**
 * No Windows, renomear uma pasta recém-gravada pode falhar com EPERM/EBUSY enquanto o antivírus ou o indexador
 * leem os arquivos. Tenta de novo com espera crescente; se ainda falhar, copia e remove a pasta temporária.
 */
async function publishDirectory(staging: string, final: string) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try { await rename(staging, final); return; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES") throw error;
      await new Promise((resolve) => setTimeout(resolve, 60 * (attempt + 1)));
    }
  }
  await cp(staging, final, { recursive: true, errorOnExist: true, force: false });
  await rm(staging, { recursive: true, force: true }).catch(() => {});
}

export async function readSiteManifest(id: string): Promise<SiteFile[] | null> {
  if (!siteId.safeParse(id).success) return null;
  try {
    const parsed = z.object({ files: z.array(siteFileSchema) }).parse(JSON.parse(await readFile(path.join(siteDir(id), "meta", "manifest.json"), "utf8")));
    return parsed.files;
  } catch { return null; }
}

/** Lê um arquivo publicado do site, conferindo que ele consta do manifesto e que o conteúdo não mudou. */
export async function readSiteFile(id: string, relative: string): Promise<Buffer | null> {
  const manifest = await readSiteManifest(id);
  const entry = manifest?.find((file) => file.path === relative);
  if (!entry) return null;
  try {
    const data = await readFile(path.join(siteDir(id), "files", ...relative.split("/")));
    return sha256(data) === entry.sha256 ? data : null;
  } catch { return null; }
}

export async function readSiteMeta(id: string, name: string): Promise<Buffer | null> {
  if (!siteId.safeParse(id).success || !/^[a-z0-9-]+\.(json|png)$/.test(name)) return null;
  try { return await readFile(path.join(siteDir(id), "meta", name)); } catch { return null; }
}
