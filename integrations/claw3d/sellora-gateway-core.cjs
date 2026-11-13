"use strict";

/**
 * Núcleo do Sellora Gateway Adapter (sem rede, testável).
 *
 * Traduz os eventos do Sellora Agent Bridge (`/api/agents/events`: presence, agent, heartbeat)
 * para o protocolo de gateway que o Claw3D já consome (frames `event` "agent" com
 * stream "lifecycle"/"assistant" e "presence"), e responde aos métodos de leitura do Claw3D.
 *
 * Regras: só agentes que o bridge declara (nada fictício); só observação (métodos que
 * criam, alteram ou conversam são recusados); eventos repetidos não geram frames repetidos.
 */

const MAIN_KEY = "main";
// Perfil anunciado no handshake: o Claw3D decide as capacidades da interface por ele. "hermes" habilita skills
// (Kanban/task-manager) e coincide com o perfil configurado pelo launcher (conexão por token).
const HELLO_ADAPTER_TYPE = process.env.SELLORA_HELLO_ADAPTER || "hermes";
const READ_ONLY_MESSAGE =
  "Cloud 3D da Sellora é só observação: execuções começam e terminam no próprio aplicativo Sellora.";
const MUTATING_METHODS = new Set([
  "chat.send", "chat.abort", "agents.create", "agents.update", "agents.delete", "agents.files.set",
  "config.set", "config.patch", "exec.approvals.set", "exec.approval.resolve", "cron.add", "cron.run",
  "cron.remove", "sessions.patch", "sessions.reset", "agents.message", "agents.handoff",
]);
const SUPPORTED_METHODS = [
  "agents.list", "sessions.list", "sessions.preview", "chat.history", "agent.wait", "status", "config.get",
  "agents.files.get", "exec.approvals.get", "skills.status", "models.list", "cron.list", "wake",
];

const sessionKeyFor = (agentId) => `agent:${agentId}:${MAIN_KEY}`;
const str = (value, fallback = "") => (typeof value === "string" ? value : fallback);
const timeOf = (iso) => {
  const value = Date.parse(str(iso));
  return Number.isFinite(value) ? value : Date.now();
};

function createState() {
  return {
    /** agentId -> registro vindo do bridge */
    agents: new Map(),
    /** agentId -> { runId, business, task, startedAt } da execução que o escritório mostra como ativa */
    active: new Map(),
    /** runId -> linhas do histórico (fases reais com horário) */
    history: new Map(),
    /** chaves de eventos já aplicados (deduplicação) */
    seen: new Set(),
    seq: 0,
    bridge: { connected: false, lastEventAt: null, lastError: null },
  };
}

function frame(state, event, payload) {
  return { type: "event", event, seq: state.seq++, payload };
}

function pushHistory(state, runId, at, text) {
  const list = state.history.get(runId) ?? [];
  if (list.at(-1)?.text !== text) list.push({ at, text });
  state.history.set(runId, list.slice(-40));
  if (state.history.size > 50) state.history.delete(state.history.keys().next().value);
}

function remember(state, key) {
  if (state.seen.has(key)) return false;
  state.seen.add(key);
  if (state.seen.size > 2000) state.seen.delete(state.seen.values().next().value);
  return true;
}

function statusText(business, text) {
  return business ? `${business} · ${text}` : text;
}

function presenceFrame(state) {
  const now = Date.now();
  const byAgent = [...state.agents.keys()].map((agentId) => {
    const run = state.active.get(agentId);
    return { agentId, recent: run ? [{ key: sessionKeyFor(agentId), updatedAt: now }] : [] };
  });
  return frame(state, "presence", {
    sessions: { recent: byAgent.flatMap((entry) => entry.recent), byAgent },
  });
}

function lifecycle(state, agentId, runId, phase, at) {
  return frame(state, "agent", {
    runId, sessionKey: sessionKeyFor(agentId), stream: "lifecycle", data: { phase, startedAt: timeOf(at) },
  });
}

function assistant(state, agentId, runId, text) {
  return frame(state, "agent", { runId, sessionKey: sessionKeyFor(agentId), stream: "assistant", data: { text } });
}

/** Inicia (ou atualiza o texto de) uma execução real. */
function startOrProgress(state, agentId, run, phase) {
  const frames = [];
  const current = state.active.get(agentId);
  if (!current || current.runId !== run.runId) {
    if (current) frames.push(lifecycle(state, agentId, current.runId, "end", new Date().toISOString()));
    state.active.set(agentId, { runId: run.runId, business: run.business, task: run.text, startedAt: run.at });
    frames.push(lifecycle(state, agentId, run.runId, "start", run.at));
  } else if (phase === "start") {
    return frames;
  } else {
    current.task = run.text;
  }
  pushHistory(state, run.runId, run.at, run.text);
  frames.push(assistant(state, agentId, run.runId, statusText(run.business, run.text)));
  return frames;
}

function finish(state, agentId, run, phase) {
  const frames = [];
  const current = state.active.get(agentId);
  pushHistory(state, run.runId, run.at, phase === "error" ? `Falhou: ${run.text}` : run.text);
  if (!current || current.runId !== run.runId) {
    // Execução que terminou sem o escritório ter visto o início (ex.: adaptador reconectou): só registra.
    return frames;
  }
  state.active.delete(agentId);
  const summary = phase === "error" ? `Falhou: ${run.text}` : `Concluído, aguardando revisão humana: ${run.text}`;
  const text = statusText(run.business, summary);
  if (phase === "error") {
    // Só o lifecycle: um `chat` de erro (ou texto novo do assistente) faria o Claw3D tratar a execução
    // como respondida e ignorar o estado "error". O motivo fica no histórico (chat.history/preview).
    frames.push(lifecycle(state, agentId, run.runId, "error", run.at));
    return frames;
  }
  // Fim normal: o `chat` final fecha a execução na hora (só com o lifecycle o Claw3D espera um temporizador).
  frames.push(frame(state, "chat", {
    runId: run.runId, sessionKey: sessionKeyFor(agentId), state: "final", stopReason: "end_turn",
    message: { role: "assistant", content: text },
  }));
  frames.push(lifecycle(state, agentId, run.runId, "end", run.at));
  return frames;
}

function normalizeAgent(agent) {
  if (!agent || typeof agent !== "object" || !str(agent.id)) return null;
  return {
    id: str(agent.id), name: str(agent.name, agent.id), role: str(agent.role), type: str(agent.type, "worker"),
    runtime: str(agent.runtime), status: str(agent.status, "idle"), currentRun: agent.currentRun ?? null,
    lastRun: agent.lastRun ?? null, recent: Array.isArray(agent.recent) ? agent.recent : [],
  };
}

/**
 * Aplica um evento SSE do bridge. Retorna os frames a transmitir ao Claw3D.
 * `presence` traz o registro completo: serve de retrato inicial e de correção após reconexão.
 */
function applyBridgeEvent(state, eventName, data) {
  state.bridge.lastEventAt = new Date().toISOString();
  if (eventName === "heartbeat") return [];
  if (eventName === "presence") {
    const frames = [];
    const agents = (Array.isArray(data?.agents) ? data.agents : []).map(normalizeAgent).filter(Boolean);
    const ids = new Set(agents.map((agent) => agent.id));
    for (const agent of agents) {
      state.agents.set(agent.id, agent);
      for (const run of [...agent.recent].reverse()) {
        for (const event of Array.isArray(run?.events) ? run.events : []) pushHistory(state, str(run.runId), str(event.at), str(event.phase));
      }
      const live = agent.currentRun && agent.currentRun.status === "running" ? agent.currentRun : null;
      const active = state.active.get(agent.id);
      if (live) {
        frames.push(...startOrProgress(state, agent.id, {
          runId: str(live.runId), business: str(live.business), text: str(live.task), at: str(live.updatedAt) || str(live.startedAt),
        }, "progress"));
      } else if (active) {
        // A execução que estava ativa já terminou: usa o registro para saber como.
        const ended = agent.recent.find((run) => run && run.runId === active.runId);
        const failed = ended && (ended.status === "failed" || ended.status === "cancelled");
        frames.push(...finish(state, agent.id, {
          runId: active.runId, business: active.business, text: str(ended?.error) || str(ended?.task) || active.task,
          at: str(ended?.updatedAt) || new Date().toISOString(),
        }, failed ? "error" : "end"));
      }
    }
    for (const id of [...state.agents.keys()]) if (!ids.has(id)) { state.agents.delete(id); state.active.delete(id); }
    frames.push(presenceFrame(state));
    return frames;
  }
  if (eventName !== "agent") return [];
  const agentId = str(data?.agentId);
  const runId = str(data?.runId);
  const phase = str(data?.phase);
  if (!agentId || !runId || !["start", "progress", "end", "error"].includes(phase)) return [];
  if (!state.agents.has(agentId)) return [];
  const run = { runId, business: str(data.business), text: str(data.text), at: str(data.at) || new Date().toISOString() };
  if (!remember(state, `${runId}|${phase}|${run.text}`)) return [];
  const agent = state.agents.get(agentId);
  if (phase === "start" || phase === "progress") {
    agent.status = "running";
    return [...startOrProgress(state, agentId, run, phase), presenceFrame(state)];
  }
  agent.status = phase === "error" ? "failed" : "waiting_approval";
  agent.lastRun = { runId, business: run.business, task: run.text, siteId: data.siteId ?? null, leadId: data.leadId ?? null };
  return [...finish(state, agentId, run, phase), presenceFrame(state)];
}

function agentList(state) {
  return [...state.agents.values()].map((agent) => ({
    id: agent.id, name: agent.name, workspace: `sellora://agents/${agent.id}`, role: agent.role,
    identity: { name: agent.name, emoji: "🛠️" },
  }));
}

function messagesFor(state, agentId) {
  const agent = state.agents.get(agentId);
  if (!agent) return [];
  const active = state.active.get(agentId);
  const run = active ?? (agent.lastRun ? { runId: agent.lastRun.runId, business: agent.lastRun.business } : null);
  if (!run) return [];
  const lines = state.history.get(run.runId) ?? [];
  // O pedido real do administrador (gerar a demo) abre a conversa. Enquanto a execução está ativa ele é a
  // última mensagem: o Claw3D trata "última mensagem do assistente" como execução encerrada.
  const request = {
    role: "user", content: `Gerar demo V6${run.business ? `: ${run.business}` : ""}`,
    timestamp: timeOf(active?.startedAt ?? lines[0]?.at),
  };
  if (active) return [request];
  return [request, ...lines.map((line) => ({
    role: "assistant", content: statusText(run.business, line.text), timestamp: timeOf(line.at),
  }))];
}

const ok = (id, payload) => ({ type: "res", id, ok: true, payload: payload ?? {} });
const fail = (id, code, message) => ({ type: "res", id, ok: false, error: { code, message } });
const agentFromSession = (key) => (str(key).startsWith("agent:") ? str(key).split(":")[1] : "");

function handleMethod(state, method, params, id) {
  const p = params && typeof params === "object" ? params : {};
  if (MUTATING_METHODS.has(method)) return fail(id, "read_only", READ_ONLY_MESSAGE);
  const defaultId = state.agents.keys().next().value ?? "";
  switch (method) {
    case "agents.list":
      return ok(id, { defaultId, mainKey: MAIN_KEY, agents: agentList(state) });
    case "sessions.list":
      return ok(id, {
        sessions: [...state.agents.values()].map((agent) => ({
          key: sessionKeyFor(agent.id), agentId: agent.id, updatedAt: state.active.has(agent.id) ? Date.now() : null,
          displayName: "Execuções reais", origin: { label: agent.name, provider: "sellora" }, model: agent.runtime, modelProvider: "sellora",
        })),
      });
    case "sessions.preview": {
      const keys = Array.isArray(p.keys) ? p.keys : [];
      const limit = typeof p.limit === "number" ? p.limit : 8;
      return ok(id, {
        ts: Date.now(),
        previews: keys.map((key) => {
          const items = messagesFor(state, agentFromSession(key)).slice(-limit).map((m) => ({ role: m.role, text: m.content.slice(0, 240), timestamp: m.timestamp }));
          return { key, status: items.length ? "ok" : "empty", items };
        }),
      });
    }
    case "chat.history":
      return ok(id, { sessionKey: str(p.sessionKey), messages: messagesFor(state, agentFromSession(p.sessionKey)) });
    case "agent.wait":
      return ok(id, { status: [...state.active.values()].some((run) => run.runId === p.runId) ? "running" : "done" });
    case "status":
      return ok(id, presenceFrame(state).payload);
    case "config.get":
      return ok(id, { config: { gateway: { reload: { mode: "hot" } } }, hash: "sellora", exists: true, path: "sellora://config" });
    case "agents.files.get":
      return ok(id, { file: { missing: true } });
    case "exec.approvals.get":
      return ok(id, { path: "", exists: true, hash: "sellora", file: { version: 1, defaults: { security: "deny", ask: "always", autoAllowSkills: false }, agents: {} } });
    case "skills.status":
      return ok(id, skillsReport());
    case "models.list":
      return ok(id, { models: [...new Set([...state.agents.values()].map((agent) => agent.runtime).filter(Boolean))].map((runtime) => ({ id: runtime, name: runtime, provider: "sellora" })) });
    case "cron.list":
      return ok(id, { jobs: [] });
    case "wake":
      return ok(id, { ok: true });
    default:
      // Código padrão do protocolo: o Claw3D trata como "recurso ausente" e segue sem mostrar erro (ex.: tasks.list).
      return fail(id, "METHOD_NOT_FOUND", `unknown method: ${method} (não disponível na Cloud 3D da Sellora)`);
  }
}

function helloPayload(state) {
  const agents = [...state.agents.values()];
  return {
    type: "hello-ok", protocol: 3, adapterType: HELLO_ADAPTER_TYPE,
    features: { methods: SUPPORTED_METHODS, events: ["agent", "presence", "heartbeat"] },
    snapshot: {
      health: { agents: agents.map((agent, index) => ({ agentId: agent.id, name: agent.name, isDefault: index === 0 })), defaultAgentId: agents[0]?.id ?? "" },
      sessionDefaults: { mainKey: MAIN_KEY },
    },
    auth: { role: "operator", scopes: ["operator.read"] },
    policy: { tickIntervalMs: 30000 },
  };
}

/** Frames que um cliente recém-conectado precisa para mostrar execuções já em andamento. */
function replayFrames(state) {
  const frames = [];
  for (const [agentId, run] of state.active) {
    frames.push(lifecycle(state, agentId, run.runId, "start", run.startedAt));
    frames.push(assistant(state, agentId, run.runId, statusText(run.business, run.task)));
  }
  frames.push(presenceFrame(state));
  return frames;
}

/** Parser incremental de text/event-stream. */
function createSseParser(onEvent) {
  let buffer = "";
  return (chunk) => {
    buffer += chunk;
    let index;
    while ((index = buffer.search(/\r?\n\r?\n/)) >= 0) {
      const block = buffer.slice(0, index);
      buffer = buffer.slice(index).replace(/^\r?\n\r?\n/, "");
      let event = "message";
      const data = [];
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
      }
      if (!data.length) continue;
      try { onEvent(event, JSON.parse(data.join("\n"))); } catch { /* bloco inválido: ignora */ }
    }
  };
}

/**
 * Skill "task-manager" do Claw3D (habilita o Kanban). Aqui ela não instala nada nos agentes: o próprio
 * adaptador alimenta o quadro com as execuções reais do gerador (ver taskBoardStore).
 */
const EMPTY_REQUIREMENTS = { bins: [], anyBins: [], env: [], config: [], os: [] };
function skillsReport() {
  return {
    workspaceDir: "sellora://agents", managedSkillsDir: "sellora://skills",
    skills: [{
      name: "task-manager", skillKey: "task-manager", description: "Quadro Kanban com as execuções reais dos agentes da Sellora.",
      source: "sellora", bundled: true, filePath: "sellora://skills/task-manager", baseDir: "sellora://skills/task-manager", emoji: "📋",
      always: true, disabled: false, blockedByAllowlist: false, eligible: true,
      requirements: EMPTY_REQUIREMENTS, missing: EMPTY_REQUIREMENTS, configChecks: [], install: [],
    }],
  };
}

const TASK_PREFIX = "sellora-run-";
const RUN_TO_COLUMN = { running: "in_progress", waiting_approval: "review", failed: "blocked", cancelled: "blocked", completed: "done", queued: "todo" };
const RUN_LABEL = { running: "Em execução", waiting_approval: "Pronta, aguardando sua aprovação na Sellora", failed: "Falhou", cancelled: "Interrompida (o aplicativo foi fechado durante a geração)", completed: "Concluída", queued: "Na fila" };

/** Cartão do Kanban para uma execução real (id estável por execução: o quadro é uma visão, não um cadastro). */
function runToTask(run, agentId) {
  const status = RUN_TO_COLUMN[run.status] ?? "todo";
  const events = Array.isArray(run.events) ? run.events : [];
  const created = str(run.startedAt) || str(events[0]?.at) || str(run.updatedAt) || new Date(0).toISOString();
  const updated = str(run.updatedAt) || str(run.finishedAt) || created;
  const lines = [
    `${RUN_LABEL[run.status] ?? run.status}.`,
    run.status === "running" ? `Etapa atual: ${str(run.task)}` : str(run.task) ? `Última etapa: ${str(run.task)}` : "",
    run.error ? `Erro: ${str(run.error)}` : "",
    run.siteId ? `Demo: /sites/${run.siteId}/index.html` : "",
    "Somente leitura: aprove, recuse ou gere de novo pela Sellora (Leads → Demos).",
  ].filter(Boolean);
  return {
    id: `${TASK_PREFIX}${str(run.runId)}`, title: `${str(run.business) || "Estabelecimento"} · demo ${str(run.generator) === "v5" ? "v5" : "V6"}`,
    description: lines.join(String.fromCharCode(10)), status, source: "openclaw_event", sourceEventId: str(run.runId) || null,
    assignedAgentId: agentId, createdAt: created, updatedAt: updated, playbookJobId: null, runId: str(run.runId) || null,
    channel: "sellora", externalThreadId: run.leadId ? str(run.leadId) : null, lastActivityAt: updated,
    notes: events.slice(-12).map((event) => `${str(event.at).slice(11, 16)} ${str(event.phase)}`),
    isArchived: false, isInferred: false,
    history: [{ at: created, type: "created", note: "Execução registrada pelo gerador da Sellora.", fromStatus: null, toStatus: "in_progress" }]
      .concat(status === "in_progress" ? [] : [{ at: updated, type: "status_changed", note: RUN_LABEL[run.status] ?? null, fromStatus: "in_progress", toStatus: status }]),
  };
}

/**
 * Junta as execuções reais (do registro do bridge) com o arquivo atual do Kanban. Cartões criados à mão no
 * Claw3D são preservados; os cartões da Sellora são regravados a partir das execuções (fonte da verdade).
 */
function taskBoardStore(state, existing) {
  const manual = (Array.isArray(existing?.tasks) ? existing.tasks : []).filter((task) => task && !String(task.id ?? "").startsWith(TASK_PREFIX));
  const runs = new Map();
  for (const agent of state.agents.values()) {
    for (const run of [...(agent.recent ?? [])].reverse()) if (run?.runId) runs.set(run.runId, { run, agentId: agent.id });
    if (agent.currentRun?.runId) runs.set(agent.currentRun.runId, { run: agent.currentRun, agentId: agent.id });
  }
  for (const [agentId, active] of state.active) {
    const known = runs.get(active.runId)?.run ?? {};
    runs.set(active.runId, { agentId, run: { ...known, runId: active.runId, status: "running", business: active.business, task: active.task, startedAt: known.startedAt ?? active.startedAt, updatedAt: new Date().toISOString(), events: (state.history.get(active.runId) ?? []).map((line) => ({ at: line.at, phase: line.text })) } });
  }
  const tasks = [...runs.values()].map(({ run, agentId }) => runToTask(run, agentId));
  const all = [...tasks, ...manual];
  const updatedAt = all.reduce((latest, task) => (str(task.updatedAt) > latest ? str(task.updatedAt) : latest), new Date(0).toISOString());
  return { schemaVersion: 1, updatedAt, tasks: all };
}

module.exports = {
  MAIN_KEY, READ_ONLY_MESSAGE, SUPPORTED_METHODS, sessionKeyFor, createState, applyBridgeEvent, handleMethod,
  helloPayload, replayFrames, createSseParser, skillsReport, runToTask, taskBoardStore, TASK_PREFIX,
};
