import { requireAccess, json } from "@/lib/prospecting/access";
import { agentRegistry, claw3dRegistry, claw3dScene, claw3dState, lifecycleEvents, readAllRuns, type AgentRun } from "@/lib/agents/bridge";

export const runtime = "nodejs";

/**
 * Sellora Agent Bridge. Observação apenas: nenhuma rota inicia, altera ou cancela execuções.
 * /api/agents/health · /state · /registry (contrato do runtime `custom` do Claw3D) · /agents (registro detalhado) · /events (SSE)
 * · /scene (o escritório 3D local está no ar?).
 */
export async function GET(request: Request, context: { params: Promise<{ resource: string }> }) {
  const access = await requireAccess(request);
  if (access instanceof Response) return access;
  const { resource } = await context.params;
  if (resource === "health") return json({ ok: true, status: "ok" });
  if (resource === "state") return json(await claw3dState());
  if (resource === "registry") return json(claw3dRegistry());
  if (resource === "agents") return json({ agents: await agentRegistry() });
  if (resource === "scene") return json(await claw3dScene());
  if (resource !== "events") return json({ error: "Recurso não encontrado." }, 404);

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      let previous = new Map<string, AgentRun>((await readAllRuns(40)).map((run) => [run.runId, run]));
      send("presence", { agents: await agentRegistry(), at: new Date().toISOString() });
      let beats = 0;
      timer = setInterval(async () => {
        try {
          const runs = await readAllRuns(40);
          for (const event of lifecycleEvents(previous, runs)) send("agent", event);
          previous = new Map(runs.map((run) => [run.runId, run]));
          if (++beats % 8 === 0) send("heartbeat", { at: new Date().toISOString() });
        } catch { /* próximo ciclo tenta de novo */ }
      }, 2000);
      request.signal.addEventListener("abort", () => { clearInterval(timer); try { controller.close(); } catch { /* fechado */ } });
    },
    cancel() { clearInterval(timer); },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
