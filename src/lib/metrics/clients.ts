import { daysBetween } from "../dates";
import type { Tone } from "../constants";
import type { Database } from "../types";
import { openAmount, transactionStatus } from "./finance";
import { projectDeadline, projectStatus } from "./projects";

export interface AttentionItem {
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectTitle: string;
  issue: string;
  amount?: number;
  tone: Tone;
  lastActivityAt: string | null;
  nextAction: string;
  weight: number;
}

/**
 * Clientes que exigem atenção, por regras explícitas:
 * pagamento vencido (3) > projeto atrasado (3) > aguardando cliente (2) >
 * revisão/publicação pendente (2) > prazo em até 7 dias (1).
 */
export function clientsNeedingAttention(db: Database, now = new Date()): AttentionItem[] {
  const out: AttentionItem[] = [];
  for (const c of db.clients) {
    const acts = db.activities.filter((a) => a.clientId === c.id || (c.leadId && a.leadId === c.leadId));
    const last = acts.map((a) => a.completedAt ?? a.createdAt).sort().at(-1) ?? null;
    const projects = db.projects.filter((p) => p.clientId === c.id);
    const base = { clientId: c.id, clientName: c.name, lastActivityAt: last };
    const overdueTx = db.transactions.find((t) => t.clientId === c.id && t.kind === "receita" && transactionStatus(t, now) === "vencido");
    if (overdueTx) {
      const p = projects.find((x) => x.id === overdueTx.projectId);
      out.push({ ...base, projectId: p?.id ?? null, projectTitle: p?.title ?? "—", issue: `Pagamento vencido há ${-daysBetween(now, overdueTx.dueDate)} dias`, amount: openAmount(overdueTx), tone: "danger", nextAction: "Cobrar saldo com cordialidade", weight: 3 });
    }
    for (const p of projects) {
      const d = projectDeadline(p, now);
      const status = projectStatus(p);
      if (d.overdue) out.push({ ...base, projectId: p.id, projectTitle: p.title, issue: `Prazo vencido há ${-d.days} dias`, tone: "danger", nextAction: "Replanejar entrega e avisar o cliente", weight: 3 });
      else if (status === "em_revisao") out.push({ ...base, projectId: p.id, projectTitle: p.title, issue: p.stage === "publicacao" ? "Aguardando aprovação do preview" : "Revisão com o cliente", tone: "magenta", nextAction: p.stage === "publicacao" ? "Obter aprovação por escrito" : "Consolidar ajustes", weight: 2 });
      else if (d.soon) out.push({ ...base, projectId: p.id, projectTitle: p.title, issue: `Prazo em ${d.days} dias`, tone: "warn", nextAction: "Confirmar andamento", weight: 1 });
    }
    if (c.status === "aguardando_cliente") {
      const p = projects.find((x) => projectStatus(x) !== "concluido");
      out.push({ ...base, projectId: p?.id ?? null, projectTitle: p?.title ?? "—", issue: "Aguardando conteúdo ou retorno do cliente", tone: "warn", nextAction: "Enviar lembrete do material pendente", weight: 2 });
    }
  }
  return out.sort((a, b) => b.weight - a.weight);
}
