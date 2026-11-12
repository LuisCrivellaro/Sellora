// Sobe o escritório 3D local da Sellora: Sellora Gateway Adapter + servidor do Claw3D.
//
// Usado pelo Electron (desktop/main.mjs) e, no desenvolvimento, por `node integrations/claw3d/launcher.mjs`.
// - Gera um token aleatório por sessão para o adaptador; ele fica só no settings.json privado do
//   Claw3D (lido pelo proxy do servidor), nunca no navegador.
// - Claw3D e adaptador escutam só em 127.0.0.1.
// - Encerrar o launcher encerra os dois processos.
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import http from "node:http";
import net from "node:net";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

export const CLAW3D_DEFAULTS = { port: 3190, adapterPort: 18790 };
const CRLF = String.fromCharCode(13, 10);
/** Origens locais da Sellora que podem enquadrar o escritório (dev 3100, produção local 3102, desktop 3187). */
export const SELLORA_FRAME_ANCESTORS = ["http://localhost:3100", "http://127.0.0.1:3100", "http://localhost:3102", "http://127.0.0.1:3102", "http://localhost:3187", "http://127.0.0.1:3187"];

/** Ajusta os cabeçalhos do Claw3D para que só as origens locais da Sellora possam enquadrá-lo. */
export function frameHeaders(headers, ancestors = SELLORA_FRAME_ANCESTORS) {
  const next = { ...headers };
  delete next["x-frame-options"];
  const csp = next["content-security-policy"];
  if (typeof csp === "string") {
    next["content-security-policy"] = csp
      .replace(/frame-ancestors [^;]*/i, `frame-ancestors 'self' ${ancestors.join(" ")}`)
      // A página é servida em http local; não força https nos recursos.
      .replace(/;\s*upgrade-insecure-requests/i, "");
  }
  return next;
}

/**
 * Proxy local fino na frente do Claw3D (que fixa frame-ancestors 'self' no build): repassa HTTP e
 * WebSocket sem alterar conteúdo, só os cabeçalhos de enquadramento. Escuta apenas em 127.0.0.1.
 */
export function startFrameProxy({ port, targetPort, ancestors = SELLORA_FRAME_ANCESTORS, log = console.log }) {
  const server = http.createServer((req, res) => {
    // Entrada usada pela Sellora: o gateway já vem configurado pelo launcher, então o assistente de
    // primeira conexão do Claw3D (salvo no localStorage desta origem) é marcado como concluído.
    if (req.url === "/__sellora/office") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "content-security-policy": `default-src 'none'; script-src 'unsafe-inline'; frame-ancestors 'self' ${ancestors.join(" ")}` });
      res.end(`<!doctype html><meta charset="utf-8"><title>Cloud 3D</title><script>try{localStorage.setItem("claw3d:onboarding:completed","true")}catch(e){}location.replace("/office")</script>`);
      return;
    }
    const upstream = http.request({ host: "127.0.0.1", port: targetPort, method: req.method, path: req.url, headers: req.headers }, (response) => {
      res.writeHead(response.statusCode ?? 502, frameHeaders(response.headers, ancestors));
      response.pipe(res);
    });
    upstream.on("error", () => { if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" }); res.end("Escritório 3D iniciando ou indisponível."); });
    req.pipe(upstream);
  });
  server.on("upgrade", (req, socket, head) => {
    const upstream = net.connect(targetPort, "127.0.0.1", () => {
      const lines = [`${req.method} ${req.url} HTTP/${req.httpVersion}`, ...Object.entries(req.headers).flatMap(([key, value]) => (Array.isArray(value) ? value : [value]).map((item) => `${key}: ${item}`))];
      upstream.write(`${lines.join(CRLF)}${CRLF}${CRLF}`);
      if (head?.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    const close = () => { upstream.destroy(); socket.destroy(); };
    upstream.on("error", close);
    socket.on("error", close);
  });
  server.on("error", (error) => log(`[frame-proxy] ${error.message}`));
  server.listen(port, "127.0.0.1");
  return server;
}

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
  // O Claw3D roda numa porta interna; a porta pública (local) é a do proxy de enquadramento.
  const studio = launch("claw3d", ["server/index.js"], {
    NODE_ENV: "production", PORT: String(port + 1), HOST: "127.0.0.1", OPENCLAW_STATE_DIR: stateDir,
    // O proxy só aceita o adaptador local configurado acima.
    UPSTREAM_ALLOWLIST: "127.0.0.1,localhost",
    NEXT_TELEMETRY_DISABLED: "1",
  });
  const proxy = startFrameProxy({ port, targetPort: port + 1, log });
  let stopped = false;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    proxy.close();
    for (const child of children) if (child.exitCode === null) child.kill();
  };
  const done = Promise.race([adapter, studio].map((child) => new Promise((resolve) => child.once("exit", (code) => resolve(code)))));
  done.then(stop);
  return { url: `http://127.0.0.1:${port}/__sellora/office`, stop, done, pids: children.map((child) => child.pid) };
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
