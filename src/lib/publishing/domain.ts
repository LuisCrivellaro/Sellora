import { isValidHostname } from "./config";

/** Rótulo DNS a partir do nome do estabelecimento: "Clínica São José" → "clinica-sao-jose". */
export function slugify(name: string, maxLength = 40): string {
  const slug = name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, " e ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, maxLength).replace(/-+$/g, "");
  return slug || "demo";
}

/** Escolhe um subdomínio livre: o nome, depois nome-2, nome-3… (os já usados por outros leads ficam de fora). */
export function uniqueSlug(name: string, taken: Set<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n += 1) {
    const candidate = `${base.slice(0, 40 - String(n).length - 1)}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Não foi possível reservar um subdomínio para esta demo.");
}

/** Domínio da demo: <slug>.<domínio principal>, ou null quando o domínio principal não está configurado. */
export function demoDomain(slug: string, baseDomain: string | null): string | null {
  if (!baseDomain) return null;
  const host = `${slug}.${baseDomain}`;
  if (!isValidHostname(host)) throw new Error("Subdomínio inválido para a demo.");
  return host;
}

/**
 * Normaliza o endereço que o Coolify devolve (fqdn pode ter várias URLs separadas por vírgula). Aceita só
 * http(s), sem credenciais, sem porta incomum, e, se houver domínio principal, só hosts dentro dele.
 */
export function publicUrlFromFqdn(fqdn: string | null | undefined, baseDomain: string | null, expectedHost: string | null = null): string | null {
  if (!fqdn) return null;
  for (const raw of fqdn.split(",").map((item) => item.trim()).filter(Boolean)) {
    try {
      const url = new URL(raw);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) continue;
      if (url.port && !["80", "443"].includes(url.port)) continue;
      const host = url.hostname.toLowerCase();
      if (expectedHost && host !== expectedHost) continue;
      if (baseDomain && host !== baseDomain && !host.endsWith(`.${baseDomain}`)) continue;
      return `${url.protocol}//${host}/`;
    } catch { /* próximo */ }
  }
  return null;
}
