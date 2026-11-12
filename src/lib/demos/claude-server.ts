import { spawn } from "node:child_process";
import { access, readdir, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { creationDraftSchema, type CreationDraft, type DemoTextProviderStatus } from "./creation";
import { claudeSystemPrompt } from "./generation-prompts";

const OUTPUT_LIMIT = 5_000_000;

/** Procura o Claude Code: variável explícita, PATH, instalação nativa e a cópia que acompanha o app Claude para Windows. */
export async function claudeExecutable(): Promise<string> {
  const filename = process.platform === "win32" ? "claude.exe" : "claude";
  const candidates = process.env.SELLORA_CLAUDE_PATH ? [process.env.SELLORA_CLAUDE_PATH] : [];
  candidates.push(...(process.env.PATH ?? "").split(path.delimiter).filter(Boolean).map((dir) => path.join(dir, filename)));
  candidates.push(path.join(homedir(), ".local", "bin", filename));
  if (process.platform === "win32" && process.env.APPDATA) {
    const root = path.join(process.env.APPDATA, "Claude", "claude-code");
    const bundled: { file: string; time: number }[] = [];
    for (const version of await readdir(root).catch(() => [])) {
      for (const build of await readdir(path.join(root, version)).catch(() => [])) {
        const file = path.join(root, version, build, filename);
        const info = await stat(file).catch(() => null);
        if (info?.isFile()) bundled.push({ file, time: info.mtimeMs });
      }
    }
    candidates.push(...bundled.sort((a, b) => b.time - a.time).map((item) => item.file));
  }
  for (const candidate of candidates) {
    try { await access(candidate); if ((await stat(candidate)).size > 0) return candidate; } catch { /* next installed location */ }
  }
  throw new Error("Instale o Claude Code (ou o app Claude) e entre com sua conta Claude para usar os textos do Claude.");
}

/** A geração deve consumir a assinatura do usuário, não uma chave de API herdada do ambiente. */
function childEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT"]) delete env[key];
  return env;
}

function run(file: string, args: string[], cwd: string, input: string, timeoutMs: number): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env: childEnv(), windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error("O Claude demorou demais. Tente novamente mais tarde.")); }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk; if (stdout.length > OUTPUT_LIMIT) child.kill(); });
    child.stderr.on("data", () => { /* never expose account/runtime diagnostics to the browser */ });
    child.on("error", () => { clearTimeout(timer); reject(new Error("Não foi possível iniciar o Claude Code local.")); });
    child.on("close", (code) => { clearTimeout(timer); resolve({ code, stdout }); });
    child.stdin.on("error", () => { /* process closed early; reported by close */ });
    child.stdin.end(input);
  });
}

const authSchema = z.object({ loggedIn: z.boolean(), authMethod: z.string().optional() }).loose();

/** Só devolve se há sessão de conta Claude. E-mail, organização e plano ficam fora da resposta. */
export function claudeStatusFromAuth(raw: string): DemoTextProviderStatus {
  let auth: z.infer<typeof authSchema>;
  try { auth = authSchema.parse(JSON.parse(raw)); }
  catch { return { available: false, message: "Não foi possível ler o login do Claude Code. Abra o terminal e rode: claude auth login" }; }
  if (!auth.loggedIn) return { available: false, message: "Entre no Claude Code com sua conta Claude (claude auth login) neste computador." };
  if (auth.authMethod !== "claude.ai") return { available: false, message: "O Claude Code está usando outro tipo de acesso. Entre com sua conta Claude (claude auth login) para usar a assinatura." };
  return { available: true, message: "Conta Claude conectada ao Claude Code local. Os textos usam os limites do seu plano." };
}

export async function claudeTextStatus(): Promise<DemoTextProviderStatus> {
  try {
    const file = await claudeExecutable();
    const { stdout } = await run(file, ["auth", "status"], homedir(), "", 20_000);
    return claudeStatusFromAuth(stdout);
  } catch (error) {
    return { available: false, message: error instanceof Error ? error.message : "Claude Code local indisponível." };
  }
}

const resultSchema = z.object({
  is_error: z.boolean().optional(), subtype: z.string().optional(), api_error_status: z.number().nullable().optional(),
  result: z.string().optional(), structured_output: z.unknown().optional(), total_cost_usd: z.number().optional(),
}).loose();

export interface ClaudeDraftResult { draft: CreationDraft; estimatedUsd: number | null }

/** Criação da demo: Sonnet 5.5 com esforço alto. Ajustes simples (correção de repetição/contraste): esforço médio. */
export const CLAUDE_DEMO_MODEL = "claude-sonnet-5-5";
export type ClaudeEffort = "high" | "medium";

export function claudeDraftArgs(systemFile: string, effort: ClaudeEffort, schema: z.ZodType = creationDraftSchema): string[] {
  return ["-p", "--output-format", "json", "--json-schema", JSON.stringify(z.toJSONSchema(schema, { target: "draft-7" })),
    "--system-prompt-file", systemFile, "--tools", "", "--strict-mcp-config", "--safe-mode", "--no-session-persistence",
    "--permission-mode", "dontAsk", "--model", process.env.SELLORA_CLAUDE_MODEL || CLAUDE_DEMO_MODEL, "--effort", effort];
}

/** Interpreta a saída `--output-format json` do Claude Code e valida a proposta com o mesmo schema do Codex. */
export function parseClaudeDraft(stdout: string): ClaudeDraftResult {
  const { value, estimatedUsd } = parseClaudeStructured(stdout, creationDraftSchema);
  return { draft: value, estimatedUsd };
}

export function parseClaudeStructured<T>(stdout: string, schema: z.ZodType<T>): { value: T; estimatedUsd: number | null } {
  let parsed: z.infer<typeof resultSchema>;
  try { parsed = resultSchema.parse(JSON.parse(stdout)); }
  catch { throw new Error("O Claude não retornou o conteúdo da demo."); }
  if (parsed.is_error || (parsed.subtype && parsed.subtype !== "success")) {
    if (parsed.api_error_status === 429 || /limit/i.test(parsed.result ?? "")) throw new Error("O limite de uso da conta Claude foi atingido. Aguarde a renovação ou gere com o Codex.");
    if (parsed.api_error_status === 401 || /log ?in|auth/i.test(parsed.result ?? "")) throw new Error("A sessão do Claude Code expirou. Entre novamente com sua conta Claude (claude auth login).");
    throw new Error("O Claude não concluiu a direção da demo. Tente novamente.");
  }
  let candidate = parsed.structured_output;
  if (candidate === undefined) {
    try { candidate = JSON.parse(parsed.result ?? ""); } catch { throw new Error("O Claude não retornou o conteúdo da demo."); }
  }
  const value = schema.safeParse(candidate);
  if (!value.success) throw new Error("O conteúdo gerado não passou na validação. Tente uma nova geração.");
  return { value: value.data, estimatedUsd: parsed.total_cost_usd ?? null };
}

/**
 * Escritor de direção e textos com o Claude Code em modo não interativo.
 * Sem ferramentas, sem MCP, sem customizações locais e sem sessão salva: só texto estruturado validado pela aplicação.
 */
export class ClaudeWriter {
  private firstPrompt: string | null = null;
  estimatedUsd = 0;

  private constructor(private file: string, private cwd: string, private systemFile: string, private timeoutMs: number) {}

  static async create(cwd: string, instructions: string, timeoutMs = 6 * 60_000) {
    return ClaudeWriter.withSystemPrompt(cwd, claudeSystemPrompt(instructions), "claude-system-prompt.md", timeoutMs);
  }

  /** V6: prompt de sistema próprio, gravado num arquivo do espaço de trabalho do job. */
  static async withSystemPrompt(cwd: string, systemPrompt: string, filename: string, timeoutMs = 12 * 60_000) {
    const file = await claudeExecutable();
    const systemFile = path.join(cwd, filename);
    await writeFile(systemFile, systemPrompt, "utf8");
    return new ClaudeWriter(file, cwd, systemFile, timeoutMs);
  }

  /** Chamada estruturada genérica (V6). Sem sessão salva: cada chamada leva todo o contexto necessário. */
  async structured<T>(input: string, schema: z.ZodType<T>, effort: ClaudeEffort): Promise<T> {
    const { stdout } = await run(this.file, claudeDraftArgs(this.systemFile, effort, schema), this.cwd, input, this.timeoutMs);
    const result = parseClaudeStructured(stdout, schema);
    this.estimatedUsd += result.estimatedUsd ?? 0;
    return result.value;
  }

  /** Primeira chamada recebe o pedido completo; correções reenviam o pedido, a proposta anterior e os ajustes, já que nada fica salvo entre chamadas. */
  async draft(prompt: string, previous?: CreationDraft): Promise<CreationDraft> {
    if (!this.firstPrompt) this.firstPrompt = prompt;
    const input = previous ? `${this.firstPrompt}\n\nSua proposta anterior (dados para revisar): ${JSON.stringify(previous)}\n\n${prompt}` : prompt;
    const { stdout } = await run(this.file, claudeDraftArgs(this.systemFile, previous ? "medium" : "high"), this.cwd, input, this.timeoutMs);
    const result = parseClaudeDraft(stdout);
    this.estimatedUsd += result.estimatedUsd ?? 0;
    return result.draft;
  }
}
