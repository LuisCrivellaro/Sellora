import type { PublicationStatus } from "./types";

/**
 * Tradução dos estados reais do Coolify para os estados da Sellora (funções puras, testadas).
 * Deploy (ApplicationDeploymentStatus): queued, in_progress, finished, failed, cancelled-by-user.
 * Aplicação (campo `status`): "<estado>:<saúde>", ex.: running:healthy, running:unknown, exited:unhealthy,
 * restarting:unhealthy, degraded:unhealthy.
 */
export type DeploymentOutcome = "pending" | "finished" | "failed";

export function deploymentOutcome(status: string | null | undefined): DeploymentOutcome {
  const value = (status ?? "").toLowerCase();
  if (value === "queued" || value === "in_progress") return "pending";
  if (value === "finished") return "finished";
  // failed, cancelled-by-user e qualquer valor desconhecido: nunca assumir sucesso.
  return "failed";
}

export function deploymentStatusText(status: string | null | undefined): string {
  switch ((status ?? "").toLowerCase()) {
    case "queued": return "Deploy na fila do Coolify";
    case "in_progress": return "Coolify construindo e publicando";
    case "finished": return "Deploy concluído no Coolify";
    case "failed": return "Deploy falhou no Coolify";
    case "cancelled-by-user": return "Deploy cancelado no Coolify";
    default: return `Estado de deploy desconhecido (${String(status ?? "vazio").slice(0, 40)})`;
  }
}

/** Estado da aplicação já publicada. null = manter o estado atual (ex.: reiniciando, aguarda nova checagem). */
export function applicationState(status: string | null | undefined): "running" | "stopped" | "transient" | "unknown" {
  const [state] = (status ?? "").toLowerCase().split(":");
  if (state === "running") return "running";
  if (state === "exited" || state === "stopped") return "stopped";
  if (state === "restarting" || state === "starting" || state === "degraded") return "transient";
  return "unknown";
}

/** Estado da publicação depois de consultar a aplicação no Coolify (reconciliação). */
export function reconcileStatus(current: PublicationStatus, app: { found: boolean; status?: string | null }): PublicationStatus {
  if (!app.found) return current === "awaiting" ? current : "removed";
  const state = applicationState(app.status);
  if (state === "stopped") return current === "published" || current === "suspended" ? "suspended" : current;
  if (state === "running" && current === "suspended") return "published";
  return current;
}
