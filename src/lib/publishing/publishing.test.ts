import { randomUUID } from "node:crypto";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { writeSite } from "../demos/v6/store";
import { readPublishingConfig, redactSecrets } from "./config";
import { createCoolifyClient, type CoolifyApi, type CoolifyApplication } from "./coolify-client";
import { publicUrlFromFqdn, slugify, uniqueSlug } from "./domain";
import { createGithubClient, gitBlobSha, type GithubApi } from "./github-client";
import { reconcilePublication, startPublication, type PublishingDeps } from "./service";
import { deploymentOutcome, reconcileStatus } from "./status";
import { readPublication, writePublication } from "./store";

const TOKEN = "7|coolifyTokenSecretValue123";
const GH_TOKEN = "github_pat_abcdefghijklmnopqrstuvwxyz012345";
const env = {
  COOLIFY_API_URL: "https://coolify.exemplo.com.br", COOLIFY_API_TOKEN: TOKEN, COOLIFY_PROJECT_UUID: "proj1234", COOLIFY_SERVER_UUID: "srv12345",
  SELLORA_DEMOS_GITHUB_REPO: "sellora/demos", SELLORA_DEMOS_GITHUB_TOKEN: GH_TOKEN, SELLORA_DEMOS_BASE_DOMAIN: "demos.exemplo.com.br",
};
const config = () => readPublishingConfig(env).config!;

describe("configuração", () => {
  it("lista só os nomes que faltam e nunca devolve segredos no status", () => {
    const { config: none, status } = readPublishingConfig({});
    expect(none).toBeNull();
    expect(status.configured).toBe(false);
    expect(status.missing).toEqual(expect.arrayContaining(["COOLIFY_API_URL", "COOLIFY_API_TOKEN", "COOLIFY_PROJECT_UUID", "COOLIFY_SERVER_UUID", "SELLORA_DEMOS_GITHUB_REPO", "SELLORA_DEMOS_GITHUB_TOKEN"]));
    const ok = readPublishingConfig(env);
    expect(ok.status).toMatchObject({ configured: true, baseDomain: "demos.exemplo.com.br", repository: "sellora/demos", sourceMode: "public" });
    expect(JSON.stringify(ok.status)).not.toContain(TOKEN);
    expect(JSON.stringify(ok.status)).not.toContain(GH_TOKEN);
    expect(ok.config?.coolify.url).toBe("https://coolify.exemplo.com.br");
  });
  it("recusa HTTP sem TLS fora de localhost (salvo opt-in explícito) e domínio inválido", () => {
    expect(readPublishingConfig({ ...env, COOLIFY_API_URL: "http://203.0.113.10:8000" }).status.invalid).toContain("COOLIFY_API_URL");
    const optIn = readPublishingConfig({ ...env, COOLIFY_API_URL: "http://203.0.113.10:8000/api/v1", COOLIFY_ALLOW_INSECURE_HTTP: "1" });
    expect(optIn.config?.coolify.url).toBe("http://203.0.113.10:8000");
    expect(optIn.status.warnings.join(" ")).toMatch(/sem criptografia/);
    expect(readPublishingConfig({ ...env, SELLORA_DEMOS_BASE_DOMAIN: "exemplo" }).status.invalid).toContain("SELLORA_DEMOS_BASE_DOMAIN");
    expect(readPublishingConfig({ ...env, SELLORA_DEMOS_GITHUB_REPO: "https://github.com/x/y" }).status.invalid).toContain("SELLORA_DEMOS_GITHUB_REPO");
  });
  it("remove tokens de mensagens de erro", () => {
    expect(redactSecrets(`falhou com ${TOKEN} e Bearer ${GH_TOKEN}`, config())).not.toMatch(/coolifyTokenSecretValue|abcdefghij/);
  });
});

describe("domínios e estados", () => {
  it("gera subdomínios válidos e únicos", () => {
    expect(slugify("Clínica São José & Filhos")).toBe("clinica-sao-jose-e-filhos");
    expect(uniqueSlug("Restaurante", new Set(["restaurante", "restaurante-2"]))).toBe("restaurante-3");
    expect(publicUrlFromFqdn("http://x.sslip.io,https://cafe.demos.exemplo.com.br", "demos.exemplo.com.br", "cafe.demos.exemplo.com.br")).toBe("https://cafe.demos.exemplo.com.br/");
    expect(publicUrlFromFqdn("https://user:pw@cafe.demos.exemplo.com.br", "demos.exemplo.com.br")).toBeNull();
    expect(publicUrlFromFqdn("https://evil.com", "demos.exemplo.com.br")).toBeNull();
    expect(publicUrlFromFqdn("javascript:alert(1)", null)).toBeNull();
  });
  it("traduz os estados reais do Coolify sem presumir sucesso", () => {
    expect(deploymentOutcome("queued")).toBe("pending");
    expect(deploymentOutcome("in_progress")).toBe("pending");
    expect(deploymentOutcome("finished")).toBe("finished");
    expect(deploymentOutcome("cancelled-by-user")).toBe("failed");
    expect(deploymentOutcome("algo-novo")).toBe("failed");
    expect(reconcileStatus("published", { found: false })).toBe("removed");
    expect(reconcileStatus("published", { found: true, status: "exited:unhealthy" })).toBe("suspended");
    expect(reconcileStatus("suspended", { found: true, status: "running:healthy" })).toBe("published");
    expect(reconcileStatus("published", { found: true, status: "restarting:unhealthy" })).toBe("published");
  });
});

describe("clientes HTTP", () => {
  it("Coolify: Bearer no servidor, endpoints da v4 e aplicação estática sem deploy automático", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init: init! });
      if (String(url).endsWith("/applications/public")) return Response.json({ uuid: "app1", domains: "https://cafe.demos.exemplo.com.br" }, { status: 201 });
      if (String(url).includes("/deploy?")) return Response.json({ deployments: [{ message: "Deployment request queued.", resource_uuid: "app1", deployment_uuid: "dep1" }] });
      return Response.json({ message: `Unauthenticated ${TOKEN}` }, { status: 401 });
    }) as unknown as typeof fetch;
    const client = createCoolifyClient(config(), fetcher);
    await expect(client.createStaticApplication({ name: "sellora-demo-cafe", description: "d", gitRepository: "https://github.com/sellora/demos", gitBranch: "main", baseDirectory: "/demos/cafe", domain: "cafe.demos.exemplo.com.br" })).resolves.toEqual({ uuid: "app1", domains: "https://cafe.demos.exemplo.com.br" });
    const body = JSON.parse(String(calls[0].init.body));
    expect(calls[0].url).toBe("https://coolify.exemplo.com.br/api/v1/applications/public");
    expect((calls[0].init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(body).toMatchObject({ project_uuid: "proj1234", server_uuid: "srv12345", environment_name: "production", build_pack: "static", is_static: true, base_directory: "/demos/cafe", is_auto_deploy_enabled: false, instant_deploy: false, domains: "https://cafe.demos.exemplo.com.br", autogenerate_domain: false });
    await expect(client.deploy("app1")).resolves.toBe("dep1");
    expect(calls[1].url).toBe("https://coolify.exemplo.com.br/api/v1/deploy?uuid=app1&force=false");
    const failure = await client.version().catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toMatch(/recusou o token/);
    expect((failure as Error).message).not.toContain("coolifyTokenSecretValue");
  });

  it("GitHub: pasta idêntica não gera commit; mudança gera um commit com remoção do que saiu", async () => {
    const same = Buffer.from("<html>igual</html>");
    const requests: { method: string; url: string; body: unknown }[] = [];
    const fetcher = (async (url: string, init: RequestInit) => {
      const method = init.method ?? "GET";
      requests.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : null });
      if (url.includes("/git/ref/heads/main")) return Response.json({ object: { sha: "c0" } });
      if (url.endsWith("/git/commits/c0")) return Response.json({ sha: "c0", tree: { sha: "t0" } });
      if (url.includes("/git/trees/t0")) return Response.json({ sha: "t0", truncated: false, tree: [
        { path: "demos/cafe/index.html", type: "blob", sha: gitBlobSha(same), mode: "100644" },
        { path: "demos/cafe/assets/velho.webp", type: "blob", sha: "x".repeat(40), mode: "100644" },
        { path: "demos/outro/index.html", type: "blob", sha: "y".repeat(40), mode: "100644" },
      ] });
      if (url.endsWith("/git/blobs")) return Response.json({ sha: "b1" }, { status: 201 });
      if (url.endsWith("/git/trees")) return Response.json({ sha: "t1" }, { status: 201 });
      if (url.endsWith("/git/commits")) return Response.json({ sha: "c".repeat(40) }, { status: 201 });
      if (method === "PATCH") return Response.json({ object: { sha: "c".repeat(40) } });
      return Response.json({}, { status: 500 });
    }) as unknown as typeof fetch;
    const client: GithubApi = createGithubClient(config(), fetcher);
    const result = await client.commitFolder("demos/cafe", [{ path: "index.html", data: same }, { path: "styles.css", data: Buffer.from("body{}") }], "Demo");
    expect(result).toEqual({ commitSha: "c".repeat(40), changed: true });
    const tree = requests.find((r) => r.method === "POST" && r.url.endsWith("/git/trees"))!.body as { base_tree: string; tree: { path: string; sha: string | null }[] };
    expect(tree.base_tree).toBe("t0");
    expect(tree.tree).toEqual(expect.arrayContaining([{ path: "demos/cafe/styles.css", mode: "100644", type: "blob", sha: "b1" }, { path: "demos/cafe/assets/velho.webp", mode: "100644", type: "blob", sha: null }]));
    expect(tree.tree.some((entry) => entry.path.startsWith("demos/outro"))).toBe(false);
    expect(requests.filter((r) => r.url.endsWith("/git/blobs"))).toHaveLength(1);
    requests.length = 0;
    const unchanged = await createGithubClient(config(), (async (url: string, init: RequestInit) => {
      if (url.includes("/git/trees/t0")) return Response.json({ sha: "t0", tree: [{ path: "demos/cafe/index.html", type: "blob", sha: gitBlobSha(same), mode: "100644" }] });
      return fetcher(url, init);
    }) as unknown as typeof fetch).commitFolder("demos/cafe", [{ path: "index.html", data: same }], "Demo");
    expect(unchanged).toEqual({ commitSha: "c0", changed: false });
  });
});

/** Coolify falso em memória: só para testes automatizados. */
function fakeCoolify(overrides: Partial<{ deploymentStatuses: string[] }> = {}) {
  const apps = new Map<string, CoolifyApplication>();
  let created = 0;
  let statuses = [...(overrides.deploymentStatuses ?? ["queued", "in_progress", "finished"])];
  const api: CoolifyApi = {
    version: async () => "4.0.0",
    listApplications: async () => [...apps.values()],
    getApplication: async (uuid) => apps.get(uuid) ?? null,
    createStaticApplication: async (input) => {
      created += 1;
      const uuid = `app${created}`;
      apps.set(uuid, { uuid, name: input.name, fqdn: input.domain ? `https://${input.domain}` : "http://gerado.sslip.io", status: "exited:unhealthy" });
      return { uuid, domains: apps.get(uuid)!.fqdn ?? null };
    },
    updateApplication: async (uuid, changes) => { const app = apps.get(uuid); if (app && changes.domains) app.fqdn = changes.domains; },
    deploy: async (uuid) => { const app = apps.get(uuid); if (app) app.status = "running:healthy"; return `dep-${randomUUID().slice(0, 8)}`; },
    getDeployment: async (uuid) => ({ deployment_uuid: uuid, status: statuses.length > 1 ? statuses.shift()! : statuses[0] }),
  };
  return { api, apps, created: () => created, setStatuses: (next: string[]) => { statuses = [...next]; } };
}

const INDEX = Buffer.from("<!doctype html><html><body>Café São João · Demonstração não oficial</body></html>");
async function makeSite(index = INDEX) {
  const id = randomUUID();
  await writeSite(id, new Map([["index.html", index], ["styles.css", Buffer.from("body{margin:0}")]]), {});
  return id;
}

function deps(coolify: CoolifyApi, served: () => Buffer | null, commits: string[] = []): PublishingDeps {
  return {
    config: config(), coolify,
    github: { commitFolder: async (folder, files) => { commits.push(`${folder}:${files.length}`); return { commitSha: "d".repeat(40), changed: true }; } },
    fetcher: (async () => { const body = served(); return body ? new Response(new Uint8Array(body), { status: 200 }) : new Response("bad gateway", { status: 502 }); }) as unknown as typeof fetch,
    sleep: async () => {}, pollMs: 0, deployTimeoutMs: 60_000, verifyAttempts: 2, verifyIntervalMs: 0,
  };
}

async function settled(leadId: string) {
  for (let i = 0; i < 200; i += 1) {
    const record = await readPublication(leadId);
    if (record && record.status !== "preparing" && record.status !== "deploying" && !(globalThis as { selloraPublishing?: { active: Map<string, string> } }).selloraPublishing?.active.has(leadId)) return record;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("publicação não terminou");
}

const business = { name: "Café São João", city: "Campinas", uf: "SP" };

describe("serviço de publicação (Coolify e GitHub falsos)", () => {
  beforeEach(() => {
    process.env.SELLORA_DATA_DIR = path.join(process.cwd(), "test-results", "publishing", randomUUID());
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => { delete process.env.SELLORA_DATA_DIR; delete (globalThis as { selloraPublishing?: unknown }).selloraPublishing; vi.restoreAllMocks(); });

  it("publica, associa ao lead, confirma pelo conteúdo e não duplica com cliques repetidos", async () => {
    const siteId = await makeSite();
    const coolify = fakeCoolify();
    const commits: string[] = [];
    const d = deps(coolify.api, () => INDEX, commits);
    const [first, second] = await Promise.all([
      startPublication({ leadId: "lead-1", siteId, owner: "demo:local", kind: "publish", business }, d),
      startPublication({ leadId: "lead-1", siteId, owner: "demo:local", kind: "publish", business }, d).catch((error: Error) => error),
    ]);
    expect(first.reused).toBe(false);
    expect(second instanceof Error ? second.message : second.reused).toBeTruthy();
    const record = await settled("lead-1");
    expect(record).toMatchObject({ leadId: "lead-1", status: "published", health: "ok", siteId, publishedSiteId: siteId, url: "https://cafe-sao-joao.demos.exemplo.com.br/", domain: "cafe-sao-joao.demos.exemplo.com.br", coolifyAppUuid: "app1", coolifyAppName: "sellora-demo-cafe-sao-joao" });
    expect(record.github).toMatchObject({ repo: "sellora/demos", path: "demos/cafe-sao-joao", commitSha: "d".repeat(40) });
    expect(record.operations).toHaveLength(1);
    expect(record.operations[0].events.map((e) => e.message).join(" | ")).toMatch(/Deploy na fila.*construindo.*concluído.*confirmada/);
    expect(coolify.created()).toBe(1);
    expect(commits).toEqual(["demos/cafe-sao-joao:2"]);
    // Pedir de novo a mesma versão já publicada não abre outra operação.
    const again = await startPublication({ leadId: "lead-1", siteId, owner: "demo:local", kind: "publish", business }, d);
    expect(again.reused).toBe(true);
    // Outra conta não acessa o registro.
    await expect(startPublication({ leadId: "lead-1", siteId, owner: "user:outro", kind: "republish", business }, d)).rejects.toThrow(/outra conta/);
  });

  it("deploy iniciado não é sucesso: falha do Coolify vira Falha; nova tentativa reaproveita a aplicação", async () => {
    const siteId = await makeSite();
    const coolify = fakeCoolify({ deploymentStatuses: ["queued", "failed"] });
    const d = deps(coolify.api, () => INDEX);
    await startPublication({ leadId: "lead-2", siteId, owner: "demo:local", kind: "publish", business }, d);
    const failed = await settled("lead-2");
    expect(failed.status).toBe("failed");
    expect(failed.lastError).toMatch(/Deploy falhou no Coolify/);
    expect(failed.url).toBeNull();
    coolify.setStatuses(["finished"]);
    await startPublication({ leadId: "lead-2", siteId, owner: "demo:local", kind: "retry", business }, d);
    const ok = await settled("lead-2");
    expect(ok.status).toBe("published");
    expect(ok.operations.map((op) => op.kind)).toEqual(["retry", "publish"]);
    expect(coolify.created()).toBe(1);
  });

  it("conteúdo diferente no endereço não é publicação confirmada", async () => {
    const siteId = await makeSite();
    const d = deps(fakeCoolify().api, () => Buffer.from("<html>outra coisa</html>"));
    await startPublication({ leadId: "lead-3", siteId, owner: "demo:local", kind: "publish", business }, d);
    const record = await settled("lead-3");
    expect(record.status).toBe("failed");
    expect(record.lastError).toMatch(/conteúdo diferente/);
  });

  it("aplicação criada mas uuid perdido: encontra pelo nome em vez de duplicar", async () => {
    const siteId = await makeSite();
    const coolify = fakeCoolify();
    const d = deps(coolify.api, () => INDEX);
    await startPublication({ leadId: "lead-4", siteId, owner: "demo:local", kind: "publish", business }, d);
    const record = await settled("lead-4");
    await writePublication({ ...record, coolifyAppUuid: null });
    const next = await makeSite(Buffer.from("<html>versão 2</html>"));
    await startPublication({ leadId: "lead-4", siteId: next, owner: "demo:local", kind: "republish", business }, deps(coolify.api, () => Buffer.from("<html>versão 2</html>")));
    const republished = await settled("lead-4");
    expect(republished).toMatchObject({ status: "published", coolifyAppUuid: "app1", publishedSiteId: next });
    expect(coolify.created()).toBe(1);
    expect(republished.operations[0].events.some((e) => /reaproveitada/.test(e.message))).toBe(true);
  });

  it("limita tentativas por hora e recusa site inexistente", async () => {
    const d = deps(fakeCoolify().api, () => INDEX);
    await expect(startPublication({ leadId: "lead-5", siteId: randomUUID(), owner: "demo:local", kind: "publish", business }, d)).rejects.toThrow(/não foi encontrado/);
    const siteId = await makeSite();
    for (let i = 0; i < 6; i += 1) { await startPublication({ leadId: "lead-5", siteId, owner: "demo:local", kind: "republish", business }, d); await settled("lead-5"); }
    await expect(startPublication({ leadId: "lead-5", siteId, owner: "demo:local", kind: "republish", business }, d)).rejects.toThrow(/Limite de 6 tentativas/);
  });

  it("reconciliação detecta aplicação parada, removida e retoma deploy interrompido", async () => {
    const siteId = await makeSite();
    const coolify = fakeCoolify();
    const d = deps(coolify.api, () => INDEX);
    await startPublication({ leadId: "lead-6", siteId, owner: "demo:local", kind: "publish", business }, d);
    await settled("lead-6");
    coolify.apps.get("app1")!.status = "exited:unhealthy";
    expect((await reconcilePublication("lead-6", "demo:local", { force: true, deps: d }))?.status).toBe("suspended");
    coolify.apps.get("app1")!.status = "running:healthy";
    expect(await reconcilePublication("lead-6", "demo:local", { force: true, deps: d })).toMatchObject({ status: "published", health: "ok" });
    coolify.apps.delete("app1");
    expect((await reconcilePublication("lead-6", "demo:local", { force: true, deps: d }))?.status).toBe("removed");

    // App fechado durante o deploy: o registro ficou "Publicando" com o uuid do deploy; a verificação retoma.
    const record = (await readPublication("lead-6"))!;
    coolify.apps.set("app9", { uuid: "app9", name: record.coolifyAppName, fqdn: `https://${record.domain}`, status: "running:healthy" });
    const op = { ...record.operations[0], id: randomUUID(), status: "deploying" as const, coolifyDeploymentUuid: "dep-x", finishedAt: null, error: null };
    await writePublication({ ...record, status: "deploying", coolifyAppUuid: "app9", operations: [op, ...record.operations] });
    coolify.setStatuses(["finished"]);
    await reconcilePublication("lead-6", "demo:local", { force: true, deps: d });
    expect(await settled("lead-6")).toMatchObject({ status: "published", coolifyAppUuid: "app9" });
  });
});
