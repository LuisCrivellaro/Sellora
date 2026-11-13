import { z } from "zod";
import { redactSecrets, type PublishingConfig } from "./config";

/**
 * Cliente mínimo da API REST do Coolify v4 (base `<instância>/api/v1`, `Authorization: Bearer <token>`).
 * Endpoints usados, conferidos no openapi.yaml oficial (coollabsio/coolify, branch v4.x):
 *   GET  /version                                  · teste de autenticação
 *   GET  /applications                             · procurar aplicação já criada (idempotência)
 *   GET  /applications/{uuid}                      · estado, domínios (fqdn)
 *   POST /applications/public                      · criar (repositório público)
 *   POST /applications/private-github-app          · criar (GitHub App cadastrado no Coolify)
 *   PATCH /applications/{uuid}                     · ajustar domínio/diretório
 *   POST /deploy?uuid=…                            · iniciar deploy (devolve deployment_uuid)
 *   GET  /deployments/{uuid}                       · acompanhar deploy
 * Não há chamada de exclusão: remover aplicações é decisão humana, feita no painel do Coolify.
 */
export class CoolifyError extends Error {
  constructor(message: string, readonly status: number, readonly code: "auth" | "not_found" | "conflict" | "validation" | "network" | "server" | "unexpected") {
    super(message);
    this.name = "CoolifyError";
  }
}

export const DEPLOYMENT_STATUSES = ["queued", "in_progress", "finished", "failed", "cancelled-by-user"] as const;

const applicationSchema = z.object({
  uuid: z.string().min(1),
  name: z.string().nullable().optional(),
  fqdn: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  git_repository: z.string().nullable().optional(),
  git_branch: z.string().nullable().optional(),
  base_directory: z.string().nullable().optional(),
  build_pack: z.string().nullable().optional(),
}).loose();
export type CoolifyApplication = z.infer<typeof applicationSchema>;

const deploymentSchema = z.object({
  deployment_uuid: z.string().min(1),
  status: z.string(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  commit: z.string().nullable().optional(),
  deployment_url: z.string().nullable().optional(),
}).loose();
export type CoolifyDeployment = z.infer<typeof deploymentSchema>;

export interface CreateApplicationInput {
  name: string; description: string; gitRepository: string; gitBranch: string; baseDirectory: string; domain: string | null;
}

export interface CoolifyApi {
  version(): Promise<string>;
  listApplications(): Promise<CoolifyApplication[]>;
  getApplication(uuid: string): Promise<CoolifyApplication | null>;
  createStaticApplication(input: CreateApplicationInput): Promise<{ uuid: string; domains: string | null }>;
  updateApplication(uuid: string, changes: { domains?: string; base_directory?: string }): Promise<void>;
  deploy(uuid: string, force?: boolean): Promise<string>;
  getDeployment(deploymentUuid: string): Promise<CoolifyDeployment | null>;
}

const uuidParam = (uuid: string) => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(uuid)) throw new CoolifyError("Identificador do Coolify inválido.", 0, "validation");
  return encodeURIComponent(uuid);
};

export function createCoolifyClient(config: PublishingConfig, fetcher: typeof fetch = fetch, timeoutMs = 20_000): CoolifyApi {
  const base = `${config.coolify.url}/api/v1`;

  async function request(method: string, path: string, body?: unknown, allow404 = false): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, {
        method, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(timeoutMs),
        headers: { Authorization: `Bearer ${config.coolify.token}`, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      const reason = error instanceof Error && error.name === "TimeoutError" ? "tempo esgotado" : "sem conexão";
      throw new CoolifyError(`Não foi possível falar com o Coolify (${reason}). Confira COOLIFY_API_URL e se a instância está no ar.`, 0, "network");
    }
    if (allow404 && response.status === 404) return null;
    const text = await response.text().catch(() => "");
    let data: unknown = text;
    try { data = text ? JSON.parse(text) : null; } catch { /* /version e /health respondem texto */ }
    if (response.ok) return data;
    const detail = typeof data === "object" && data && "message" in data ? String((data as { message: unknown }).message) : "";
    const errors = typeof data === "object" && data && "errors" in data ? JSON.stringify((data as { errors: unknown }).errors).slice(0, 240) : "";
    const message = redactSecrets(`${detail}${errors ? ` ${errors}` : ""}`.trim(), config).slice(0, 300);
    if (response.status === 401 || response.status === 403) throw new CoolifyError(`O Coolify recusou o token (${response.status}). Confira COOLIFY_API_TOKEN e as permissões read, write e deploy. ${message}`.trim(), response.status, "auth");
    if (response.status === 404) throw new CoolifyError(`Recurso não encontrado no Coolify. ${message}`.trim(), 404, "not_found");
    if (response.status === 409) throw new CoolifyError(`Conflito de domínio no Coolify. ${message}`.trim(), 409, "conflict");
    if (response.status === 400 || response.status === 422) throw new CoolifyError(`O Coolify recusou a configuração. ${message}`.trim(), response.status, "validation");
    throw new CoolifyError(`O Coolify respondeu ${response.status}. ${message}`.trim(), response.status, response.status >= 500 ? "server" : "unexpected");
  }

  const parse = <T>(schema: z.ZodType<T>, data: unknown, what: string): T => {
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new CoolifyError(`Resposta inesperada do Coolify (${what}). A versão da instância pode ser incompatível.`, 200, "unexpected");
    return parsed.data;
  };

  return {
    async version() {
      const data = await request("GET", "/version");
      return typeof data === "string" ? data.trim().slice(0, 40) : String(data ?? "").slice(0, 40);
    },
    async listApplications() {
      return parse(z.array(applicationSchema), await request("GET", "/applications"), "lista de aplicações");
    },
    async getApplication(uuid) {
      const data = await request("GET", `/applications/${uuidParam(uuid)}`, undefined, true);
      return data === null ? null : parse(applicationSchema, data, "aplicação");
    },
    async createStaticApplication(input) {
      const { coolify } = config;
      const body: Record<string, unknown> = {
        project_uuid: coolify.projectUuid, server_uuid: coolify.serverUuid, environment_name: coolify.environmentName,
        ...(coolify.destinationUuid ? { destination_uuid: coolify.destinationUuid } : {}),
        ...(coolify.githubAppUuid ? { github_app_uuid: coolify.githubAppUuid } : {}),
        git_repository: input.gitRepository, git_branch: input.gitBranch,
        build_pack: "static", static_image: "nginx:alpine", is_static: true, ports_exposes: "80",
        // build pack "static": o Coolify serve com nginx o conteúdo do diretório base (a pasta da demo).
        base_directory: input.baseDirectory,
        watch_paths: `${input.baseDirectory.replace(/^\//, "")}/**`,
        name: input.name, description: input.description,
        // A Sellora decide quando publicar: sem deploy automático a cada push nem deploy imediato na criação.
        is_auto_deploy_enabled: false, instant_deploy: false, is_force_https_enabled: true,
        ...(input.domain ? { domains: `https://${input.domain}`, noindex_domains: [`https://${input.domain}`], autogenerate_domain: false } : { autogenerate_domain: true }),
        tags: ["sellora-demo"],
      };
      const path = coolify.githubAppUuid ? "/applications/private-github-app" : "/applications/public";
      const data = parse(z.object({ uuid: z.string().min(1), domains: z.string().nullable().optional() }).loose(), await request("POST", path, body), "criação da aplicação");
      return { uuid: data.uuid, domains: data.domains ?? null };
    },
    async updateApplication(uuid, changes) {
      await request("PATCH", `/applications/${uuidParam(uuid)}`, changes);
    },
    async deploy(uuid, force = false) {
      const data = parse(z.object({ deployments: z.array(z.object({ deployment_uuid: z.string().min(1).optional(), resource_uuid: z.string().optional(), message: z.string().optional() }).loose()) }).loose(),
        await request("POST", `/deploy?uuid=${uuidParam(uuid)}&force=${force ? "true" : "false"}`), "início do deploy");
      const deployment = data.deployments.find((item) => item.deployment_uuid);
      if (!deployment?.deployment_uuid) throw new CoolifyError(`O Coolify não iniciou o deploy. ${data.deployments[0]?.message ?? ""}`.trim(), 200, "unexpected");
      return deployment.deployment_uuid;
    },
    async getDeployment(deploymentUuid) {
      const data = await request("GET", `/deployments/${uuidParam(deploymentUuid)}`, undefined, true);
      return data === null ? null : parse(deploymentSchema, data, "deploy");
    },
  };
}
