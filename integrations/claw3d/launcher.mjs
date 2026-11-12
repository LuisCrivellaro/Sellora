// Sobe o escritório 3D local da Sellora: Sellora Gateway Adapter + servidor do Claw3D.
//
// Usado pelo Electron (desktop/main.mjs) e, no desenvolvimento, por `node integrations/claw3d/launcher.mjs`.
// - Gera um token aleatório por sessão para o adaptador; ele fica só no settings.json privado do
//   Claw3D (lido pelo proxy do servidor), nunca no navegador.
// - Claw3D e adaptador escutam só em 127.0.0.1.
// - Encerrar o launcher encerra os dois processos.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const CLAW3D_DEFAULTS = { port: 3190, adapterPort: 18790 };

/** Configuração mínima do Claw3D apontando para o adaptador, com conexão automática (adapterType "demo"). */
export function writeStudioSettings(stateDir, { adapterPort, token }) {
  const dir = path.join(stateDir, "claw3d");
  mkdirSync(dir, { recursive: true });
  const url = `ws://127.0.0.1:${adapterPort}`;
  const gateway = {
    url, token, adapterType: "demo",
    profiles: { demo: { url, token } },
    lastKnownGood: { adapterType: "demo", url, token },
  };
  writeFileSync(path.join(dir, "settings.json"), JSON.stringify({ version: 1, gateway }, null, 2), { encoding: "utf8", mode: 0o600 });
}

/**
 * Inicia os dois processos. Retorna { url, stop, done }.
 * appDir: checkout do Claw3D preparado por setup.mjs; stateDir: pasta privada de estado.
 */
export function startClaw3d({ appDir, stateDir, bridgeUrl, port = CLAW3D_DEFAULTS.port, adapterPort = CLAW3D_DEFAULTS.adapterPort, nodePath = process.execPath, env = {}, log = console.log }) {
  if (!existsSync(path.join(appDir, ".next", "BUILD_ID"))) throw new Error(`Claw3D não preparado em ${appDir}. Rode: node integrations/claw3d/setup.mjs`);
  if (!existsSync(path.join(appDir, "server", "sellora-gateway-adapter.cjs"))) throw new Error("Adaptador Sellora ausente no Claw3D. Rode o setup novamente.");
  const token = randomBytes(24).toString("base64url");
  writeStudioSettings(stateDir, { adapterPort, token });
  const baseEnv = { ...process.env, ...env, ELECTRON_RUN_AS_NODE: "1" };
  for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]) delete baseEnv[key];
  const children = [];
  const launch = (name, args, extraEnv) => {
    const child = spawn(nodePath, args, { cwd: appDir, env: { ...baseEnv, ...extraEnv }, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    child.stdout.on("data", (chunk) => log(`[${name}] ${String(chunk).trimEnd()}`));
    child.stderr.on("data", (chunk) => log(`[${name}] ${String(chunk).trimEnd()}`));
    children.push(child);
    return child;
  };
  const adapter = launch("sellora-gateway", ["server/sellora-gateway-adapter.cjs"], {
    SELLORA_ADAPTER_PORT: String(adapterPort), SELLORA_ADAPTER_TOKEN: token, SELLORA_BRIDGE_URL: bridgeUrl,
  });
  const studio = launch("claw3d", ["server/index.js"], {
    NODE_ENV: "production", PORT: String(port), HOST: "127.0.0.1", OPENCLAW_STATE_DIR: stateDir,
    // O proxy só aceita o adaptador local configurado acima.
    UPSTREAM_ALLOWLIST: "127.0.0.1,localhost",
    NEXT_TELEMETRY_DISABLED: "1",
  });
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    for (const child of children) if (child.exitCode === null) child.kill();
  };
  const done = Promise.race([adapter, studio].map((child) => new Promise((resolve) => child.once("exit", (code) => resolve(code)))));
  done.then(stop);
  return { url: `http://127.0.0.1:${port}/office`, stop, done, pids: children.map((child) => child.pid) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(here, "..", "..");
  const service = startClaw3d({
    appDir: process.env.SELLORA_CLAW3D_DIR || path.join(root, ".claw3d", "app"),
    stateDir: process.env.SELLORA_CLAW3D_STATE || path.join(root, ".claw3d", "state"),
    bridgeUrl: process.env.SELLORA_BRIDGE_URL || "http://127.0.0.1:3100",
    port: Number(process.env.SELLORA_CLAW3D_PORT || CLAW3D_DEFAULTS.port),
  });
  console.log(`Cloud 3D: ${service.url}`);
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { service.stop(); process.exit(0); });
  service.done.then((code) => process.exit(code ?? 0));
}
