import { PROJECT_STAGES } from "../constants";
import { daysBetween } from "../dates";
import type { Project, ProjectStatus } from "../types";

/**
 * Progresso = tarefas concluídas ÷ tarefas totais (0–100).
 * Sem tarefas: progresso pela etapa (índice ÷ última etapa).
 */
export function projectProgress(p: Project): number {
  if (p.tasks.length > 0) return Math.round((p.tasks.filter((t) => t.done).length / p.tasks.length) * 100);
  return Math.round((PROJECT_STAGES.indexOf(p.stage) / (PROJECT_STAGES.length - 1)) * 100);
}

/**
 * Status derivado:
 * - concluído: etapa "entrega" com data de entrega registrada;
 * - em revisão: etapas "revisão", "aprovação" ou "publicação";
 * - não iniciado: etapa "briefing" sem tarefas concluídas;
 * - em desenvolvimento: demais casos.
 */
export function projectStatus(p: Project): ProjectStatus {
  if (p.stage === "entrega" && p.deliveredAt) return "concluido";
  if (p.stage === "revisao" || p.stage === "aprovacao" || p.stage === "publicacao") return "em_revisao";
  if (p.stage === "briefing" && !p.tasks.some((t) => t.done)) return "nao_iniciado";
  return "em_desenvolvimento";
}

export function projectDeadline(p: Project, now = new Date()) {
  const days = daysBetween(now, p.dueDate);
  const done = projectStatus(p) === "concluido";
  return { days, overdue: !done && days < 0, soon: !done && days >= 0 && days <= 7, done };
}

export function stageCounts(projects: Project[]) {
  return PROJECT_STAGES.map((stage) => ({ stage, count: projects.filter((p) => p.stage === stage).length }));
}

export function statusCounts(projects: Project[]) {
  const out: Record<ProjectStatus, number> = { nao_iniciado: 0, em_desenvolvimento: 0, em_revisao: 0, concluido: 0 };
  for (const p of projects) out[projectStatus(p)]++;
  return out;
}

/** Sites contratados por situação de entrega. */
export function siteDelivery(projects: Project[]) {
  return {
    desenvolvimento: projects.filter((p) => ["briefing", "briefing_recebido", "planejamento", "design", "desenvolvimento"].includes(p.stage)).length,
    revisao: projects.filter((p) => p.stage === "revisao").length,
    publicados: projects.filter((p) => !!p.publishedUrl).length,
    entregues: projects.filter((p) => projectStatus(p) === "concluido").length,
    total: projects.length,
  };
}
