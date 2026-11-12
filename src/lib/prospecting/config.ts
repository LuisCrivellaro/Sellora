import { OSM_ATTRIBUTION } from "./osm";
import type { ExecutorStatus } from "./types";

/**
 * Qual executor está ativo (somente servidor). Desligado por padrão: a
 * Prospecção IA faz requisições a serviços externos, então só roda quando o
 * administrador habilita em `.env.local`.
 */
export const JOB_LIMITS = { maxResults: 10, maxRadiusKm: 50, jobsPerHour: 10, activePerOwner: 1, activeGlobal: 2, timeoutMs: 5 * 60_000, keepMs: 60 * 60_000 };

export type ExecutorId = "osm";

export function activeExecutor(): ExecutorId | null {
  const v = (process.env.PROSPECCAO_EXECUTOR ?? "").trim().toLowerCase();
  return v === "osm" ? "osm" : null;
}

export function executorStatus(): ExecutorStatus {
  const id = activeExecutor();
  const limits = { maxResults: JOB_LIMITS.maxResults, maxRadiusKm: JOB_LIMITS.maxRadiusKm, jobsPerHour: JOB_LIMITS.jobsPerHour };
  if (id === "osm") {
    return { configured: true, executor: "osm", label: "OpenStreetMap + verificação HTTP", instructions: [], limits, attribution: OSM_ATTRIBUTION };
  }
  return {
    configured: false,
    executor: null,
    label: "Integração não configurada",
    instructions: [
      "Abra (ou crie) o arquivo .env.local na raiz do projeto.",
      "Adicione a linha PROSPECCAO_EXECUTOR=osm",
      "Reinicie o servidor (npm run dev ou npm run start).",
      "Executor gratuito e sem chave: OpenStreetMap (Nominatim + Overpass) e conferência HTTP dos sites encontrados.",
    ],
    limits,
    attribution: null,
  };
}
