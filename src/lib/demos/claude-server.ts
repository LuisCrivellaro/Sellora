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

/**
 * Perfil do Claude Code usado pelo gerador de demos.
 * - `dedicated`: SELLORA_DEMO_CLAUDE_CONFIG_DIR aponta para uma pasta própria (conta secundária, ex.: Claude Pro só das demos).
 *   O processo filho recebe CLAUDE_CONFIG_DIR só no ambiente dele; a conta principal e as variáveis do sistema não mudam.
 *   Sem login nessa pasta a geração para com instruções: nunca cai silenciosamente na conta principal.
 * - `default`: sem a variável, usa o perfil padrão do Claude Code (o status deixa isso explícito).
 */
export interface ClaudeProfile { kind: "dedicated" | "default"; dir?: string; error?: string }

export function demoClaudeProfile(env: Record<string, string | undefined> = process.env): ClaudeProfile {
  const raw = env.SELLORA_DEMO_CLAUDE_CONFIG_DIR?.trim();
  if (!raw) return { kind: "default" };
  if (/[\r\n\0"]/.test(raw) || !(path.isAbsolute(raw) || path.win32.isAbsolute(raw))) return { kind: "dedicated", error: "SELLORA_DEMO_CLAUDE_CONFIG_DIR precisa ser um caminho absoluto para uma pasta só das demos." };
  const resolved = path.resolve(raw);
  const same = (a: string, b: string) => process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
  const main = [path.join(homedir(), ".claude"), homedir(), env.CLAUDE_CONFIG_DIR ? path.resolve(env.CLAUDE_CONFIG_DIR) : ""].filter(Boolean);
  if (main.some((dir) => same(dir, resolved))) return { kind: "dedicated", error: "SELLORA_DEMO_CLAUDE_CONFIG_DIR aponta para a pasta da conta principal do Claude Code. Use uma pasta separada só para as demos." };
  return { kind: "dedicated", dir: resolved };
}

/**
 * A geração consome a assinatura (nunca uma chave de API herdada do ambiente). Com perfil dedicado, só este processo
 * filho recebe CLAUDE_CONFIG_DIR.
 */
export function childEnv(profile: ClaudeProfile = demoClaudeProfile()): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const key of ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_BASE_URL", "CLAUDE_CODE_USE_BEDROCK", "CLAUDE_CODE_USE_VERTEX", "CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "SELLORA_DEMO_CLAUDE_CONFIG_DIR"]) delete env[key];
  if (profile.kind === "dedicated") {
    if (!profile.dir) throw new Error(profile.error ?? "Perfil dedicado do Claude inválido.");
    env.CLAUDE_CONFIG_DIR = profile.dir;
  }
  return env;
}

/** Procedimento de login da conta dedicada. Sem senha no app: o login acontece no navegador, pelo próprio Claude Code. */
export function dedicatedLoginSteps(dir: string, executable = "claude"): string {
  return `Para conectar: feche o Sellora, abra o PowerShell e rode $env:CLAUDE_CONFIG_DIR="${dir}"; & "${executable}" auth login --claudeai. Entre com a conta Claude secundária no navegador e reabra o Sellora. A variável vale só para aquela janela do PowerShell; a conta principal continua como está.`;
}

function run(file: string, args: string[], cwd: string, input: string, timeoutMs: number, env: NodeJS.ProcessEnv = childEnv()): Promise<{ code: number | null; stdout: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(file, args, { cwd, env, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
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
export function claudeStatusFromAuth(raw: string, profile: ClaudeProfile = { kind: "default" }, executable = "claude"): DemoTextProviderStatus {
  const dedicated = profile.kind === "dedicated";
  const base = { profile: profile.kind } as const;
  let auth: z.infer<typeof authSchema>;
  try { auth = authSchema.parse(JSON.parse(raw)); }
  catch { return { ...base, available: false, message: "Não foi possível ler o login do Claude Code. Abra o terminal e rode: claude auth login" }; }
  if (!auth.loggedIn) return dedicated
    ? { ...base, available: false, message: "A conta Claude dedicada às demos não está conectada. A geração não usa a conta principal no lugar dela.", setup: dedicatedLoginSteps(profile.dir ?? "", executable) }
    : { ...base, available: false, message: "Entre no Claude Code com sua conta Claude (claude auth login) neste computador." };
  if (auth.authMethod !== "claude.ai") return { ...base, available: false, message: `O Claude Code ${dedicated ? "do perfil das demos " : ""}está usando outro tipo de acesso (não a assinatura). Entre com a conta Claude (auth login --claudeai); a API paga não é usada sem configuração explícita.` };
  return dedicated
    ? { ...base, available: true, message: "Conta Claude dedicada às demos conectada (perfil isolado). Textos, design e código usam os limites dessa assinatura." }
    : { ...base, available: true, message: "Conta Claude conectada pelo perfil padrão do Claude Code (o mesmo do desenvolvimento). Para usar uma conta só das demos, defina SELLORA_DEMO_CLAUDE_CONFIG_DIR." };
}

export async function claudeTextStatus(): Promise<DemoTextProviderStatus> {
  const profile = demoClaudeProfile();
  if (profile.error) return { available: false, profile: profile.kind, message: profile.error };
  try {
    const file = await claudeExecutable();
    if (profile.dir && !(await stat(profile.dir).then((info) => info.isDirectory(), () => false))) {
      return { available: false, profile: profile.kind, message: "A pasta do perfil Claude dedicado às demos ainda não existe: faça o primeiro login nela.", setup: dedicatedLoginSteps(profile.dir, file) };
    }
    const { stdout } = await run(file, ["auth", "status"], homedir(), "", 20_000, childEnv(profile));
    return claudeStatusFromAuth(stdout, profile, file);
  } catch (error) {
    return { available: false, profile: profile.kind, message: error instanceof Error ? error.message : "Claude Code local indisponível." };
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

/**
 * Mesma chamada estruturada, com imagens: o pedido entra por stdin como uma mensagem `stream-json` (texto + blocos de
 * imagem em base64) e a resposta sai em `stream-json`, da qual só a linha `result` interessa. Verificado com o Claude
 * Code 2.1.325 (imagem + --json-schema na mesma chamada). Continua sem ferramentas, sem MCP e sem sessão salva.
 */
export function claudeVisionArgs(systemFile: string, effort: ClaudeEffort, schema: z.ZodType): string[] {
  const args = claudeDraftArgs(systemFile, effort, schema);
  const at = args.indexOf("--output-format");
  args.splice(at, 2, "--input-format", "stream-json", "--output-format", "stream-json", "--verbose");
  return args;
}

export interface ClaudeImage { label: string; mediaType: "image/png" | "image/jpeg" | "image/webp"; data: Buffer }

/** Mensagem de entrada `stream-json`: cada imagem vem precedida do rótulo que o prompt cita. */
export function claudeVisionInput(prompt: string, images: ClaudeImage[]): string {
  const content: unknown[] = [{ type: "text", text: prompt }];
  for (const image of images) {
    content.push({ type: "text", text: `Imagem: ${image.label}` });
    content.push({ type: "image", source: { type: "base64", media_type: image.mediaType, data: image.data.toString("base64") } });
  }
  return `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`;
}

/** Saída `stream-json`: uma linha JSON por evento; o resultado final tem `type: "result"`. */
export function parseClaudeStream<T>(stdout: string, schema: z.ZodType<T>): { value: T; estimatedUsd: number | null } {
  const result = stdout.split(/\r?\n/).reverse().find((line) => line.startsWith("{") && line.includes('"type":"result"'));
  if (!result) throw new Error("O Claude não retornou a avaliação visual.");
  return parseClaudeStructured(result, schema);
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
    if (parsed.api_error_status === 429 || /limit|credit balance/i.test(parsed.result ?? "")) throw new Error("O limite de uso da conta Claude foi atingido. As etapas concluídas ficam salvas; tente de novo depois da renovação do limite.");
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
  calls = 0;

  private constructor(private file: string, private cwd: string, private systemFile: string, private timeoutMs: number, private env: NodeJS.ProcessEnv) {}

  static async create(cwd: string, instructions: string, timeoutMs = 6 * 60_000) {
    return ClaudeWriter.withSystemPrompt(cwd, claudeSystemPrompt(instructions), "claude-system-prompt.md", timeoutMs);
  }

  /** Prompt de sistema próprio, gravado num arquivo do espaço de trabalho do job. Usa o perfil das demos (dedicado ou padrão). */
  static async withSystemPrompt(cwd: string, systemPrompt: string, filename: string, timeoutMs = 12 * 60_000) {
    const env = childEnv();
    const file = await claudeExecutable();
    const systemFile = path.join(cwd, filename);
    await writeFile(systemFile, systemPrompt, "utf8");
    return new ClaudeWriter(file, cwd, systemFile, timeoutMs, env);
  }

  /**
   * V6: confere antes o login do perfil das demos. Uma conta dedicada desconectada para a geração com o procedimento
   * de login, sem gastar etapas e sem trocar pela conta principal.
   */
  static async forDemos(cwd: string, systemPrompt: string, filename = "v6-system-prompt.md", timeoutMs = 12 * 60_000) {
    const status = await claudeTextStatus();
    if (!status.available) throw new Error([status.message, status.setup].filter(Boolean).join(" "));
    return ClaudeWriter.withSystemPrompt(cwd, systemPrompt, filename, timeoutMs);
  }

  /** Chamada estruturada genérica (V6). Sem sessão salva: cada chamada leva todo o contexto necessário. */
  async structured<T>(input: string, schema: z.ZodType<T>, effort: ClaudeEffort): Promise<T> {
    this.calls += 1;
    const { stdout } = await run(this.file, claudeDraftArgs(this.systemFile, effort, schema), this.cwd, input, this.timeoutMs, this.env);
    const result = parseClaudeStructured(stdout, schema);
    this.estimatedUsd += result.estimatedUsd ?? 0;
    return result.value;
  }

  /** Chamada estruturada com capturas de tela (revisão de impacto visual do V6). */
  async structuredWithImages<T>(input: string, images: ClaudeImage[], schema: z.ZodType<T>, effort: ClaudeEffort): Promise<T> {
    this.calls += 1;
    const { stdout } = await run(this.file, claudeVisionArgs(this.systemFile, effort, schema), this.cwd, claudeVisionInput(input, images), this.timeoutMs, this.env);
    const result = parseClaudeStream(stdout, schema);
    this.estimatedUsd += result.estimatedUsd ?? 0;
    return result.value;
  }

  /** Primeira chamada recebe o pedido completo; correções reenviam o pedido, a proposta anterior e os ajustes, já que nada fica salvo entre chamadas. */
  async draft(prompt: string, previous?: CreationDraft): Promise<CreationDraft> {
    if (!this.firstPrompt) this.firstPrompt = prompt;
    const input = previous ? `${this.firstPrompt}\n\nSua proposta anterior (dados para revisar): ${JSON.stringify(previous)}\n\n${prompt}` : prompt;
    const { stdout } = await run(this.file, claudeDraftArgs(this.systemFile, previous ? "medium" : "high"), this.cwd, input, this.timeoutMs, this.env);
    const result = parseClaudeDraft(stdout);
    this.estimatedUsd += result.estimatedUsd ?? 0;
    return result.draft;
  }
}
