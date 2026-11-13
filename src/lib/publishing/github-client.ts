import { createHash } from "node:crypto";
import { z } from "zod";
import { redactSecrets, type PublishingConfig } from "./config";

/**
 * Envia os arquivos de uma demo para uma pasta do repositório de demos em um único commit (API Git Data do
 * GitHub: refs, commits, trees, blobs). Idempotente: se a pasta já tem exatamente os mesmos arquivos, não
 * cria commit novo. Arquivos que deixaram de existir na nova versão são removidos da pasta.
 */
export class GithubError extends Error {
  constructor(message: string, readonly status: number) { super(message); this.name = "GithubError"; }
}

export interface FolderCommitResult { commitSha: string; changed: boolean }
export interface GithubApi {
  commitFolder(folder: string, files: { path: string; data: Buffer }[], message: string): Promise<FolderCommitResult>;
  /** Teste de acesso: repositório visível, permissão de escrita e ramo existente. Não grava nada. */
  checkAccess?(): Promise<{ repo: string; private: boolean; branch: string }>;
}

/** SHA-1 de blob do Git ("blob <tamanho>\0<conteúdo>"): compara com a árvore sem baixar arquivos. */
export const gitBlobSha = (data: Buffer) => createHash("sha1").update(`blob ${data.length}\0`).update(data).digest("hex");

const refSchema = z.object({ object: z.object({ sha: z.string() }) }).loose();
const commitSchema = z.object({ sha: z.string(), tree: z.object({ sha: z.string() }) }).loose();
const treeSchema = z.object({ sha: z.string(), truncated: z.boolean().optional(), tree: z.array(z.object({ path: z.string(), type: z.string(), sha: z.string().nullable(), mode: z.string() }).loose()) }).loose();

export function createGithubClient(config: Pick<PublishingConfig, "github"> & Partial<PublishingConfig>, fetcher: typeof fetch = fetch): GithubApi {
  const { owner, repo, branch, token } = config.github;
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  async function call<T>(method: string, path: string, schema: z.ZodType<T>, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await fetcher(`${base}${path}`, {
        method, cache: "no-store", signal: AbortSignal.timeout(30_000),
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Sellora-Demo-Publisher", ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch { throw new GithubError("Não foi possível falar com o GitHub (sem conexão ou tempo esgotado).", 0); }
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = redactSecrets(typeof data === "object" && data && "message" in data ? String((data as { message: unknown }).message) : "", config).slice(0, 200);
      if (response.status === 401) throw new GithubError("O GitHub recusou SELLORA_DEMOS_GITHUB_TOKEN.", 401);
      if (response.status === 403 || response.status === 404) throw new GithubError(`Sem acesso ao repositório ${owner}/${repo} (${response.status}). Confira o nome e se o token tem permissão Contents: read and write nele. ${detail}`.trim(), response.status);
      if (response.status === 409) throw new GithubError(`O repositório ${owner}/${repo} está vazio. Crie um primeiro commit (ex.: README) no ramo ${branch}.`, 409);
      throw new GithubError(`O GitHub respondeu ${response.status}. ${detail}`.trim(), response.status);
    }
    const parsed = schema.safeParse(data);
    if (!parsed.success) throw new GithubError("Resposta inesperada do GitHub.", response.status);
    return parsed.data;
  }

  async function attempt(folder: string, files: { path: string; data: Buffer }[], message: string): Promise<FolderCommitResult> {
    const head = await call("GET", `/git/ref/heads/${branch.split("/").map(encodeURIComponent).join("/")}`, refSchema);
    const parent = await call("GET", `/git/commits/${head.object.sha}`, commitSchema);
    const tree = await call("GET", `/git/trees/${parent.tree.sha}?recursive=1`, treeSchema);
    if (tree.truncated) throw new GithubError("A árvore do repositório de demos é grande demais para conferência completa. Arquive demos antigas em outro repositório.", 200);
    const prefix = `${folder}/`;
    const existing = new Map(tree.tree.filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix)).map((entry) => [entry.path, entry.sha]));
    const wanted = new Map(files.map((file) => [`${prefix}${file.path}`, file]));
    const changedFiles = [...wanted].filter(([path, file]) => existing.get(path) !== gitBlobSha(file.data));
    const removed = [...existing.keys()].filter((path) => !wanted.has(path));
    if (!changedFiles.length && !removed.length) return { commitSha: head.object.sha, changed: false };

    const entries: { path: string; mode: "100644"; type: "blob"; sha: string | null }[] = [];
    for (const [path, file] of changedFiles) {
      const blob = await call("POST", "/git/blobs", z.object({ sha: z.string() }).loose(), { content: file.data.toString("base64"), encoding: "base64" });
      entries.push({ path, mode: "100644", type: "blob", sha: blob.sha });
    }
    for (const path of removed) entries.push({ path, mode: "100644", type: "blob", sha: null });
    const newTree = await call("POST", "/git/trees", z.object({ sha: z.string() }).loose(), { base_tree: parent.tree.sha, tree: entries });
    const commit = await call("POST", "/git/commits", z.object({ sha: z.string() }).loose(), { message, tree: newTree.sha, parents: [head.object.sha] });
    await call("PATCH", `/git/refs/heads/${branch.split("/").map(encodeURIComponent).join("/")}`, z.unknown(), { sha: commit.sha, force: false });
    return { commitSha: commit.sha, changed: true };
  }

  return {
    async checkAccess() {
      const info = await call("GET", "", z.object({ full_name: z.string(), private: z.boolean(), permissions: z.object({ push: z.boolean() }).loose().optional() }).loose());
      if (!info.permissions?.push) throw new GithubError(`O token lê ${info.full_name}, mas não tem permissão de escrita (Contents: read and write).`, 403);
      await call("GET", `/git/ref/heads/${branch.split("/").map(encodeURIComponent).join("/")}`, refSchema);
      return { repo: info.full_name, private: info.private, branch };
    },
    async commitFolder(folder, files, message) {
      if (!/^[a-z0-9][a-z0-9/_-]{0,120}$/.test(folder) || folder.includes("..")) throw new GithubError("Pasta de destino inválida.", 0);
      try { return await attempt(folder, files, message); }
      catch (error) {
        // 422 em PATCH ref = outro commit entrou no meio (não é fast-forward): refaz uma vez sobre o novo topo.
        if (error instanceof GithubError && error.status === 422) return attempt(folder, files, message);
        throw error;
      }
    },
  };
}
