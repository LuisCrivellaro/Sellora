import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { demoDataRoot } from "../demos/codex-server";
import { leadIdSchema, publicationRecordSchema, type PublicationRecord } from "./types";

/**
 * Registros de publicação em <dados>/publications/<leadId>.json, um por lead (uma aplicação Coolify por lead).
 * Mesmo padrão dos jobs do gerador e das pesquisas: arquivo JSON validado por Zod e gravação atômica.
 * Ficam fora do JSON do CRM; o lead guarda só um resumo (demo.publication).
 */
export const publicationsDir = () => path.join(demoDataRoot(), "publications");
const fileFor = (leadId: string) => path.join(publicationsDir(), `${leadIdSchema.parse(leadId)}.json`);

/**
 * Último registro gravado por este processo, por caminho de arquivo. O servidor da Sellora é o único que grava
 * esses arquivos; ler da memória evita que leituras frequentes (painel, bridge) segurem o arquivo no Windows
 * durante a troca atômica.
 */
const cache = (): Map<string, PublicationRecord> => {
  const holder = globalThis as typeof globalThis & { selloraPublicationCache?: Map<string, PublicationRecord> };
  holder.selloraPublicationCache ??= new Map();
  return holder.selloraPublicationCache;
};
const clone = (record: PublicationRecord): PublicationRecord => structuredClone(record);

export async function readPublication(leadId: string): Promise<PublicationRecord | null> {
  if (!leadIdSchema.safeParse(leadId).success) return null;
  const cached = cache().get(fileFor(leadId));
  if (cached) return clone(cached);
  for (let attempt = 0; ; attempt += 1) {
    try {
      const parsed = publicationRecordSchema.safeParse(JSON.parse(await readFile(fileFor(leadId), "utf8")));
      return parsed.success ? parsed.data : null;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Windows: a troca atômica do arquivo pode recusar a leitura por instantes; não confundir com "sem registro".
      if (attempt < 8 && (code === "EPERM" || code === "EBUSY" || code === "EACCES")) { await new Promise((resolve) => setTimeout(resolve, 20 * (attempt + 1))); continue; }
      return null;
    }
  }
}

/** Gravações do mesmo lead em fila: duas escritas nunca disputam o mesmo arquivo. */
const queues = new Map<string, Promise<void>>();

export function writePublication(record: PublicationRecord): Promise<void> {
  const valid = publicationRecordSchema.parse(record);
  cache().set(fileFor(valid.leadId), clone(valid));
  const previous = queues.get(valid.leadId) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(() => writeNow(valid));
  queues.set(valid.leadId, next);
  void next.finally(() => { if (queues.get(valid.leadId) === next) queues.delete(valid.leadId); }).catch(() => {});
  return next;
}

async function writeNow(valid: PublicationRecord) {
  await mkdir(publicationsDir(), { recursive: true });
  const target = fileFor(valid.leadId);
  const temp = `${target}.${randomUUID()}.tmp`;
  await writeFile(temp, JSON.stringify(valid, null, 2), "utf8");
  for (let attempt = 0; ; attempt += 1) {
    try { await rename(temp, target); return; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      // Windows: um leitor, o antivírus ou o indexador podem segurar o arquivo por instantes.
      if (attempt >= 10 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) { await rm(temp, { force: true }).catch(() => {}); throw error; }
      await new Promise((resolve) => setTimeout(resolve, 25 * (attempt + 1)));
    }
  }
}

export async function listPublications(): Promise<PublicationRecord[]> {
  const records: PublicationRecord[] = [];
  const seen = new Set<string>();
  for (const file of await readdir(publicationsDir()).catch(() => [])) {
    if (!file.endsWith(".json")) continue;
    const record = await readPublication(file.slice(0, -5));
    if (record) { records.push(record); seen.add(record.leadId); }
  }
  // Registro novo cuja primeira gravação ainda está na fila.
  const dir = publicationsDir();
  for (const [file, record] of cache()) if (path.dirname(file) === dir && !seen.has(record.leadId)) records.push(clone(record));
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
