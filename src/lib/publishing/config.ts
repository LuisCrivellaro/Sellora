import type { PublishingStatusView } from "./types";

/**
 * Configuração da publicação de demos (somente servidor). Os valores vêm de variáveis de ambiente
 * (.env.local no desenvolvimento, ambiente do processo no app desktop) e nunca saem do servidor:
 * o status devolvido à interface traz só nomes de variáveis ausentes/inválidas.
 */
export interface PublishingConfig {
  coolify: {
    /** Origem da instância, sem /api/v1 (ex.: https://coolify.exemplo.com.br). */
    url: string;
    token: string;
    projectUuid: string;
    serverUuid: string;
    environmentName: string;
    destinationUuid: string | null;
    /** GitHub App cadastrado no Coolify (repositório privado). Sem ele, o repositório precisa ser público. */
    githubAppUuid: string | null;
  };
  github: { owner: string; repo: string; branch: string; token: string; basePath: string };
  /** Domínio principal das demos (ex.: demos.exemplo.com.br). Sem ele, o Coolify gera o endereço. */
  baseDomain: string | null;
}

type Env = Record<string, string | undefined>;
const value = (env: Env, name: string) => env[name]?.trim() || "";
const UUIDISH = /^[A-Za-z0-9_-]{4,64}$/;
const LOOPBACK = /^(localhost|127\.0\.0\.1|\[::1\])$/i;

/** Hostname válido (rótulos DNS), sem esquema, porta ou caminho. */
export function isValidHostname(host: string): boolean {
  if (host.length > 253 || !host.includes(".")) return false;
  return host.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) && !/^\d+(\.\d+){3}$/.test(host);
}

export function readPublishingConfig(env: Env = process.env): { config: PublishingConfig | null; status: PublishingStatusView } {
  const missing: string[] = [];
  const invalid: string[] = [];
  const warnings: string[] = [];
  const required = (name: string) => { const v = value(env, name); if (!v) missing.push(name); return v; };

  const rawUrl = required("COOLIFY_API_URL");
  let url = "";
  if (rawUrl) {
    try {
      const parsed = new URL(rawUrl);
      const insecureAllowed = value(env, "COOLIFY_ALLOW_INSECURE_HTTP") === "1";
      const okProtocol = parsed.protocol === "https:" || (parsed.protocol === "http:" && (LOOPBACK.test(parsed.hostname) || insecureAllowed));
      if (!okProtocol || parsed.username || parsed.password || parsed.search || parsed.hash) invalid.push("COOLIFY_API_URL");
      else {
        url = parsed.origin + parsed.pathname.replace(/\/+$/, "").replace(/\/api\/v1$/, "");
        if (parsed.protocol === "http:" && !LOOPBACK.test(parsed.hostname)) warnings.push("COOLIFY_API_URL usa HTTP sem TLS: o token trafega sem criptografia. Use HTTPS assim que o domínio do painel estiver configurado.");
      }
    } catch { invalid.push("COOLIFY_API_URL"); }
  }
  const token = required("COOLIFY_API_TOKEN");
  const projectUuid = required("COOLIFY_PROJECT_UUID");
  const serverUuid = required("COOLIFY_SERVER_UUID");
  for (const [name, v] of [["COOLIFY_PROJECT_UUID", projectUuid], ["COOLIFY_SERVER_UUID", serverUuid]] as const) if (v && !UUIDISH.test(v)) invalid.push(name);
  const environmentName = value(env, "COOLIFY_ENVIRONMENT_NAME") || "production";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(environmentName)) invalid.push("COOLIFY_ENVIRONMENT_NAME");
  const destinationUuid = value(env, "COOLIFY_DESTINATION_UUID") || null;
  if (destinationUuid && !UUIDISH.test(destinationUuid)) invalid.push("COOLIFY_DESTINATION_UUID");
  const githubAppUuid = value(env, "COOLIFY_GITHUB_APP_UUID") || null;
  if (githubAppUuid && !UUIDISH.test(githubAppUuid)) invalid.push("COOLIFY_GITHUB_APP_UUID");

  const repository = required("SELLORA_DEMOS_GITHUB_REPO");
  const repoMatch = /^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/.exec(repository);
  if (repository && !repoMatch) invalid.push("SELLORA_DEMOS_GITHUB_REPO");
  const githubToken = required("SELLORA_DEMOS_GITHUB_TOKEN");
  const branch = value(env, "SELLORA_DEMOS_GITHUB_BRANCH") || "main";
  if (!/^[A-Za-z0-9._/-]{1,100}$/.test(branch) || branch.includes("..")) invalid.push("SELLORA_DEMOS_GITHUB_BRANCH");
  const basePath = (value(env, "SELLORA_DEMOS_GITHUB_PATH") || "demos").replace(/^\/+|\/+$/g, "");
  if (!/^[a-z0-9][a-z0-9/_-]{0,60}$/.test(basePath) || basePath.includes("//")) invalid.push("SELLORA_DEMOS_GITHUB_PATH");

  const rawDomain = value(env, "SELLORA_DEMOS_BASE_DOMAIN").toLowerCase().replace(/^\*\./, "");
  const baseDomain = rawDomain || null;
  if (baseDomain && !isValidHostname(baseDomain)) invalid.push("SELLORA_DEMOS_BASE_DOMAIN");
  if (!baseDomain) warnings.push("SELLORA_DEMOS_BASE_DOMAIN não configurado: o Coolify gera o endereço (domínio curinga do servidor ou sslip.io, possivelmente sem HTTPS).");
  if (!githubAppUuid) warnings.push("COOLIFY_GITHUB_APP_UUID não configurado: o repositório das demos precisa ser público para o Coolify clonar.");

  const configured = missing.length === 0 && invalid.length === 0;
  const status: PublishingStatusView = {
    configured, missing, invalid, warnings: configured ? warnings : [],
    baseDomain: baseDomain && !invalid.includes("SELLORA_DEMOS_BASE_DOMAIN") ? baseDomain : null,
    repository: repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : null,
    sourceMode: configured ? (githubAppUuid ? "github-app" : "public") : null,
  };
  if (!configured || !repoMatch) return { config: null, status };
  return {
    status,
    config: {
      coolify: { url, token, projectUuid, serverUuid, environmentName, destinationUuid, githubAppUuid },
      github: { owner: repoMatch[1], repo: repoMatch[2], branch, token: githubToken, basePath },
      baseDomain,
    },
  };
}

/** Remove de qualquer texto (erro, log) os segredos configurados, antes de gravar ou devolver. */
export function redactSecrets(text: string, config: PublishingConfig | null = readPublishingConfig().config): string {
  let out = text;
  for (const secret of [config?.coolify.token, config?.github.token]) if (secret && secret.length >= 6) out = out.split(secret).join("[segredo removido]");
  return out.replace(/(Bearer\s+)[A-Za-z0-9|._-]{8,}/gi, "$1[segredo removido]").replace(/gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/g, "[segredo removido]");
}
