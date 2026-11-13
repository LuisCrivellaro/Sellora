import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { demoDataRoot } from "../demos/codex-server";
import type { JobView } from "./types";

/**
 * Linha do tempo das pesquisas da Prospecção, para a observabilidade (Cloud 3D/Kanban) sobreviver ao
 * reinício do app. Grava só o resumo da pesquisa (cidade, UF, segmento, raio, etapas, contagens e erro):
 * nenhum resultado, nome de estabelecimento, telefone ou site.
 */
const runSchema = z.object({
  id: z.string().min(1).max(100), status: z.enum(["queued", "running", "completed", "failed", "cancelled"]),
  phase: z.string().max(40), message: z.string().max(500), city: z.string().max(80), uf: z.string().max(4), segment: z.string().max(60),
  radiusKm: z.number(), candidates: z.number(), analyzed: z.number(), found: z.number(), error: z.string().max(500).nullable(),
  startedAt: z.string(), finishedAt: z.string().nullable(), events: z.array(z.object({ at: z.string(), phase: z.string().max(500) })).max(40),
});
export type ProspectRunRecord = z.infer<typeof runSchema>;

const dir = () => path.join(demoDataRoot(), "prospect-runs");
const safeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
const memory = new Map<string, { record: ProspectRunRecord; timer: ReturnType<typeof setTimeout> | null }>();

function write(record: ProspectRunRecord) {
  try {
    mkdirSync(dir(), { recursive: true });
    const file = path.join(dir(), `${safeId(record.id)}.json`);
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, JSON.stringify(record), "utf8");
    renameSync(temp, file);
  } catch { /* observabilidade não pode derrubar a pesquisa */ }
}

/** Atualiza o resumo de uma pesquisa (gravação agrupada; o fim é gravado na hora). */
export function recordProspectRun(view: JobView) {
  const current = memory.get(view.id);
  const previous = current?.record;
  const events = previous?.events ?? [];
  const text = view.error ?? view.message;
  const nextEvents = text && events.at(-1)?.phase !== text ? [...events, { at: new Date().toISOString(), phase: text.slice(0, 500) }].slice(-40) : events;
  const record: ProspectRunRecord = {
    id: view.id, status: view.status, phase: view.phase, message: view.message.slice(0, 500),
    city: view.params.city, uf: view.params.uf, segment: view.params.segment, radiusKm: view.params.radiusKm,
    candidates: view.candidates, analyzed: view.analyzed, found: view.found, error: view.error,
    startedAt: view.startedAt, finishedAt: view.finishedAt, events: nextEvents,
  };
  const ended = view.status !== "queued" && view.status !== "running";
  if (current?.timer) clearTimeout(current.timer);
  if (ended) {
    // A mensagem final chega depois do término: mantém o registro para não perder a linha do tempo.
    write(record);
    memory.set(view.id, { record, timer: null });
    if (memory.size > 50) memory.delete(memory.keys().next().value!);
    return;
  }
  memory.set(view.id, { record, timer: setTimeout(() => { write(record); const entry = memory.get(view.id); if (entry) entry.timer = null; }, 800) });
}

/** Pesquisas registradas, da mais recente para a mais antiga. */
export async function readProspectRuns(limit = 40): Promise<ProspectRunRecord[]> {
  const runs: ProspectRunRecord[] = [];
  for (const file of await readdir(dir()).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    try {
      const parsed = runSchema.safeParse(JSON.parse(await readFile(path.join(dir(), file), "utf8")));
      if (parsed.success) runs.push(parsed.data);
    } catch { /* arquivo incompleto: ignora */ }
  }
  for (const { record } of memory.values()) {
    const index = runs.findIndex((run) => run.id === record.id);
    if (index >= 0) runs[index] = record; else runs.push(record);
  }
  const updated = (run: ProspectRunRecord) => run.events.at(-1)?.at ?? run.finishedAt ?? run.startedAt;
  return runs.sort((a, b) => updated(b).localeCompare(updated(a))).slice(0, limit);
}
