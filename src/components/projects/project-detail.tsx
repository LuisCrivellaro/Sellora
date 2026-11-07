"use client";

import { Check, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SegmentedBar } from "@/components/charts/segmented-bar";
import { StatusBadge, TonePill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, TextInput } from "@/components/ui/field";
import { Modal } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { PROJECT_STAGES, projectStageMeta, projectStatusMeta, siteTypeMeta, tone } from "@/lib/constants";
import { addProjectTask, removeProjectTask, setProjectStage, toggleProjectTask } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { formatDate, formatRelative } from "@/lib/dates";
import { projectDeadline, projectProgress, projectStatus } from "@/lib/metrics/projects";
import type { Project, ProjectStage } from "@/lib/types";
import { cn, formatBRL } from "@/lib/utils";

export function ProjectDetail({ project, open, onOpenChange, onEdit }: { project: Project | null; open: boolean; onOpenChange: (o: boolean) => void; onEdit: (p: Project) => void }) {
  const { db } = useStore();
  const { notify } = useToast();
  const [taskTitle, setTaskTitle] = useState("");
  const [taskStage, setTaskStage] = useState<ProjectStage>("desenvolvimento");
  const [taskError, setTaskError] = useState("");
  if (!project || !db) return null;

  const client = db.clients.find((c) => c.id === project.clientId);
  const progress = projectProgress(project);
  const status = projectStatus(project);
  const deadline = projectDeadline(project);
  const stageIdx = PROJECT_STAGES.indexOf(project.stage);
  const done = project.tasks.filter((t) => t.done).length;

  const addTask = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      addProjectTask(project.id, taskTitle, taskStage);
      setTaskTitle("");
      setTaskError("");
    } catch (err) {
      setTaskError(err instanceof Error ? err.message : "Erro ao adicionar");
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange} variant="sheet" size="xl" title={project.title} description={`${client?.name ?? "Cliente removido"} · ${siteTypeMeta[project.siteType].label}`}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <TonePill tone={projectStatusMeta[status].tone}>{projectStatusMeta[status].label}</TonePill>
          <TonePill tone={deadline.overdue ? "danger" : deadline.soon ? "warn" : "ghost"}>
            {deadline.done ? `Entregue em ${formatDate(project.deliveredAt)}` : `Prazo ${formatDate(project.dueDate)} (${formatRelative(project.dueDate)})`}
          </TonePill>
          <span className="tnum text-[12.5px] text-ink-faint">{formatBRL(project.contractValue)}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => onEdit(project)}>
            <Pencil aria-hidden /> Editar, preview e publicação
          </Button>
          {client && (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/clientes?id=${client.id}`}>Ver cliente</Link>
            </Button>
          )}
        </div>

        <section className="rounded-2xl border border-seam p-4">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="text-[13.5px] font-semibold text-ink">Etapa de produção</p>
            <p className="tnum text-[12.5px] text-ink-faint">
              Progresso <span className="font-bold text-ink">{progress}%</span> · {done}/{project.tasks.length} tarefas
            </p>
          </div>
          <SegmentedBar value={progress / 100} color={tone.violet} label="Progresso do projeto" valueText={`${progress}%, ${done} de ${project.tasks.length} tarefas`} />
          <ol className="mt-4 grid grid-cols-3 gap-1.5 sm:grid-cols-6" aria-label="Etapas">
            {PROJECT_STAGES.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => {
                    setProjectStage(project.id, s);
                    notify({ kind: "success", title: `Etapa: ${projectStageMeta[s].label}` });
                  }}
                  aria-current={s === project.stage ? "step" : undefined}
                  className={cn(
                    "flex w-full flex-col items-start rounded-xl border px-2.5 py-2 text-left text-[12px] transition-colors",
                    s === project.stage ? "pill-active rounded-xl text-ink" : i < stageIdx ? "border-seam text-ink-soft hover:border-seam-strong" : "border-seam text-ink-faint hover:border-seam-strong",
                  )}
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    {i < stageIdx ? <Check className="size-3.5 text-mint" aria-hidden /> : <span className="size-1.5 rounded-full" style={{ background: tone[projectStageMeta[s].tone] }} aria-hidden />}
                    {projectStageMeta[s].label}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11.5px] text-ink-faint">Selecione uma etapa para atualizar. A etapa “Entrega” registra a data de entrega.</p>
        </section>

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[
            ["Preview", project.previewUrl, "Sem preview registrado"],
            ["Publicação", project.publishedUrl, "Não publicado"],
          ].map(([label, url, empty]) => (
            <div key={label} className="rounded-2xl border border-seam p-3.5">
              <dt className="text-[11.5px] text-ink-faint">{label}</dt>
              <dd className="mt-1 truncate text-[13.5px]">
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-lilac hover:text-ink">
                    {url.replace(/^https?:\/\//, "")} <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : (
                  <span className="text-ink-faint">{empty}</span>
                )}
                {label === "Publicação" && project.publishedAt && <span className="block text-[11.5px] text-ink-faint">Registrado em {formatDate(project.publishedAt)}</span>}
              </dd>
            </div>
          ))}
        </dl>

        <section>
          <p className="mb-2 text-[13.5px] font-semibold text-ink">Checklist de tarefas</p>
          <div className="flex flex-col gap-3">
            {PROJECT_STAGES.map((s) => {
              const tasks = project.tasks.filter((t) => t.stage === s);
              if (!tasks.length) return null;
              return (
                <div key={s}>
                  <p className="mb-1 text-[11.5px] font-semibold text-ink-faint">{projectStageMeta[s].label}</p>
                  <ul className="flex flex-col gap-1">
                    {tasks.map((t) => (
                      <li key={t.id} className="group flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/[0.03]">
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                          <input type="checkbox" checked={t.done} onChange={() => toggleProjectTask(project.id, t.id)} className="size-4 accent-[var(--neon-mint)]" />
                          <span className={cn("text-[13px]", t.done ? "text-ink-faint line-through" : "text-ink")}>{t.title}</span>
                        </label>
                        {t.doneAt && <span className="hidden text-[11px] text-ink-faint sm:inline">{formatDate(t.doneAt)}</span>}
                        <button type="button" onClick={() => removeProjectTask(project.id, t.id)} className="rounded-full p-1 text-ink-faint opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100" aria-label={`Remover tarefa ${t.title}`}>
                          <Trash2 className="size-3.5" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <form onSubmit={addTask} className="mt-3 flex flex-col gap-2 rounded-2xl border border-seam p-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <TextInput aria-label="Nova tarefa" aria-invalid={taskError ? true : undefined} value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder="Nova tarefa, ex.: Ajustar fotos do cardápio" />
              {taskError && (
                <p role="alert" className="mt-1 text-[12px] text-danger">
                  {taskError}
                </p>
              )}
            </div>
            <div className="sm:w-[170px]">
              <Select aria-label="Etapa da tarefa" value={taskStage} onValueChange={setTaskStage} options={PROJECT_STAGES.map((s) => ({ value: s, label: projectStageMeta[s].label }))} />
            </div>
            <Button type="submit" variant="primary">
              <Plus aria-hidden /> Adicionar
            </Button>
          </form>
        </section>

        <section>
          <p className="mb-2 text-[12.5px] font-semibold text-ink-faint">Datas</p>
          <dl className="grid grid-cols-2 gap-3 text-[13px] sm:grid-cols-4">
            {[
              ["Início", formatDate(project.startDate)],
              ["Prazo", formatDate(project.dueDate)],
              ["Publicado", formatDate(project.publishedAt)],
              ["Entregue", formatDate(project.deliveredAt)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[11.5px] text-ink-faint">{k}</dt>
                <dd className="tnum text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        {project.notes && <p className="rounded-2xl border border-seam p-4 text-[13px] whitespace-pre-wrap text-ink-soft">{project.notes}</p>}
        <StatusBadge tone="ghost" label="Publicação real exige aprovação do cliente por escrito; aqui apenas registramos o endereço." size="sm" className="whitespace-normal text-ink-faint" />
      </div>
    </Modal>
  );
}
