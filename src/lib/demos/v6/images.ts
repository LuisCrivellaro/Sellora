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
  const colors = [palette.accent, palette.surface, palette.muted, palette.ink];
  const shapes: string[] = [];
  for (let i = 0; i < 7; i += 1) {
    const color = colors[i % colors.length];
    const x = Math.round(random() * width), y = Math.round(random() * height);
    const r = Math.round((0.18 + random() * 0.45) * Math.min(width, height));
    const opacity = (0.12 + random() * 0.38).toFixed(2);
    shapes.push(i % 3 === 0
      ? `<rect x="${x - r}" y="${y - r / 3}" width="${r * 2}" height="${Math.round(r / 1.6)}" rx="${Math.round(r / 10)}" fill="${color}" opacity="${opacity}" transform="rotate(${Math.round(random() * 40 - 20)} ${x} ${y})"/>`
      : `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" opacity="${opacity}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(image.alt)}">
<defs><filter id="blur"><feGaussianBlur stdDeviation="${Math.round(width / 40)}"/></filter></defs>
<rect width="100%" height="100%" fill="${palette.background}"/>
<g filter="url(#blur)">${shapes.join("")}</g>
<rect width="100%" height="100%" fill="${palette.ink}" opacity="0.04"/>
</svg>\n`;
  return Buffer.from(svg, "utf8");
}

const escapeXml = (value: string) => value.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
