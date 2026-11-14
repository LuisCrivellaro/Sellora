"use strict";

/**
 * Sellora Gateway Adapter para o Claw3D.
 *
 * Servidor WebSocket local que fala o protocolo de gateway do Claw3D (o mesmo do
 * demo-gateway-adapter do upstream) e alimenta o escritório 3D com as execuções reais
 * do Sellora Agent Bridge (`GET <SELLORA_BRIDGE_URL>/api/agents/events`, SSE).
 *
 * - Só escuta em 127.0.0.1.
 * - Exige o token de sessão (SELLORA_ADAPTER_TOKEN) no `connect`; o proxy do Claw3D o injeta
 *   do lado do servidor, sem expor ao navegador.
 * - Só observação: não inicia nem altera execuções.
 * - Reconecta ao bridge com espera crescente e reaplica o retrato completo (`presence`).
 *
 * Fica em integrations/claw3d/ no repositório da Sellora e é copiado para server/ do Claw3D
 * pelo setup.mjs, porque usa a dependência `ws` do Claw3D.
 */

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { WebSocketServer } = require("ws");
const core = require("./sellora-gateway-core.cjs");
const { createProfileStore } = require("./sellora-agent-profiles.cjs");

const PORT = Number.parseInt(process.env.SELLORA_ADAPTER_PORT || "18790", 10);
const BRIDGE_URL = (process.env.SELLORA_BRIDGE_URL || "http://127.0.0.1:3187").replace(/\/$/, "");
const TOKEN = String(process.env.SELLORA_ADAPTER_TOKEN || "").trim();

if (!TOKEN || TOKEN.length < 24) {
  console.error("[sellora-gateway] Defina SELLORA_ADAPTER_TOKEN (24+ caracteres). O adaptador não inicia sem token.");
  process.exit(2);
}
if (!/^http:\/\/(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/i.test(BRIDGE_URL)) {
  console.error("[sellora-gateway] SELLORA_BRIDGE_URL precisa ser local (127.0.0.1/localhost).");
  process.exit(2);
}

const state = core.createState();

// Kanban do Claw3D (skill task-manager): o servidor do Claw3D lê <OPENCLAW_STATE_DIR>/claw3d/task-manager/tasks.json
// a cada 4 s. O adaptador grava ali as execuções reais; cartões criados à mão no Claw3D são preservados.
const TASKS_FILE = process.env.OPENCLAW_STATE_DIR ? path.join(process.env.OPENCLAW_STATE_DIR, "claw3d", "task-manager", "tasks.json") : null;
let taskTimer = null;
function syncTaskBoard() {
  if (!TASKS_FILE) return;
  clearTimeout(taskTimer);
  taskTimer = setTimeout(() => {
    try {
      let existing = null;
      try { existing = JSON.parse(fs.readFileSync(TASKS_FILE, "utf8")); } catch { /* primeiro uso */ }
      const next = core.taskBoardStore(state, existing);
      fs.mkdirSync(path.dirname(TASKS_FILE), { recursive: true });
      const temp = `${TASKS_FILE}.${process.pid}.tmp`;
      fs.writeFileSync(temp, JSON.stringify(next, null, 2), "utf8");
      fs.renameSync(temp, TASKS_FILE);
    } catch (error) { console.warn(`[sellora-gateway] Kanban não atualizado: ${error.message}`); }
  }, 400);
}
// Perfis do Agent Editor (Identity, Soul, Agents, User, Tools, Memory, Heartbeat): padrão versionado copiado pelo
// launcher para server/sellora-agent-profiles/; edições feitas no Claw3D ficam no estado privado dele, com backup.
// Nenhum serviço da Sellora lê esses arquivos: editar não inicia nem altera execuções.
const profiles = createProfileStore({
  defaultsDir: path.join(__dirname, "sellora-agent-profiles"),
  overridesDir: process.env.OPENCLAW_STATE_DIR ? path.join(process.env.OPENCLAW_STATE_DIR, "claw3d", "agent-profiles") : null,
  agentName: (agentId) => state.agents.get(agentId)?.name ?? null,
});
const clients = new Set();

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a), "utf8");
  const right = Buffer.from(String(b), "utf8");
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};
const broadcast = (frames) => {
  for (const frame of frames) for (const send of clients) send(frame);
};

let retryMs = 1000;
let abort = null;
async function followBridge() {
  for (;;) {
    abort = new AbortController();
    try {
      const response = await fetch(`${BRIDGE_URL}/api/agents/events`, {
        headers: { accept: "text/event-stream" }, signal: abort.signal,
      });
      if (!response.ok || !response.body) throw new Error(`bridge respondeu ${response.status}`);
      state.bridge.connected = true;
      state.bridge.lastError = null;
      retryMs = 1000;
      console.info(`[sellora-gateway] conectado ao bridge ${BRIDGE_URL}`);
      const parse = core.createSseParser((event, data) => { broadcast(core.applyBridgeEvent(state, event, data)); if (event !== "heartbeat") syncTaskBoard(); });
      const decoder = new TextDecoder();
      for await (const chunk of response.body) parse(decoder.decode(chunk, { stream: true }));
      throw new Error("bridge encerrou o stream");
    } catch (error) {
      if (state.bridge.connected) console.warn(`[sellora-gateway] bridge desconectado: ${error.message}`);
      state.bridge.connected = false;
      state.bridge.lastError = error.message;
      await new Promise((resolve) => setTimeout(resolve, retryMs));
      retryMs = Math.min(retryMs * 2, 30_000);
    }
  }
}

const handleHttp = (req, res) => {
  // Só um endpoint de saúde, sem dados de execução (esses exigem o token pelo WebSocket).
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    res.end(JSON.stringify({ ok: true, bridge: state.bridge.connected ? "connected" : "disconnected", agents: state.agents.size }));
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Sellora Gateway Adapter\n");
};

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const wss = new WebSocketServer({ noServer: true, maxPayload: 256 * 1024 });
// "localhost" pode resolver para 127.0.0.1 ou ::1: escuta nos dois endereços de loopback, nunca em interfaces externas.
const servers = ["127.0.0.1", "::1"].map((host) => {
  const server = http.createServer(handleHttp);
  server.on("upgrade", (req, socket, head) => {
    if (!LOOPBACK.has(req.socket.remoteAddress || "")) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });
  server.on("error", (error) => console.warn(`[sellora-gateway] ${host}: ${error.message}`));
  return { host, server };
});

wss.on("connection", (ws) => {
  let authorized = false;
  let replayed = false;
  // O Claw3D confere a sequência de eventos por conexão e trata saltos como perda (reconcilia e reseta estados):
  // cada conexão recebe sua própria numeração contínua.
  let seq = 0;
  const send = (frame) => {
    if (!authorized || ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(frame.type === "event" ? { ...frame, seq: seq++ } : frame));
  };
  ws.send(JSON.stringify({ type: "event", event: "connect.challenge", payload: { nonce: crypto.randomUUID() } }));
  ws.on("message", (raw) => {
    let message;
    try { message = JSON.parse(raw.toString("utf8")); } catch { return; }
    if (!message || message.type !== "req" || typeof message.id !== "string" || typeof message.method !== "string") return;
    if (message.method === "connect") {
      const token = message.params?.auth?.token;
      if (typeof token !== "string" || !safeEqual(token, TOKEN)) {
        ws.send(JSON.stringify({ type: "res", id: message.id, ok: false, error: { code: "unauthorized", message: "Token do gateway Sellora inválido." } }));
        ws.close(1008, "unauthorized");
        return;
      }
      authorized = true;
      clients.add(send);
      ws.send(JSON.stringify({ type: "res", id: message.id, ok: true, payload: core.helloPayload(state, { profiles }) }));
      return;
    }
    if (!authorized) {
      ws.send(JSON.stringify({ type: "res", id: message.id, ok: false, error: { code: "not_connected", message: "Envie connect primeiro." } }));
      return;
    }
    const response = core.handleMethod(state, message.method, message.params, message.id, { profiles });
    ws.send(JSON.stringify(response));
    // Nome de exibição alterado no Agent Editor: avisa os demais clientes (ex.: a aba Cloud 3D e outra janela) para
    // recarregarem a lista de agentes com o nome novo.
    if (message.method === "agents.update" && response.ok) broadcast(core.presenceFrames(state));
    // O Claw3D só aplica eventos de agentes que já carregou: reenvia o estado das execuções em andamento
    // depois que o cliente pede a lista de agentes (conexão nova ou recarga da página).
    if (message.method === "agents.list" && !replayed) {
      replayed = true;
      const timer = setTimeout(() => { for (const frame of core.replayFrames(state)) send(frame); }, 1500);
      timer.unref();
    }
  });
  const drop = () => clients.delete(send);
  ws.on("close", drop);
  ws.on("error", drop);
});

const heartbeat = setInterval(() => broadcast([{ type: "event", event: "heartbeat", payload: { ts: Date.now() } }]), 30_000);
heartbeat.unref();

for (const { host, server } of servers) server.listen(PORT, host);
servers[0].server.once("listening", () => {
  console.info(`[sellora-gateway] ouvindo em ws://127.0.0.1:${PORT} e [::1] (bridge ${BRIDGE_URL})`);
  void followBridge();
});

const shutdown = () => {
  abort?.abort();
  for (const client of wss.clients) client.terminate();
  for (const { server } of servers) server.close();
  setImmediate(() => process.exit(0));
  setTimeout(() => process.exit(0), 2000).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.on("disconnect", shutdown);
