"use strict";

/**
 * Núcleo do Sellora Gateway Adapter (sem rede, testável).
 *
 * Traduz os eventos do Sellora Agent Bridge (`/api/agents/events`: presence, agent, heartbeat)
 * para o protocolo de gateway que o Claw3D já consome (frames `event` "agent" com
 * stream "lifecycle"/"assistant" e "presence"), e responde aos métodos de leitura do Claw3D.
 *
 * Regras: só agentes declarados pelo bridge; consultas locais de texto não executam tarefas.
 * Métodos que alteram execuções são recusados; eventos repetidos são deduplicados.
 */

const MAIN_KEY = "main";
const { randomUUID } = require("node:crypto");
// Perfil anunciado no handshake: o Claw3D decide as capacidades da interface por ele. "hermes" habilita skills
// (Kanban/task-manager) e coincide com o perfil configurado pelo launcher (conexão por token).
const HELLO_ADAPTER_TYPE = process.env.SELLORA_HELLO_ADAPTER || "hermes";
const READ_ONLY_MESSAGE =
  "O chat permite consultas locais. Para iniciar ou alterar tarefas, use os controles do aplicativo Sellora.";
const MUTATING_METHODS = new Set([
  "chat.abort", "agents.create", "agents.delete",
  "config.set", "config.patch", "exec.approvals.set", "exec.approval.resolve", "cron.add", "cron.run",
  "cron.remove", "agents.message", "agents.handoff",
]);
const SUPPORTED_METHODS = [
  "agents.list", "sessions.list", "sessions.preview", "sessions.patch", "sessions.reset", "chat.history", "chat.send", "agent.wait", "status", "config.get",
  "agents.files.get", "agents.files.set", "agents.update", "exec.approvals.get", "skills.status", "models.list", "cron.list", "wake",
];

const sessionKeyFor = (agentId) => `agent:${agentId}:${MAIN_KEY}`;

/**
 * Identidade de cada agente real no escritório. O "Coolify Deploy Agent" representa o serviço Coolify:
 * aparece trabalhando só quando o bridge informa uma publicação real (preparando → publicando → confirmado).
 */
const COOLIFY_AGENT = "coolify-deploy";
const AGENT_PROFILE = {
  "gerador-de-demos": { emoji: "🎨", request: "Gerar demo V6", done: "Concluído, aguardando revisão humana", completes: false },
  prospeccao: { emoji: "🎯", request: "Pesquisar estabelecimentos", done: "Concluído, aguardando revisão humana", completes: true },
  [COOLIFY_AGENT]: { emoji: "🚀", request: "Publicar demo", done: "Publicação confirmada (conteúdo conferido no endereço)", completes: true },
  "revisor-de-demos": { emoji: "🔎", request: "Acompanhar QA da demo", done: "QA encerrado; confira as pendências antes de aprovar", completes: false },
};
const profileOf = (agentId) => AGENT_PROFILE[agentId] ?? AGENT_PROFILE["gerador-de-demos"];
/** Texto do balão: no agente do Coolify, a etapa visual (Preparando/Publicando) vem antes da mensagem real. */
const stagedText = (agentId, stage, text) => agentId !== COOLIFY_AGENT ? text : `${stage === "deploying" ? "Publicando" : "Preparando"}: ${text}`;
const str = (value, fallback = "") => (typeof value === "string" ? value : fallback);
const timeOf = (iso) => {
  const value = Date.parse(str(iso));
  return Number.isFinite(value) ? value : Date.now();
};

function createState() {
  return {
    /** agentId -> registro vindo do bridge */
    agents: new Map(),
    chats: new Map(),
    chatOnly: new Set(),
    chatRequests: new Map(),
    /** agentId -> { runId, business, task, startedAt } da execução que o escritório mostra como ativa */
    active: new Map(),
    /** runId -> linhas do histórico (fases reais com horário) */
    history: new Map(),
    /** chaves de eventos já aplicados (deduplicação) */
    seen: new Set(),
    /** runId -> execução que terminou durante esta sessão (o retrato inicial não a conhece; o Kanban precisa dela) */
    finished: new Map(),
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
    state.active.set(agentId, { runId: run.runId, business: run.business, task: run.text, startedAt: run.at, generator: run.generator ?? "" });
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
  const summary = phase === "error" ? `Falhou: ${run.text}` : `${profileOf(agentId).done}: ${run.text}`;
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
          runId: str(live.runId), business: str(live.business), text: stagedText(agent.id, str(live.stage), str(live.task)), at: str(live.updatedAt) || str(live.startedAt), generator: str(live.generator),
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
  const run = { runId, business: str(data.business), text: phase === "start" || phase === "progress" ? stagedText(agentId, str(data.stage), str(data.text)) : str(data.text), at: str(data.at) || new Date().toISOString(), generator: str(data.generator) };
  if (!remember(state, `${runId}|${phase}|${run.text}`)) return [];
  const agent = state.agents.get(agentId);
  if (phase === "start" || phase === "progress") {
    agent.status = "running";
    return [...startOrProgress(state, agentId, run, phase), presenceFrame(state)];
  }
  const reviewStatus = agentId === "revisor-de-demos" && ["completed", "waiting_approval", "queued", "paused", "failed", "cancelled"].includes(data.reviewStatus) ? data.reviewStatus : null;
  agent.status = reviewStatus ?? (phase === "error" ? "failed" : "waiting_approval");
  agent.lastRun = { runId, business: run.business, task: run.text, siteId: data.siteId ?? null, leadId: data.leadId ?? null };
  const startedAt = state.active.get(agentId)?.runId === runId ? state.active.get(agentId).startedAt : null;
  state.finished.set(runId, {
    agentId, run: {
      runId, generator: str(data.generator), business: run.business, task: run.text, error: phase === "error" ? run.text : null,
      status: reviewStatus ?? (phase === "error" ? (/interromp/i.test(run.text) ? "cancelled" : "failed") : profileOf(agentId).completes ? "completed" : "waiting_approval"),
      startedAt, updatedAt: run.at, siteId: data.siteId ?? null, leadId: data.leadId ?? null,
      events: (state.history.get(runId) ?? []).map((line) => ({ at: line.at, phase: line.text })),
    },
  });
  if (state.finished.size > 100) state.finished.delete(state.finished.keys().next().value);
  return [...finish(state, agentId, run, phase), presenceFrame(state)];
}

// Sob o personagem o Claw3D mostra o nome numa plaquinha e o `role` como subtítulo. O subtítulo vai vazio:
// o escritório mostra só o nome; a descrição completa do agente fica no painel da Sellora.
// Nome de exibição: única fonte é o `Name` do IDENTITY.md efetivo (editável pelo Agent Editor); o nome do bridge é o
// rótulo interno do serviço e só aparece se o perfil não existir. O id nunca muda. O emoji também vem do IDENTITY.md.
function displayName(agent, profiles) {
  return profiles?.nameOf(agent.id) || agent.name;
}

function agentList(state, profiles) {
  return [...state.agents.values()].map((agent) => ({
    id: agent.id, name: displayName(agent, profiles), workspace: `sellora://agents/${agent.id}`, role: "",
    identity: { name: displayName(agent, profiles), emoji: profiles?.emojiOf(agent.id) || profileOf(agent.id).emoji },
  }));
}

function runMessagesFor(state, agentId) {
  const agent = state.agents.get(agentId);
  if (!agent) return [];
  const active = state.active.get(agentId);
  const run = active ?? (agent.lastRun ? { runId: agent.lastRun.runId, business: agent.lastRun.business } : null);
  if (!run) return [];
  const lines = state.history.get(run.runId) ?? [];
  // O pedido real do administrador (gerar a demo) abre a conversa. Enquanto a execução está ativa ele é a
  // última mensagem: o Claw3D trata "última mensagem do assistente" como execução encerrada.
  const request = {
    role: "user", content: `${profileOf(agentId).request}${run.business ? `: ${run.business}` : ""}`,
    timestamp: timeOf(active?.startedAt ?? lines[0]?.at),
  };
  if (active) return [request];
  return [request, ...lines.map((line) => ({
    role: "assistant", content: statusText(run.business, line.text), timestamp: timeOf(line.at),
  }))];
}

function messagesFor(state, agentId) {
  return [...(state.chatOnly.has(agentId) ? [] : runMessagesFor(state, agentId)), ...(state.chats.get(agentId) ?? [])];
}

const CHAT_HELP = "Consultas locais, sem IA: status (o que está fazendo), histórico (últimas execuções), onde revisar e ajuda. Para iniciar, pausar, cancelar ou publicar, use os controles da Sellora. Nenhuma ação foi executada por este chat.";
const STATUS_LABELS = { running: "Em andamento", queued: "Na fila", paused: "Pausada", completed: "Concluída", waiting_approval: "Aguardando revisão", failed: "Falhou", cancelled: "Cancelada", idle: "Disponível", offline: "Desconectado" };

function localReply(state, agentId, message) {
  const text = message.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (/^(ajuda|help|comandos|oi|ola)$/.test(text)) return CHAT_HELP;
  if (/^(onde revisar|revisar|ver entrega|entregas)$/.test(text)) return "Abra Cloud 3D → Ver, testar e aprovar. Selecione a demo para testar em computador/celular, aprovar ou registrar ajustes. Para resultados da Prospecção, abra Leads no CRM.";
  const status = /^(status|situacao|andamento|o?\s*que (voce |vc )?(esta |ta )?fazendo|historico|ultimas execucoes)$/.test(text);
  if (!status) return CHAT_HELP;
  if (!state.bridge.connected) return "O bridge está desconectado. Não consigo confirmar o status atual. Aguarde a reconexão; os dados anteriores podem estar desatualizados.";
  const agent = state.agents.get(agentId);
  const describe = (run) => `${STATUS_LABELS[run.status] ?? "Estado não informado"} · ${run.business || "Sem estabelecimento informado"} · ${run.task || "Etapa não informada"}${run.error ? ` · Erro: ${run.error}` : ""}`;
  if (/historico|ultimas execucoes/.test(text)) {
    const runs = [...new Map([agent.currentRun, agent.lastRun, ...agent.recent].filter(Boolean).map((run) => [run.runId, run])).values()].slice(0, 5);
    return runs.length ? `Últimas execuções registradas:\n${runs.map(describe).join("\n")}` : "Nenhuma execução registrada para este agente.";
  }
  const active = state.active.get(agentId);
  if (active) return `Em andamento · ${statusText(active.business, active.task)}. Consulta local, sem IA.`;
  const last = agent.lastRun ?? agent.recent[0];
  return `Nenhuma tarefa em execução neste momento.${last ? ` Última execução: ${describe(last)}.` : " Nenhuma execução registrada."}`;
}

const ok = (id, payload) => ({ type: "res", id, ok: true, payload: payload ?? {} });
const fail = (id, code, message) => ({ type: "res", id, ok: false, error: { code, message } });
const agentFromSession = (key) => (str(key).startsWith("agent:") ? str(key).split(":")[1] : "");

/**
 * Responde a um método do Claw3D. `options.profiles` (sellora-agent-profiles.cjs) habilita as abas do Agent Editor:
 * sem ele, os arquivos aparecem ausentes e `agents.files.set` é recusado como antes.
 */
function handleMethod(state, method, params, id, options = {}) {
  const p = params && typeof params === "object" ? params : {};
  const profiles = options.profiles ?? null;
  if (MUTATING_METHODS.has(method)) return fail(id, "read_only", READ_ONLY_MESSAGE);
  const defaultId = state.agents.keys().next().value ?? "";
  switch (method) {
    case "sessions.patch":
    case "sessions.reset": {
      const agentId = agentFromSession(p.key);
      if (!state.agents.has(agentId) || p.key !== sessionKeyFor(agentId)) return fail(id, "unknown_agent", "Selecione a sessão principal de um agente registrado na Sellora.");
      if (method === "sessions.reset") {
        if (Object.keys(p).some((name) => name !== "key")) return fail(id, "invalid_request", "A limpeza aceita apenas a chave da conversa local.");
        state.chats.delete(agentId);
        state.chatOnly.add(agentId);
        for (const key of state.chatRequests.keys()) if (key.startsWith(`${agentId}:`)) state.chatRequests.delete(key);
        return ok(id, { ok: true, key: p.key });
      }
      // Compatibilidade com a preparação automática do Claw3D. Não configura nenhum modelo,
      // processo ou permissão da Sellora: a conversa continua sendo uma consulta local.
      const fields = new Set(["key", "model", "thinkingLevel", "execHost", "execSecurity", "execAsk"]);
      if (Object.entries(p).some(([name, value]) => !fields.has(name) || (value !== null && (typeof value !== "string" || value.length > 200)))) return fail(id, "invalid_request", "Opções de conversa inválidas.");
      if ((p.execSecurity != null && p.execSecurity !== "deny") || (p.execAsk != null && p.execAsk !== "always")) return fail(id, "read_only", "Consultas locais não permitem liberar execução de comandos.");
      return ok(id, { ok: true, key: p.key, applied: false, resolved: { modelProvider: "sellora", model: "local-status" }, entry: { thinkingLevel: "off" } });
    }
    case "chat.send": {
      const agentId = agentFromSession(p.sessionKey);
      if (!state.agents.has(agentId) || p.sessionKey !== sessionKeyFor(agentId)) return fail(id, "unknown_agent", "Selecione a sessão principal de um agente registrado na Sellora.");
      const message = str(p.message).trim();
      if (!message || message.length > 2000 || (p.attachments && (!Array.isArray(p.attachments) || p.attachments.length))) return fail(id, "invalid_request", "Envie somente texto, com até 2000 caracteres.");
      const key = typeof p.idempotencyKey === "string" && p.idempotencyKey.length <= 200 ? `${agentId}:${p.idempotencyKey}` : null;
      if (key && state.chatRequests.has(key)) {
        const cached = state.chatRequests.get(key);
        return ok(id, cached);
      }
      const reply = localReply(state, agentId, message);
      const runId = key ? p.idempotencyKey : randomUUID();
      const timestamp = Math.max(Date.now(), (state.chats.get(agentId)?.at(-1)?.timestamp ?? 0) + 1);
      state.chats.set(agentId, [...(state.chats.get(agentId) ?? []), { role: "user", content: message, timestamp, runId }, { role: "assistant", content: reply, timestamp: timestamp + 1, runId }].slice(-40));
      // A consulta já terminou: o cliente suporta resposta imediata e conclui a conversa
      // no mesmo fluxo do RPC. Anunciar streaming criaria corrida com o estado otimista da UI.
      const payload = { status: "completed", runId, text: reply, reply };
      if (key) {
        state.chatRequests.set(key, payload);
        if (state.chatRequests.size > 100) state.chatRequests.delete(state.chatRequests.keys().next().value);
      }
      return ok(id, payload);
    }
    case "agents.list":
      return ok(id, { defaultId, mainKey: MAIN_KEY, agents: agentList(state, profiles) });
    case "sessions.list":
      return ok(id, {
        sessions: [...state.agents.values()].map((agent) => ({
          key: sessionKeyFor(agent.id), agentId: agent.id, updatedAt: state.active.has(agent.id) ? Date.now() : state.chats.get(agent.id)?.at(-1)?.timestamp ?? null,
          displayName: "Execuções reais", origin: { label: displayName(agent, profiles), provider: "sellora" }, model: agent.runtime, modelProvider: "sellora",
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
    case "agents.files.get": {
      const agentId = str(p.agentId);
      if (!profiles || !state.agents.has(agentId)) return ok(id, { file: { missing: true } });
      try {
        return ok(id, { workspace: `sellora://agents/${agentId}`, file: profiles.get(agentId, str(p.name)) });
      } catch (error) { return fail(id, error.code || "invalid_request", error.message); }
    }
    case "agents.files.set": {
      // Perfis são documentação exibida no editor: não iniciam, alteram nem configuram execuções da Sellora.
      if (!profiles) return fail(id, "read_only", READ_ONLY_MESSAGE);
      const agentId = str(p.agentId);
      try {
        const saved = profiles.set(agentId, str(p.name), p.content);
        return ok(id, { ok: true, agentId, name: str(p.name), path: saved.path, changed: saved.changed });
      } catch (error) { return fail(id, error.code || "invalid_request", error.message); }
    }
    case "agents.update": {
      // Só o nome de exibição (o Claw3D chama depois de salvar o Identity). Modelo, workspace, ferramentas ou
      // qualquer outro campo continuam recusados: o agente representa um serviço configurado na Sellora.
      const extra = Object.keys(p).filter((key) => key !== "agentId" && key !== "name");
      const agentId = str(p.agentId);
      if (!profiles || extra.length || typeof p.name !== "string") return fail(id, "read_only", READ_ONLY_MESSAGE);
      if (!state.agents.has(agentId)) return fail(id, "unknown_agent", "Agente não registrado no Sellora Agent Bridge.");
      try {
        const renamed = profiles.rename(agentId, p.name);
        return ok(id, { ok: true, agentId, name: renamed.name });
      } catch (error) { return fail(id, error.code || "invalid_request", error.message); }
    }
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

function helloPayload(state, options = {}) {
  const agents = [...state.agents.values()];
  return {
    type: "hello-ok", protocol: 3, adapterType: HELLO_ADAPTER_TYPE,
    features: { methods: SUPPORTED_METHODS, events: ["agent", "presence", "heartbeat"] },
    snapshot: {
      health: { agents: agents.map((agent, index) => ({ agentId: agent.id, name: displayName(agent, options.profiles ?? null), isDefault: index === 0 })), defaultAgentId: agents[0]?.id ?? "" },
      sessionDefaults: { mainKey: MAIN_KEY },
    },
    auth: { role: "operator", scopes: ["operator.read"] },
    policy: { tickIntervalMs: 30000 },
  };
}

/** Presença atual: depois de renomear, faz os outros clientes conectados recarregarem a lista de agentes. */
function presenceFrames(state) {
  return [presenceFrame(state)];
}

/** Frames que um cliente recém-conectado precisa para mostrar execuções já em andamento. */
function replayFrames(state, chatBefore = Infinity) {
  const frames = [];
  for (const [agentId, messages] of state.chats) {
    const last = messages.at(-1);
    if (!state.agents.has(agentId) || state.active.has(agentId) || last?.role !== "assistant" || last.timestamp > chatBefore) continue;
    // O Office não solicita histórico de agentes ociosos ao recarregar. O final de consulta
    // reidrata a conversa pelo fluxo normal do Claw3D, sem inventar um lifecycle de trabalho.
    frames.push(frame(state, "chat", { runId: last.runId, sessionKey: sessionKeyFor(agentId), state: "final", stopReason: "end_turn", message: { role: "assistant", content: last.content } }));
  }
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
  const prospect = str(run.generator) === "osm";
  const publish = str(run.generator) === "coolify" || agentId === COOLIFY_AGENT;
  const events = Array.isArray(run.events) ? run.events : [];
  const created = str(run.startedAt) || str(events[0]?.at) || str(run.updatedAt) || new Date(0).toISOString();
  const updated = str(run.updatedAt) || str(run.finishedAt) || created;
  const lines = [
    publish && run.status === "completed" ? "Publicada e confirmada." : `${RUN_LABEL[run.status] ?? run.status}.`,
    run.status === "running" ? `Etapa atual: ${str(run.task)}` : str(run.task) ? `Última etapa: ${str(run.task)}` : "",
    run.error ? `Erro: ${str(run.error)}` : "",
    publish && run.url ? `Endereço: ${str(run.url)}` : run.siteId ? `Demo: /sites/${run.siteId}/index.html` : "",
    prospect
      ? "Somente leitura: revise e importe os resultados pela Sellora (Leads → Prospecção IA)."
      : publish
        ? "Somente leitura: publique, republique ou verifique pela Sellora (ficha do lead → Publicação da demo)."
        : "Somente leitura: aprove, recuse ou gere de novo pela Sellora (Leads → Demos).",
  ].filter(Boolean);
  return {
    id: `${TASK_PREFIX}${str(run.runId)}`, title: agentId === "revisor-de-demos" ? `Revisão QA · ${str(run.business) || "demo"}` : prospect ? `Prospecção · ${str(run.business) || "pesquisa"}` : publish ? `Publicação · ${str(run.business) || "demo"}` : `${str(run.business) || "Estabelecimento"} · demo ${str(run.generator) === "v5" ? "v5" : "V6"}`,
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
  for (const [runId, entry] of state.finished) runs.set(runId, { agentId: entry.agentId, run: { ...(runs.get(runId)?.run ?? {}), ...entry.run, generator: entry.run.generator || runs.get(runId)?.run?.generator } });
  for (const [agentId, active] of state.active) {
    const known = runs.get(active.runId)?.run ?? {};
    runs.set(active.runId, { agentId, run: { ...known, runId: active.runId, status: "running", generator: active.generator || known.generator || (agentId === "prospeccao" ? "osm" : agentId === COOLIFY_AGENT ? "coolify" : ""), business: active.business, task: active.task, startedAt: known.startedAt ?? active.startedAt, updatedAt: new Date().toISOString(), events: (state.history.get(active.runId) ?? []).map((line) => ({ at: line.at, phase: line.text })) } });
  }
  const tasks = [...runs.values()].map(({ run, agentId }) => runToTask(run, agentId));
  const all = [...tasks, ...manual];
  const updatedAt = all.reduce((latest, task) => (str(task.updatedAt) > latest ? str(task.updatedAt) : latest), new Date(0).toISOString());
  return { schemaVersion: 1, updatedAt, tasks: all };
}

module.exports = {
  MAIN_KEY, READ_ONLY_MESSAGE, SUPPORTED_METHODS, sessionKeyFor, createState, applyBridgeEvent, handleMethod,
  helloPayload, replayFrames, presenceFrames, createSseParser, skillsReport, runToTask, taskBoardStore, TASK_PREFIX,
};
