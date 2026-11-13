import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const core = require("./sellora-gateway-core.cjs");

type Frame = { type: string; event?: string; payload?: Record<string, unknown>; ok?: boolean; error?: { code: string } };
const agent = (currentRun: unknown = null, recent: unknown[] = []) => ({
  id: "gerador-de-demos", name: "Gerador de Demos", role: "Cria demos", type: "worker", runtime: "claude-code",
  status: currentRun ? "running" : "idle", currentRun, lastRun: null, recent,
});
const lifecycle = (frames: Frame[]) => frames.filter((f) => f.event === "agent" && (f.payload as { stream: string }).stream === "lifecycle")
  .map((f) => `${(f.payload as { runId: string }).runId}:${((f.payload as { data: { phase: string } }).data).phase}`);
const texts = (frames: Frame[]) => frames.filter((f) => f.event === "agent" && (f.payload as { stream: string }).stream === "assistant")
  .map((f) => ((f.payload as { data: { text: string } }).data).text);

describe("Sellora gateway adapter (núcleo)", () => {
  it("só conhece agentes declarados pelo bridge e ignora eventos de agentes desconhecidos", () => {
    const state = core.createState();
    expect(core.applyBridgeEvent(state, "agent", { agentId: "inventado", runId: "r1", phase: "start", text: "x" })).toEqual([]);
    core.applyBridgeEvent(state, "presence", { agents: [agent()] });
    const list = core.handleMethod(state, "agents.list", {}, "1") as Frame;
    expect((list.payload as { agents: { id: string }[] }).agents.map((a) => a.id)).toEqual(["gerador-de-demos"]);
  });

  it("traduz start → progress → end em lifecycle + texto da etapa, sem duplicar eventos repetidos", () => {
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", { agents: [agent()] });
    const base = { agentId: "gerador-de-demos", runId: "job-1", business: "Clínica Teste", at: "2026-11-12T23:00:00Z" };
    const start = core.applyBridgeEvent(state, "agent", { ...base, phase: "start", text: "Etapas 1–3" });
    expect(lifecycle(start)).toEqual(["job-1:start"]);
    expect(texts(start)).toEqual(["Clínica Teste · Etapas 1–3"]);
    expect(core.applyBridgeEvent(state, "agent", { ...base, phase: "start", text: "Etapas 1–3" })).toEqual([]);
    // Durante a execução o histórico termina no pedido (user): o Claw3D não pode concluir que acabou.
    const during = core.handleMethod(state, "chat.history", { sessionKey: "agent:gerador-de-demos:main" }, "h") as Frame;
    expect((during.payload as { messages: { role: string }[] }).messages.map((m) => m.role)).toEqual(["user"]);
    const progress = core.applyBridgeEvent(state, "agent", { ...base, phase: "progress", text: "Gerando imagem 1 de 3" });
    expect(lifecycle(progress)).toEqual([]);
    expect(texts(progress)).toEqual(["Clínica Teste · Gerando imagem 1 de 3"]);
    const end = core.applyBridgeEvent(state, "agent", { ...base, phase: "end", text: "Demo pronta para revisão", siteId: "s1" });
    expect(lifecycle(end)).toEqual(["job-1:end"]);
    expect(end.filter((f: Frame) => f.event === "chat").map((f: Frame) => (f.payload as { state: string }).state)).toEqual(["final"]);
    const final = end.find((f: Frame) => f.event === "chat")?.payload as { message: { content: string } };
    expect(final.message.content).toContain("aguardando revisão humana");
    const history = core.handleMethod(state, "chat.history", { sessionKey: "agent:gerador-de-demos:main" }, "2") as Frame;
    expect((history.payload as { messages: { content: string }[] }).messages.map((m) => m.content)).toEqual([
      "Gerar demo V6: Clínica Teste", "Clínica Teste · Etapas 1–3", "Clínica Teste · Gerando imagem 1 de 3", "Clínica Teste · Demo pronta para revisão",
    ]);
  });

  it("falha vira lifecycle error com o motivo", () => {
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", { agents: [agent()] });
    const base = { agentId: "gerador-de-demos", runId: "job-2", business: "Restaurante" };
    core.applyBridgeEvent(state, "agent", { ...base, phase: "start", text: "Etapas 1–3" });
    const error = core.applyBridgeEvent(state, "agent", { ...base, phase: "error", text: "Codex indisponível" });
    expect(lifecycle(error)).toEqual(["job-2:error"]);
    expect(texts(error)).toEqual([]);
    const history = core.handleMethod(state, "chat.history", { sessionKey: "agent:gerador-de-demos:main" }, "h") as Frame;
    expect((history.payload as { messages: { content: string }[] }).messages.at(-1)?.content).toBe("Restaurante · Falhou: Codex indisponível");
    // Sem `chat` de erro: ele fecharia a execução antes e o Claw3D ignoraria o estado "error".
    expect(error.filter((f: Frame) => f.event === "chat")).toEqual([]);
  });

  it("retrato (presence) após reconexão retoma a execução ativa e encerra a que terminou fora do ar", () => {
    const state = core.createState();
    const running = { runId: "job-3", status: "running", task: "Gerando imagem 2 de 3", business: "Barbearia", startedAt: "2026-11-12T23:00:00Z", updatedAt: "2026-11-12T23:01:00Z", events: [] };
    expect(lifecycle(core.applyBridgeEvent(state, "presence", { agents: [agent(running, [running])] }))).toEqual(["job-3:start"]);
    // Novo retrato idêntico não reinicia a execução.
    expect(lifecycle(core.applyBridgeEvent(state, "presence", { agents: [agent(running, [running])] }))).toEqual([]);
    const cancelled = { ...running, status: "cancelled", task: "Interrompido (o aplicativo foi fechado durante a geração)" };
    expect(lifecycle(core.applyBridgeEvent(state, "presence", { agents: [agent(null, [cancelled])] }))).toEqual(["job-3:error"]);
    expect(core.replayFrames(state).filter((f: Frame) => f.event === "agent")).toEqual([]);
  });

  it("replay entrega a execução em andamento a um cliente que conectou depois", () => {
    const state = core.createState();
    core.applyBridgeEvent(state, "presence", { agents: [agent()] });
    core.applyBridgeEvent(state, "agent", { agentId: "gerador-de-demos", runId: "job-4", phase: "start", text: "Etapas 1–3", business: "Clínica" });
    expect(lifecycle(core.replayFrames(state))).toEqual(["job-4:start"]);
  });

  it("recusa métodos que criariam, alterariam ou conversariam (somente observação)", () => {
    const state = core.createState();
    for (const method of ["chat.send", "agents.create", "agents.delete", "config.set", "cron.add", "agents.handoff"]) {
      const response = core.handleMethod(state, method, {}, "x") as Frame;
      expect(response.ok).toBe(false);
      expect(response.error?.code).toBe("read_only");
    }
    expect((core.handleMethod(state, "metodo.desconhecido", {}, "y") as Frame).error?.code).toBe("METHOD_NOT_FOUND");
  });

  it("parser SSE lida com blocos quebrados entre pedaços e CRLF", () => {
    const seen: [string, unknown][] = [];
    const parse = core.createSseParser((event: string, data: unknown) => seen.push([event, data]));
    parse("event: agent\ndata: {\"runId\":");
    parse("\"a\"}\n\nevent: heartbeat\r\ndata: {}\r\n\r\n: comentário\n\n");
    expect(seen).toEqual([["agent", { runId: "a" }], ["heartbeat", {}]]);
  });
});

describe("Kanban (skill task-manager) com execuções reais", () => {
  it("relata a skill task-manager pronta com todos os campos que o Claw3D lê", () => {
    const report = core.skillsReport();
    expect(report.workspaceDir).toBeTruthy();
    const skill = report.skills[0];
    expect(skill).toMatchObject({ skillKey: "task-manager", name: "task-manager", eligible: true, disabled: false, blockedByAllowlist: false });
    expect(skill.missing).toEqual({ bins: [], anyBins: [], env: [], config: [], os: [] });
    expect((core.handleMethod(core.createState(), "skills.status", {}, "s") as Frame).payload).toEqual(report);
  });

  it("cada execução vira um cartão na coluna certa e cartões manuais são preservados", () => {
    const state = core.createState();
    const runs = [
      { runId: "r-ok", status: "waiting_approval", business: "Clínica Teste", task: "Demo pronta para revisão", startedAt: "2026-11-12T23:00:00Z", updatedAt: "2026-11-12T23:04:00Z", events: [{ at: "2026-11-12T23:00:00Z", phase: "Etapas 1–3" }], siteId: "s1", leadId: "lead-1" },
      { runId: "r-fail", status: "failed", business: "Restaurante", task: "Geração interrompida", error: "Codex sem cota", updatedAt: "2026-11-12T22:00:00Z", events: [] },
      { runId: "r-cancel", status: "cancelled", business: "Barbearia", task: "Interrompido", updatedAt: "2026-11-12T21:00:00Z", events: [] },
    ];
    core.applyBridgeEvent(state, "presence", { agents: [agent(null, runs)] });
    core.applyBridgeEvent(state, "agent", { agentId: "gerador-de-demos", runId: "r-live", phase: "start", text: "Gerando imagem 1 de 3", business: "Pet Shop" });
    const manual = { id: "manual-1", title: "Ligar para o contador", status: "todo" };
    const store = core.taskBoardStore(state, { tasks: [manual, { id: "sellora-run-velho", title: "antigo" }] });
    const byId = Object.fromEntries(store.tasks.map((task: { id: string }) => [task.id, task]));
    expect(byId["sellora-run-r-ok"]).toMatchObject({ status: "review", title: "Clínica Teste · demo V6", assignedAgentId: "gerador-de-demos", runId: "r-ok", externalThreadId: "lead-1" });
    expect(byId["sellora-run-r-ok"].description).toContain("/sites/s1/index.html");
    expect(byId["sellora-run-r-fail"]).toMatchObject({ status: "blocked" });
    expect(byId["sellora-run-r-fail"].description).toContain("Codex sem cota");
    expect(byId["sellora-run-r-cancel"].status).toBe("blocked");
    expect(byId["sellora-run-r-live"]).toMatchObject({ status: "in_progress", title: "Pet Shop · demo V6" });
    expect(byId["manual-1"]).toEqual(manual);
    expect(byId["sellora-run-velho"]).toBeUndefined();
    expect(store.schemaVersion).toBe(1);
  });

  it("pesquisas da Prospecção viram cartões próprios (concluída → Done) do agente prospeccao", () => {
    const state = core.createState();
    const prospect = { id: "prospeccao", name: "Prospecção", role: "OpenStreetMap + regras", type: "worker", runtime: "openstreetmap", status: "idle", currentRun: null, lastRun: null,
      recent: [{ runId: "p1", status: "completed", generator: "osm", business: "Campinas/SP · todos os segmentos · 5 km", task: "Pesquisa concluída: 3 oportunidade(s) classificadas.", updatedAt: "2026-11-13T10:02:00Z", events: [] }] };
    core.applyBridgeEvent(state, "presence", { agents: [agent(), prospect] });
    const [card] = core.taskBoardStore(state, null).tasks;
    expect(card).toMatchObject({ id: "sellora-run-p1", status: "done", title: "Prospecção · Campinas/SP · todos os segmentos · 5 km", assignedAgentId: "prospeccao" });
    expect(card.description).toContain("Prospecção IA");
    const list = core.handleMethod(state, "agents.list", {}, "l") as Frame;
    expect((list.payload as { agents: { id: string }[] }).agents.map((a) => a.id)).toEqual(["gerador-de-demos", "prospeccao"]);
    // Só o nome sob o personagem: subtítulo (role) vazio no escritório.
    expect((list.payload as { agents: { role: string; name: string }[] }).agents.map((a) => [a.name, a.role])).toEqual([["Gerador de Demos", ""], ["Prospecção", ""]]);
  });

  it("execução que começa e termina durante a sessão continua no Kanban depois do fim", () => {
    const state = core.createState();
    const prospect = { id: "prospeccao", name: "Prospecção", role: "", type: "worker", runtime: "openstreetmap", status: "idle", currentRun: null, lastRun: null, recent: [] };
    core.applyBridgeEvent(state, "presence", { agents: [agent(), prospect] });
    const base = { agentId: "prospeccao", runId: "p-nova", business: "Valinhos/SP · todos os segmentos · 5 km", generator: "osm" };
    core.applyBridgeEvent(state, "agent", { ...base, phase: "start", text: "Buscando estabelecimentos", at: "2026-11-13T03:14:09Z" });
    expect(core.taskBoardStore(state, null).tasks.find((t: { id: string }) => t.id === "sellora-run-p-nova")).toMatchObject({ status: "in_progress", title: "Prospecção · Valinhos/SP · todos os segmentos · 5 km" });
    core.applyBridgeEvent(state, "agent", { ...base, phase: "end", text: "Pesquisa concluída: 10 oportunidade(s) classificadas.", at: "2026-11-13T03:14:56Z" });
    const card = core.taskBoardStore(state, null).tasks.find((t: { id: string }) => t.id === "sellora-run-p-nova");
    expect(card).toMatchObject({ status: "done", title: "Prospecção · Valinhos/SP · todos os segmentos · 5 km", assignedAgentId: "prospeccao" });
    const demo = { agentId: "gerador-de-demos", runId: "d-nova", business: "Pet Shop", generator: "v6" };
    core.applyBridgeEvent(state, "agent", { ...demo, phase: "start", text: "Etapas 1–3" });
    core.applyBridgeEvent(state, "agent", { ...demo, phase: "error", text: "Interrompido (o aplicativo foi fechado durante a geração)" });
    expect(core.taskBoardStore(state, null).tasks.find((t: { id: string }) => t.id === "sellora-run-d-nova")?.status).toBe("blocked");
  });
});
