import { sha256 } from "./store";
import type { ImageSpec, SiteBrief } from "./schema";

export type ImageEngine = "codex" | "fallback";
export interface SiteAsset { id: string; path: string; data: Buffer; source: ImageEngine; alt: string; width: number; height: number; error?: string }

export const aspectRatio = (aspect: string) => { const [w, h] = aspect.split(":").map(Number); return w / h; };

/** Dimensões nominais da proporção planejada (lado maior 2000 px no hero, 1600 nas demais). Vão para o prompt do código. */
export function nominalSize(aspect: string, hero: boolean): { width: number; height: number } {
  const long = hero ? 2000 : 1600;
  const ratio = aspectRatio(aspect);
  return ratio >= 1 ? { width: long, height: Math.round(long / ratio) } : { width: Math.round(long * ratio), height: long };
}

function pngSize(buffer: Buffer): { width: number; height: number } | null {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

/**
 * Otimiza para web com sharp: recorta para a proporção planejada (estratégia "attention", que preserva o assunto),
 * limita o lado maior (2000 px no hero, 1600 nas demais, sem ampliar) e converte para WebP.
 * Sem sharp disponível, mantém o PNG original: o site continua correto (object-fit: cover), só mais pesado.
 */
export async function optimizeForWeb(buffer: Buffer, hero: boolean, aspect?: string): Promise<{ data: Buffer; extension: "webp" | "png"; width: number; height: number; cropped: boolean }> {
  try {
    const { default: sharp } = await import("sharp");
    const meta = await sharp(buffer).metadata();
    let pipeline = sharp(buffer).rotate();
    let cropped = false;
    if (aspect && meta.width && meta.height) {
      const target = aspectRatio(aspect);
      const current = meta.width / meta.height;
      if (Math.abs(current - target) / target > 0.02) {
        const width = current > target ? Math.round(meta.height * target) : meta.width;
        const height = current > target ? meta.height : Math.round(meta.width / target);
        pipeline = pipeline.resize({ width, height, fit: "cover", position: sharp.strategy.attention });
        cropped = true;
      }
    }
    const size = hero ? 2000 : 1600;
    const { data, info } = await sharp(await pipeline.toBuffer()).resize({ width: size, height: size, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer({ resolveWithObject: true });
    return { data, extension: "webp", width: info.width, height: info.height, cropped };
  } catch {
    const size = pngSize(buffer) ?? { width: 1024, height: 1024 };
    return { data: buffer, extension: "png", ...size, cropped: false };
  }
}

/** Composição SVG gratuita com a paleta do briefing: entra quando nenhum gerador de imagem está disponível. */
export function fallbackArtwork(image: Pick<ImageSpec, "id" | "aspect" | "alt">, palette: SiteBrief["direction"]["palette"], seedText: string): Buffer {
  const width = 1600;
  const height = Math.round(width / aspectRatio(image.aspect));
  let seed = parseInt(sha256(seedText + image.id).slice(0, 8), 16);
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  // Composição nítida em faixas e arcos (estilo cartaz), sem desfoque: lê como peça gráfica, não como foto que falhou.
  const columns = 5 + Math.floor(random() * 3);
  const step = width / columns;
  const shapes: string[] = [`<rect width="100%" height="100%" fill="${palette.surface}"/>`];
  for (let i = 0; i < columns; i += 1) {
    const x = Math.round(i * step);
    const kind = Math.floor(random() * 3);
    const fill = [palette.accent, palette.ink, palette.background, palette.muted][Math.floor(random() * 4)];
    if (kind === 0) shapes.push(`<rect x="${x}" y="${Math.round(height * (0.25 + random() * 0.5))}" width="${Math.ceil(step)}" height="${height}" fill="${fill}"/>`);
    else if (kind === 1) shapes.push(`<path d="M${x} ${height} V${Math.round(height * (0.35 + random() * 0.3))} a${step / 2} ${step / 2} 0 0 1 ${step} 0 V${height} Z" fill="${fill}"/>`);
    else shapes.push(`<circle cx="${Math.round(x + step / 2)}" cy="${Math.round(height * (0.2 + random() * 0.6))}" r="${Math.round(step * 0.38)}" fill="${fill}"/>`);
  }
  shapes.push(`<rect x="0" y="${Math.round(height * 0.86)}" width="${width}" height="${Math.ceil(height * 0.14)}" fill="${palette.ink}"/>`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(image.alt)}">
${shapes.join("\n")}
</svg>\n`;
  return Buffer.from(svg, "utf8");
}

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
