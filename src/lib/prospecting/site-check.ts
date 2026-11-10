import { lookup } from "node:dns/promises";
import net from "node:net";
import { freeHostOf } from "./classify";
import type { SiteCheck } from "./types";

/**
 * Conferência HTTP de um site público (somente servidor).
 * As URLs vêm de fontes abertas, logo são entrada não confiável: só http/https
 * nas portas padrão, DNS resolvido e recusado se apontar para rede interna,
 * redirecionamentos conferidos um a um, tempo e tamanho limitados.
 */

export const USER_AGENT = "Sellora-Prospeccao/0.1 (+https://github.com/LuisCrivellaro/Sellora)";
const TIMEOUT_MS = 8000;
const MAX_BYTES = 600_000;
const MAX_REDIRECTS = 4;

export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && (b === 168 || b === 0)) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || /^fe[89ab]/.test(v) || v.startsWith("ff");
  }
  return true;
}

class UnsafeUrlError extends Error {}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("endereço inválido");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UnsafeUrlError("protocolo não permitido");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("porta não permitida");
  if (url.username || url.password) throw new UnsafeUrlError("endereço com credenciais");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new UnsafeUrlError("endereço interno");
  const addresses = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => {
    throw new UnsafeUrlError("domínio não encontrado (DNS)");
  });
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new UnsafeUrlError("endereço interno");
  return url;
}

async function readLimited(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < MAX_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const buf = new Uint8Array(Math.min(total, MAX_BYTES));
  let offset = 0;
  for (const c of chunks) {
    const slice = c.subarray(0, Math.max(0, buf.length - offset));
    buf.set(slice, offset);
    offset += slice.length;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

interface FetchOutcome {
  status: number;
  finalUrl: string;
  html: string;
  isHtml: boolean;
}

async function safeFetch(start: string, signal: AbortSignal): Promise<FetchOutcome> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]),
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5", "Accept-Language": "pt-BR,pt;q=0.9" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      await res.body?.cancel().catch(() => undefined);
      current = new URL(location, url).toString();
      continue;
    }
    const type = res.headers.get("content-type") ?? "";
    const isHtml = /html|xml/i.test(type) || !type;
    const html = isHtml && res.status < 400 ? await readLimited(res) : (await res.body?.cancel().catch(() => undefined), "");
    return { status: res.status, finalUrl: url.toString(), html, isHtml };
  }
  throw new UnsafeUrlError("redirecionamentos demais");
}

/** Sinais objetivos do HTML (função pura, testada). */
export function analyzeHtml(html: string, now = new Date()) {
  const hasViewport = /<meta[^>]+name\s*=\s*["']?viewport/i.test(html);
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).replace(/\s+/g, " ").trim().slice(0, 140) || null : null;
  const years: number[] = [];
  const re = /(?:©|&copy;|&#169;|&#xa9;|copyright)\s*(?:\d{4}\s*[-–—]\s*)?((?:19|20)\d{2})/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const y = Number(m[1]);
    if (y >= 1995 && y <= now.getFullYear() + 1) years.push(y);
  }
  const copyrightYear = years.length ? Math.max(...years) : null;
  const hasPhoneLink = /href\s*=\s*["']?\s*(?:tel:|https?:\/\/(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|wa\.link|whatsapp\.com\/send))/i.test(html);
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const scriptRendered = text.length < 200 && /<script/i.test(html);
  return { hasViewport, title, copyrightYear, hasPhoneLink: scriptRendered && !hasPhoneLink ? null : hasPhoneLink, scriptRendered };
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}

function describeError(e: unknown): string {
  if (e instanceof UnsafeUrlError) return e.message;
  if (e instanceof Error) {
    if (e.name === "TimeoutError") return "tempo esgotado";
    if (e.name === "AbortError") return "cancelado";
    const code = (e.cause as { code?: string } | undefined)?.code;
    if (code === "ENOTFOUND") return "domínio não encontrado (DNS)";
    if (code === "ECONNREFUSED") return "conexão recusada";
    if (code && /CERT|SSL|TLS/i.test(code)) return "certificado HTTPS inválido";
  }
  return "falha de conexão";
}

/** Confere um site: tenta HTTPS primeiro e cai para a URL original. */
export async function checkSite(rawUrl: string, signal: AbortSignal, now = new Date()): Promise<SiteCheck> {
  const original = /^https?:\/\//i.test(rawUrl) ? rawUrl.trim() : `http://${rawUrl.trim()}`;
  const httpsFirst = original.replace(/^http:\/\//i, "https://");
  const base: SiteCheck = {
    url: original,
    finalUrl: null,
    reachable: false,
    httpStatus: null,
    https: false,
    hasViewport: null,
    title: null,
    copyrightYear: null,
    hasPhoneLink: null,
    freeHost: freeHostOf(original),
    blocked: false,
    scriptRendered: false,
    error: null,
    checkedAt: now.toISOString(),
  };
  let outcome: FetchOutcome | null = null;
  let lastError: unknown = null;
  for (const candidate of httpsFirst === original ? [original] : [httpsFirst, original]) {
    if (signal.aborted) break;
    try {
      outcome = await safeFetch(candidate, signal);
      if (outcome.status < 400 || candidate === original) break;
    } catch (e) {
      lastError = e;
      if (e instanceof UnsafeUrlError) break;
    }
  }
  if (!outcome) return { ...base, error: describeError(lastError) };
  const https = outcome.finalUrl.startsWith("https://");
  if ([401, 403, 429].includes(outcome.status)) {
    return { ...base, finalUrl: outcome.finalUrl, httpStatus: outcome.status, reachable: true, https, blocked: true };
  }
  if (outcome.status >= 400) return { ...base, finalUrl: outcome.finalUrl, httpStatus: outcome.status, error: `HTTP ${outcome.status}` };
  const analysis = outcome.isHtml ? analyzeHtml(outcome.html, now) : null;
  return {
    ...base,
    finalUrl: outcome.finalUrl,
    httpStatus: outcome.status,
    reachable: true,
    https,
    freeHost: freeHostOf(outcome.finalUrl) ?? base.freeHost,
    hasViewport: analysis?.hasViewport ?? null,
    title: analysis ? analysis.title : null,
    copyrightYear: analysis?.copyrightYear ?? null,
    hasPhoneLink: analysis?.hasPhoneLink ?? null,
    scriptRendered: analysis?.scriptRendered ?? false,
  };
}
