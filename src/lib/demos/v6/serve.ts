import { CONTENT_TYPES } from "./store";

/**
 * Cabeçalhos do site gerado. O HTML é conteúdo não confiável: a CSP com `sandbox` dá a ele uma origem opaca,
 * então nem na prévia nem aberto direto ele lê cookies, localStorage ou rotas do Sellora.
 * Rede: só os próprios arquivos e Google Fonts; nenhum fetch, formulário ou frame.
 */
export function siteHeaders(extension: string, host: string | null): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Robots-Tag": "noindex, nofollow",
    "Cache-Control": "public, max-age=31536000, immutable",
  };
  if (extension === "html" || extension === "svg") {
    const self = host && /^[a-z0-9.:[\]-]+$/i.test(host) ? ` http://${host} https://${host}` : "";
    headers["Content-Security-Policy"] = [
      "sandbox allow-scripts allow-popups allow-popups-to-escape-sandbox",
      "default-src 'none'",
      `img-src 'self'${self} data:`,
      `style-src 'self'${self} 'unsafe-inline' https://fonts.googleapis.com`,
      "font-src https://fonts.gstatic.com",
      `script-src 'self'${self}`,
      "connect-src 'none'", "form-action 'none'", "base-uri 'none'", "object-src 'none'",
      "frame-ancestors 'self'",
    ].join("; ");
  }
  return headers;
}
