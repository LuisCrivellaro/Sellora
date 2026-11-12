import { sha256 } from "./store";
import type { SiteBrief } from "./schema";

export type ImageEngine = "codex" | "gemini" | "fallback";
export interface SiteAsset { id: string; path: string; data: Buffer; source: ImageEngine; alt: string; error?: string }

const ratio = (aspect: string) => { const [w, h] = aspect.split(":").map(Number); return w / h; };

/**
 * Otimiza para web com sharp (WebP, lado maior até 2000 px no hero e 1600 nas demais).
 * Sem sharp disponível, mantém o PNG original: o site continua correto, só mais pesado.
 */
export async function optimizeForWeb(buffer: Buffer, hero: boolean): Promise<{ data: Buffer; extension: "webp" | "png" }> {
  try {
    const { default: sharp } = await import("sharp");
    const size = hero ? 2000 : 1600;
    const data = await sharp(buffer).rotate().resize({ width: size, height: size, fit: "inside", withoutEnlargement: true }).webp({ quality: 80, effort: 4 }).toBuffer();
    return { data, extension: "webp" };
  } catch {
    return { data: buffer, extension: "png" };
  }
}

/** Composição SVG gratuita com a paleta do briefing: entra quando nenhum gerador de imagem está disponível. */
export function fallbackArtwork(image: SiteBrief["images"][number], palette: SiteBrief["direction"]["palette"], seedText: string): Buffer {
  const width = 1600;
  const height = Math.round(width / ratio(image.aspect));
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
