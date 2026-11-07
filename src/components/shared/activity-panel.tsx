"use client";

import { CalendarClock, CheckCircle2, Circle, GitCommitHorizontal } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Select, TextArea, TextInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { activityTypeMeta } from "@/lib/constants";
import { addActivity, toggleActivity } from "@/lib/data/repository";
import { formatDate, formatRelative, fromInputDate } from "@/lib/dates";
import { activityInputSchema, fieldErrors } from "@/lib/schemas";
import type { Activity, ActivityType, ID } from "@/lib/types";
import { cn } from "@/lib/utils";

const TYPES: ActivityType[] = ["whatsapp", "ligacao", "email", "visita", "reuniao", "follow_up", "nota"];

/** Registro de atividades + linha do tempo (lead ou cliente). */
export function ActivityPanel({ target, activities }: { target: { leadId?: ID | null; clientId?: ID | null }; activities: Activity[] }) {
  const { notify } = useToast();
  const [type, setType] = useState<ActivityType>("whatsapp");
  const [description, setDescription] = useState("");
  const [due, setDue] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isFollow = type === "follow_up";
  const sorted = [...activities].sort((a, b) => (b.completedAt ?? b.dueAt ?? b.createdAt).localeCompare(a.completedAt ?? a.dueAt ?? a.createdAt));
  const pending = sorted.filter((a) => !a.completedAt);
  const done = sorted.filter((a) => a.completedAt);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const input = { type, description, dueAt: isFollow && due ? fromInputDate(due) : null, completed: !isFollow };
    const parsed = activityInputSchema.safeParse(input);
    if (!parsed.success) return setErrors(fieldErrors(parsed.error));
    if (isFollow && !due) return setErrors({ dueAt: "Informe a data do follow-up." });
    addActivity(target, parsed.data);
    setDescription("");
    setDue("");
    setErrors({});
    notify({ kind: "success", title: isFollow ? "Follow-up agendado" : "Atividade registrada" });
  };

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={submit} noValidate className="rounded-2xl border border-seam bg-white/[0.02] p-4">
        <p className="mb-3 text-[13.5px] font-semibold text-ink">Registrar atividade</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            {(p) => <Select {...p} value={type} onValueChange={setType} options={TYPES.map((t) => ({ value: t, label: activityTypeMeta[t].label }))} />}
          </Field>
          {isFollow ? (
            <Field label="Data do follow-up" error={errors.dueAt}>
              {(p) => <TextInput {...p} type="date" value={due} onChange={(e) => setDue(e.target.value)} />}
            </Field>
          ) : (
            <p className="self-end pb-2.5 text-[12px] text-ink-faint">{type === "nota" ? "Nota interna, não conta como contato." : "Registrada como contato realizado agora."}</p>
          )}
          <Field label="Descrição" error={errors.description} className="sm:col-span-2">
            {(p) => <TextArea {...p} className="min-h-[64px]" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="O que foi conversado ou o que precisa ser feito" />}
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="submit" variant="primary" size="sm">
            {isFollow ? "Agendar follow-up" : "Registrar atividade"}
          </Button>
        </div>
      </form>

      {pending.length > 0 && (
        <section aria-label="Pendentes">
          <p className="mb-2 text-[12.5px] font-semibold text-ink-faint">Pendentes</p>
          <ul className="flex flex-col gap-1.5">
            {pending.map((a) => {
              const overdue = a.dueAt && new Date(a.dueAt) < new Date(new Date().toDateString());
              return (
                <li key={a.id} className="flex items-start gap-3 rounded-xl border border-seam px-3 py-2.5">
                  <button type="button" onClick={() => toggleActivity(a.id)} className="mt-0.5 rounded-full text-ink-faint hover:text-mint" aria-label={`Marcar como concluída: ${a.description}`}>
                    <Circle className="size-4.5" aria-hidden />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] text-ink">{a.description}</p>
                    <p className={cn("mt-0.5 flex items-center gap-1 text-[12px]", overdue ? "text-danger" : "text-ink-faint")}>
                      <CalendarClock className="size-3.5" aria-hidden />
                      {activityTypeMeta[a.type].label} · {formatDate(a.dueAt)} ({formatRelative(a.dueAt)}){overdue ? " · vencido" : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section aria-label="Histórico">
        <p className="mb-2 text-[12.5px] font-semibold text-ink-faint">Histórico</p>
        {done.length === 0 ? (
          <p className="text-[13px] text-ink-faint">Nenhuma atividade registrada ainda.</p>
        ) : (
          <ol className="relative flex flex-col gap-3 border-l border-seam pl-5">
            {done.map((a) => (
              <li key={a.id} className="relative">
                <span className="absolute top-1 -left-[27px] grid size-3.5 place-items-center rounded-full bg-facade">
                  {a.type === "etapa" ? <GitCommitHorizontal className="size-3.5 text-lilac" aria-hidden /> : <CheckCircle2 className="size-3.5 text-mint" aria-hidden />}
                </span>
                <p className="text-[13px] text-ink">{a.description}</p>
                <p className="text-[11.5px] text-ink-faint">
                  {activityTypeMeta[a.type].label} · {formatDate(a.completedAt)} · {formatRelative(a.completedAt)}
                  {a.type === "follow_up" && (
                    <button type="button" onClick={() => toggleActivity(a.id)} className="ml-2 underline-offset-2 hover:text-ink hover:underline">
                      Reabrir
                    </button>
                  )}
                </p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
