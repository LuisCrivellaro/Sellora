import { createHash, randomUUID } from "node:crypto";
import { readSiteFile, readSiteManifest } from "../demos/v6/store";
import { readGithubConfig, readPublishingConfig, redactSecrets, type PublishingConfig } from "./config";
import { CoolifyError, createCoolifyClient, type CoolifyApi, type CoolifyApplication } from "./coolify-client";
import { demoDomain, publicUrlFromFqdn, uniqueSlug } from "./domain";
import { createGithubClient, type GithubApi } from "./github-client";
import { deploymentOutcome, deploymentStatusText, reconcileStatus } from "./status";
import { listPublications, readPublication, writePublication } from "./store";
import type { OperationKind, PublicationHealth, PublicationOperation, PublicationRecord, PublicationView } from "./types";

/**
 * Publicação de demos V6 no Coolify. Fluxo de uma operação (publicar, republicar ou tentar de novo):
 *   1. Preparando: lê os arquivos do site (hash conferido) e envia a pasta da demo ao repositório GitHub.
 *   2. Preparando: localiza a aplicação Coolify do lead (registro → busca por nome → criação). Uma por lead.
 *   3. Publicando: pede o deploy e acompanha GET /deployments/{uuid} até finished/failed.
 *   4. Verificação: lê o endereço do Coolify, baixa a página e compara o SHA-256 do index.html com o
 *      manifesto do site. Só então o estado vira "Publicado". "Deploy iniciado" nunca é tratado como sucesso.
 * Idempotência: uma operação ativa por lead (pedidos repetidos devolvem a mesma), aplicação reaproveitada,
 * commit só quando os arquivos mudam e limite de tentativas por hora.
 */
export class PublishingError extends Error {
  constructor(message: string, readonly code: "not_configured" | "site_missing" | "forbidden" | "rate_limited" | "busy" | "invalid") {
    super(message);
    this.name = "PublishingError";
  }
}

export interface PublishingDeps {
  config: PublishingConfig;
  coolify: CoolifyApi;
  github: GithubApi;
  /** Verificação HTTP do endereço publicado. */
  fetcher: typeof fetch;
  sleep: (ms: number) => Promise<void>;
  pollMs: number;
  deployTimeoutMs: number;
  verifyAttempts: number;
  verifyIntervalMs: number;
}

export interface PublishInput {
  leadId: string;
  siteId: string;
  owner: string;
  kind: OperationKind;
  business: { name: string; city: string; uf: string };
}

const MAX_OPERATIONS_PER_HOUR = 6;
const MAX_ACTIVE = 3;
const RECONCILE_INTERVAL_MS = 20_000;

interface Runtime { active: Map<string, string>; lastCheck: Map<string, number> }
const runtime = (): Runtime => {
  const holder = globalThis as typeof globalThis & { selloraPublishing?: Runtime };
  holder.selloraPublishing ??= { active: new Map(), lastCheck: new Map() };
  return holder.selloraPublishing;
};

/** Ids das operações em andamento neste processo (o bridge usa para separar "em execução" de "interrompida"). */
export function liveOperationIds(): Set<string> { return new Set(runtime().active.values()); }

export function defaultPublishingDeps(): PublishingDeps {
  const { config, status } = readPublishingConfig();
  if (!config) throw new PublishingError(`Publicação não configurada. Faltam: ${[...status.missing, ...status.invalid.map((name) => `${name} (inválida)`)].join(", ")}.`, "not_configured");
  return {
    config, coolify: createCoolifyClient(config), github: createGithubClient(config), fetcher: fetch,
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    pollMs: 5_000, deployTimeoutMs: 20 * 60_000, verifyAttempts: 12, verifyIntervalMs: 10_000,
  };
}

export const toView = (record: PublicationRecord): PublicationView => {
  const view: PublicationView & { owner?: string } = { ...record, active: runtime().active.has(record.leadId) };
  delete view.owner;
  return view;
};

const now = () => new Date().toISOString();
const appNameFor = (slug: string) => `sellora-demo-${slug}`.slice(0, 100);
const messageOf = (error: unknown, config: Partial<Pick<PublishingConfig, "coolify" | "github">> | null) => {
  // Erros de sistema de arquivos trazem caminhos locais: a mensagem gravada/mostrada fica genérica.
  if (error && typeof error === "object" && "code" in error && "syscall" in error) return "Falha ao gravar o registro local da publicação. Tente novamente.";
  return redactSecrets(error instanceof Error ? error.message : "Falha inesperada na publicação.", config).slice(0, 480);
};

function log(record: PublicationRecord, operation: PublicationOperation | undefined, level: "info" | "warn" | "error", message: string, config: PublishingConfig | null) {
  const clean = redactSecrets(message, config).slice(0, 400);
  if (operation) operation.events = [...operation.events, { at: now(), level, message: clean }].slice(-40);
  // Log técnico do servidor: identificadores e mensagem já sem segredos (nunca tokens ou conteúdo da demo).
  const line = `[publicação] lead=${record.leadId} app=${record.coolifyAppUuid ?? "-"} op=${operation?.id ?? "-"} ${clean}`;
  if (level === "error") console.error(line); else if (level === "warn") console.warn(line); else console.info(line);
}

/** Inicia uma operação de publicação. Devolve na hora; o progresso fica no registro (GET). */
export async function startPublication(input: PublishInput, depsArg?: PublishingDeps): Promise<{ view: PublicationView; reused: boolean }> {
  const state = runtime();
  // Trava antes de qualquer await: dois cliques simultâneos não criam duas operações nem duas aplicações.
  if (state.active.has(input.leadId)) {
    const current = await readPublication(input.leadId);
    if (current && current.owner !== input.owner) throw new PublishingError("Publicação pertence a outra conta.", "forbidden");
    if (current) return { view: toView(current), reused: true };
    throw new PublishingError("A publicação desta demo já está começando. Aguarde alguns segundos.", "busy");
  }
  if (state.active.size >= MAX_ACTIVE) throw new PublishingError("Já há publicações demais em andamento. Aguarde uma terminar.", "busy");
  const operationId = randomUUID();
  state.active.set(input.leadId, operationId);
  let started = false;
  try {
    const deps = depsArg ?? defaultPublishingDeps();
    const manifest = await readSiteManifest(input.siteId);
    if (!manifest?.some((file) => file.path === "index.html")) throw new PublishingError("O site desta demo não foi encontrado neste computador. Gere a demo V6 novamente antes de publicar.", "site_missing");
    let record = await readPublication(input.leadId);
    if (record && record.owner !== input.owner) throw new PublishingError("Publicação pertence a outra conta.", "forbidden");
    if (record?.status === "published" && record.publishedSiteId === input.siteId && input.kind === "publish") return { view: toView(record), reused: true };
    const hourAgo = Date.now() - 3_600_000;
    if (record && record.operations.filter((op) => Date.parse(op.startedAt) > hourAgo).length >= MAX_OPERATIONS_PER_HOUR) {
      throw new PublishingError(`Limite de ${MAX_OPERATIONS_PER_HOUR} tentativas por hora para esta demo. Confira o erro anterior antes de tentar de novo.`, "rate_limited");
    }
    const t = now();
    if (!record) {
      const taken = new Set((await listPublications()).filter((item) => item.leadId !== input.leadId).map((item) => item.slug));
      const slug = uniqueSlug(input.business.name, taken);
      record = {
        version: 1, id: randomUUID(), leadId: input.leadId, owner: input.owner, business: input.business, slug,
        status: "awaiting", health: "unknown", siteId: input.siteId, publishedSiteId: null, url: null,
        domain: demoDomain(slug, deps.config.baseDomain), coolifyAppUuid: null, coolifyAppName: appNameFor(slug),
        github: { repo: `${deps.config.github.owner}/${deps.config.github.repo}`, branch: deps.config.github.branch, path: `${deps.config.github.basePath}/${slug}`, commitSha: null },
        createdAt: t, updatedAt: t, lastDeployAt: null, lastCheckedAt: null, lastError: null, operations: [],
      };
    }
    const operation: PublicationOperation = { id: operationId, kind: input.kind, siteId: input.siteId, status: "preparing", commitSha: null, coolifyDeploymentUuid: null, startedAt: t, finishedAt: null, error: null, events: [] };
    record = { ...record, business: input.business, status: "preparing", siteId: input.siteId, lastError: null, updatedAt: t, operations: [operation, ...record.operations].slice(0, 30) };
    log(record, operation, "info", input.kind === "publish" ? "Publicação solicitada pelo administrador" : input.kind === "republish" ? "Republicação solicitada pelo administrador" : "Nova tentativa solicitada pelo administrador", deps.config);
    await writePublication(record);
    started = true;
    void runOperation(input.leadId, operationId, deps, "prepare");
    return { view: toView(record), reused: false };
  } finally {
    if (!started && state.active.get(input.leadId) === operationId) state.active.delete(input.leadId);
  }
}

async function runOperation(leadId: string, operationId: string, deps: PublishingDeps, from: "prepare" | "track") {
  const state = runtime();
  let record = (await readPublication(leadId))!;
  const op = () => record.operations.find((item) => item.id === operationId)!;
  const save = async (changes: Partial<PublicationRecord> = {}) => { record = { ...record, ...changes, updatedAt: now() }; await writePublication(record); };
  try {
    if (from === "prepare") {
      const manifest = await readSiteManifest(op().siteId);
      if (!manifest) throw new PublishingError("O site da demo não existe mais neste computador.", "site_missing");
      const files: { path: string; data: Buffer }[] = [];
      for (const entry of manifest) {
        const data = await readSiteFile(op().siteId, entry.path);
        if (!data) throw new PublishingError(`O arquivo ${entry.path} da demo está ausente ou foi alterado (hash diferente). Gere a demo novamente.`, "site_missing");
        files.push({ path: entry.path, data });
      }
      log(record, op(), "info", `Enviando ${files.length} arquivo(s) para ${record.github.repo}/${record.github.path}`, deps.config);
      await save();
      const commit = await deps.github.commitFolder(record.github.path, files, `Demo ${record.business.name} (${record.business.city}/${record.business.uf}) · site ${op().siteId}`);
      op().commitSha = commit.commitSha;
      log(record, op(), "info", commit.changed ? `Commit ${commit.commitSha.slice(0, 7)} criado no GitHub` : `Arquivos já estavam no GitHub (commit ${commit.commitSha.slice(0, 7)})`, deps.config);
      await save({ github: { ...record.github, commitSha: commit.commitSha } });

      const app = await ensureApplication(record, op(), deps, async (changes) => save(changes));
      record.coolifyAppUuid = app.uuid;
      op().status = "deploying";
      await save({ status: "deploying", coolifyAppUuid: app.uuid });
      const deploymentUuid = await deps.coolify.deploy(app.uuid, false);
      op().coolifyDeploymentUuid = deploymentUuid;
      log(record, op(), "info", `Deploy ${deploymentUuid} solicitado ao Coolify`, deps.config);
      await save();
    }
    await trackDeployment(record, op(), deps, save);
    const verified = await verifyPublishedContent(record, op(), deps, save);
    op().status = "published";
    op().finishedAt = now();
    log(record, op(), "info", `Publicação confirmada em ${verified.url}`, deps.config);
    await save({ status: "published", url: verified.url, publishedSiteId: op().siteId, lastDeployAt: op().finishedAt, health: "ok", lastCheckedAt: now(), lastError: null });
  } catch (error) {
    const message = messageOf(error, deps.config);
    op().status = "failed";
    op().finishedAt = now();
    op().error = message;
    log(record, op(), "error", message, deps.config);
    await save({ status: "failed", lastError: message }).catch(() => {});
  } finally {
    if (state.active.get(leadId) === operationId) state.active.delete(leadId);
  }
}

/** Aplicação do lead: a do registro, senão uma com o mesmo nome (criação anterior sem registro), senão uma nova. */
async function ensureApplication(record: PublicationRecord, operation: PublicationOperation, deps: PublishingDeps, save: (changes: Partial<PublicationRecord>) => Promise<void>): Promise<CoolifyApplication> {
  let app: CoolifyApplication | null = null;
  if (record.coolifyAppUuid) {
    app = await deps.coolify.getApplication(record.coolifyAppUuid);
    if (!app) log(record, operation, "warn", `A aplicação ${record.coolifyAppUuid} não existe mais no Coolify; procurando ou criando outra`, deps.config);
  }
  if (!app) {
    app = (await deps.coolify.listApplications()).find((item) => item.name === record.coolifyAppName) ?? null;
    if (app) log(record, operation, "info", `Aplicação existente ${app.uuid} reaproveitada (sem duplicar)`, deps.config);
  }
  if (!app) {
    const gitRepository = `https://github.com/${record.github.repo}`;
    const created = await deps.coolify.createStaticApplication({
      name: record.coolifyAppName, description: `Demo Sellora · ${record.business.name} (${record.business.city}/${record.business.uf}) · lead ${record.leadId}`,
      gitRepository, gitBranch: record.github.branch, baseDirectory: `/${record.github.path}`, domain: record.domain,
    });
    // Grava o uuid antes de qualquer outro passo: uma falha depois não leva a criar outra aplicação.
    await save({ coolifyAppUuid: created.uuid });
    log(record, operation, "info", `Aplicação ${created.uuid} criada no Coolify`, deps.config);
    return { uuid: created.uuid, name: record.coolifyAppName, fqdn: created.domains };
  }
  if (record.domain && !publicUrlFromFqdn(app.fqdn, deps.config.baseDomain, record.domain)) {
    await deps.coolify.updateApplication(app.uuid, { domains: `https://${record.domain}` });
    log(record, operation, "info", `Domínio ${record.domain} configurado na aplicação`, deps.config);
  }
  return app;
}

async function trackDeployment(record: PublicationRecord, operation: PublicationOperation, deps: PublishingDeps, save: () => Promise<void>) {
  const uuid = operation.coolifyDeploymentUuid;
  if (!uuid) throw new PublishingError("Deploy sem identificação do Coolify.", "invalid");
  const deadline = Date.now() + deps.deployTimeoutMs;
  let last = "";
  let misses = 0;
  for (;;) {
    let status: string | null = null;
    try {
      const deployment = await deps.coolify.getDeployment(uuid);
      if (!deployment) throw new PublishingError(`O deploy ${uuid} não foi encontrado no Coolify.`, "invalid");
      status = deployment.status;
      misses = 0;
    } catch (error) {
      // Falha de rede passageira: tenta de novo algumas vezes antes de desistir.
      if (!(error instanceof CoolifyError) || error.code !== "network" || ++misses > 5) throw error;
    }
    if (status !== null) {
      if (status !== last) { last = status; log(record, operation, "info", deploymentStatusText(status), deps.config); await save(); }
      const outcome = deploymentOutcome(status);
      if (outcome === "finished") return;
      if (outcome === "failed") throw new PublishingError(`${deploymentStatusText(status)} (deploy ${uuid}). Os logs completos ficam no painel do Coolify.`, "invalid");
    }
    if (Date.now() > deadline) throw new PublishingError(`O deploy ${uuid} não terminou em ${Math.round(deps.deployTimeoutMs / 60000)} min. Confira no painel do Coolify e use Verificar.`, "invalid");
    await deps.sleep(deps.pollMs);
  }
}

/** Baixa a página publicada e compara com o index.html gravado. Sem isso, nada é marcado como publicado. */
async function verifyPublishedContent(record: PublicationRecord, operation: PublicationOperation, deps: PublishingDeps, save: () => Promise<void>): Promise<{ url: string }> {
  const app = record.coolifyAppUuid ? await deps.coolify.getApplication(record.coolifyAppUuid) : null;
  if (!app) throw new PublishingError("A aplicação sumiu do Coolify durante a publicação.", "invalid");
  const url = publicUrlFromFqdn(app.fqdn, deps.config.baseDomain, record.domain);
  if (!url) throw new PublishingError(record.domain ? `O Coolify não confirmou o domínio ${record.domain} na aplicação.` : "O Coolify não informou um endereço público válido para a aplicação.", "invalid");
  const expected = (await readSiteManifest(operation.siteId))?.find((file) => file.path === "index.html")?.sha256;
  if (!expected) throw new PublishingError("Manifesto do site ausente para conferência.", "site_missing");
  log(record, operation, "info", `Conferindo o conteúdo em ${url}`, deps.config);
  await save();
  let result: PublicationHealth = "unreachable";
  for (let attempt = 1; attempt <= deps.verifyAttempts; attempt += 1) {
    result = await checkUrl(url, expected, deps.fetcher);
    if (result === "ok") return { url };
    if (attempt < deps.verifyAttempts) await deps.sleep(deps.verifyIntervalMs);
  }
  throw new PublishingError(result === "mismatch"
    ? `O endereço ${url} responde, mas com conteúdo diferente da demo (outra versão ou outra aplicação).`
    : `O deploy terminou, mas ${url} não respondeu com sucesso. Confira DNS (registro curinga para o servidor) e o certificado HTTPS no Coolify, depois use Verificar.`, "invalid");
}

export async function checkUrl(url: string, expectedSha256: string, fetcher: typeof fetch): Promise<PublicationHealth> {
  try {
    const target = new URL(url);
    const response = await fetcher(target, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Sellora-Demo-Publisher" } });
    // Redirecionamento para outro host não comprova a publicação.
    if (response.url && new URL(response.url).hostname !== target.hostname) return "unreachable";
    if (!response.ok) return "unreachable";
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > 5_000_000) return "mismatch";
    return createHash("sha256").update(body).digest("hex") === expectedSha256 ? "ok" : "mismatch";
  } catch { return "unreachable"; }
}

/**
 * Atualiza o registro com o estado real do Coolify: retoma o acompanhamento de um deploy interrompido pelo
 * fechamento do app, detecta aplicação parada (Suspenso) ou apagada (Removido) e confere se o endereço responde.
 */
export async function reconcilePublication(leadId: string, owner: string, opts: { force?: boolean; deps?: PublishingDeps } = {}): Promise<PublicationView | null> {
  let record = await readPublication(leadId);
  if (!record) return null;
  if (record.owner !== owner) throw new PublishingError("Publicação pertence a outra conta.", "forbidden");
  const state = runtime();
  if (state.active.has(leadId)) return toView(record);
  const last = state.lastCheck.get(leadId) ?? 0;
  if (!opts.force && Date.now() - last < RECONCILE_INTERVAL_MS) return toView(record);
  state.lastCheck.set(leadId, Date.now());
  const deps = opts.deps ?? defaultPublishingDeps();
  const current = record.operations[0];

  if (current && (current.status === "preparing" || current.status === "deploying")) {
    if (current.status === "deploying" && current.coolifyDeploymentUuid) {
      // O app foi fechado no meio: o deploy continuou no Coolify. Retoma o acompanhamento real.
      state.active.set(leadId, current.id);
      log(record, current, "info", "Retomando o acompanhamento do deploy após reinício do aplicativo", deps.config);
      await writePublication(record);
      void runOperation(leadId, current.id, deps, "track");
      return toView(record);
    }
    const message = "Interrompida: o aplicativo foi fechado durante a preparação. Use Tentar novamente.";
    record.operations[0] = { ...current, status: "failed", finishedAt: now(), error: message };
    record = { ...record, status: "failed", lastError: message, updatedAt: now() };
    await writePublication(record);
    return toView(record);
  }

  if (!record.coolifyAppUuid) return toView(record);
  try {
    const app = await deps.coolify.getApplication(record.coolifyAppUuid);
    const status = reconcileStatus(record.status, { found: !!app, status: app?.status });
    let health: PublicationHealth = record.health;
    if (app && (status === "published" || status === "failed") && record.url && record.publishedSiteId) {
      const expected = (await readSiteManifest(record.publishedSiteId))?.find((file) => file.path === "index.html")?.sha256;
      health = expected ? await checkUrl(record.url, expected, deps.fetcher) : "unknown";
    } else if (!app || status === "suspended") health = "unreachable";
    const lastError = status === "removed" ? "A aplicação não existe mais no Coolify (removida no painel)." : status === "suspended" ? `A aplicação está parada no Coolify (${app?.status ?? "sem estado"}).` : record.status === "failed" ? record.lastError : null;
    record = { ...record, status, health, lastCheckedAt: now(), lastError, ...(status === "removed" ? { coolifyAppUuid: null } : {}), updatedAt: now() };
  } catch (error) {
    record = { ...record, health: "unknown", lastCheckedAt: now(), lastError: `Verificação falhou: ${messageOf(error, deps.config)}`, updatedAt: now() };
  }
  await writePublication(record);
  return toView(record);
}

type Check<T> = ({ ok: true } & T) | { ok: false; error: string } | { ok: null; error: string };

/**
 * Teste de conexão, sem gravar nada: Coolify (GET /version) e GitHub (repositório, escrita, ramo).
 * Cada parte é testada assim que as variáveis dela existem, para validar o GitHub antes de haver VPS.
 */
export async function testPublishingConnection(fetcher: typeof fetch = fetch): Promise<{ coolify: Check<{ version: string }>; github: Check<{ repo: string; private: boolean; branch: string }> }> {
  const { config } = readPublishingConfig();
  const github = readGithubConfig();
  const coolify: Check<{ version: string }> = config
    ? await createCoolifyClient(config, fetcher).version().then((version) => ({ ok: true as const, version }), (error) => ({ ok: false as const, error: messageOf(error, config) }))
    : { ok: null, error: "Coolify ainda não configurado (faltam variáveis)." };
  const githubResult: Check<{ repo: string; private: boolean; branch: string }> = github
    ? await createGithubClient({ github }, fetcher).checkAccess!().then((info) => ({ ok: true as const, ...info }), (error) => ({ ok: false as const, error: messageOf(error, { github }) }))
    : { ok: null, error: "Repositório ou token do GitHub ainda não configurado." };
  return { coolify, github: githubResult };
}
