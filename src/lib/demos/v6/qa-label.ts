/** Rótulos do resultado do QA V6 para a interface (sem dependências de servidor). */
export interface VisualSummary {
  status: string; target: number; initial: number | null; final: number | null; rounds: number;
  criteria: { key: string; label: string; weight: number; score: number; evidence: string }[];
  problems: string[]; fixes: string[]; history: { round: number; score: number | null; accepted: boolean; note: string }[]; reason: string | null;
}
export interface QaSummary {
  status: string; browser: string; rounds: number; issues: string[];
  fixable?: string[]; blocking?: string[]; warnings?: string[]; review?: string[]; resolved?: number; attempts?: number; pages?: string[]; viewports?: number[]; imageFallback?: boolean;
  originality?: { compared: number; partial: number; nearest: number | null; notes: string[] };
  visual?: VisualSummary;
}

export function qaStatusLabel(qa: Pick<QaSummary, "status" | "issues" | "fixable" | "warnings" | "blocking">): string {
  if (qa.status === "passed") return "sem problemas";
  if (qa.status === "needs_review") return qa.blocking?.length
    ? `pendente de revisão (${qa.blocking.length} defeito(s) bloqueante(s) de leitura ou interação)`
    : `pendente de revisão (${qa.fixable?.length ?? qa.issues.length} problema(s) corrigível(is) não resolvido(s) ou item obrigatório pendente)`;
  return `${qa.warnings?.length ?? qa.issues.length} aviso(s)`;
}

const score = (value: number | null) => (value === null ? "—" : value.toFixed(1).replace(".", ","));

/** Linha curta da revisão de impacto visual (nota inicial → final, meta). */
export function visualLabel(visual: VisualSummary | undefined): string | null {
  if (!visual) return null;
  if (visual.status === "disabled") return "revisão visual desligada";
  if (visual.status === "visual_review_unavailable") return "revisão visual indisponível";
  const trend = visual.initial !== null && visual.final !== null && visual.final !== visual.initial ? `${score(visual.initial)} → ${score(visual.final)}` : score(visual.final);
  return `impacto visual ${trend}/10 (meta ${score(visual.target)}${visual.status === "approved" ? ", atingida" : ", abaixo"})`;
}

/** Grupos mostrados no relatório, do mais grave ao subjetivo. Registros antigos só têm `issues`. */
export function qaGroups(qa: QaSummary): { title: string; items: string[] }[] {
  if (!qa.fixable && !qa.warnings && !qa.review) return [{ title: "Avisos", items: qa.issues }];
  const blocking = new Set(qa.blocking ?? []);
  const originality = qa.originality ? [`Comparada com ${qa.originality.compared} demo(s) do histórico${qa.originality.partial ? ` (${qa.originality.partial} com identidade parcial)` : ""}${qa.originality.nearest !== null ? `; semelhança máxima ${Math.round(qa.originality.nearest * 100)}%` : ""}.`, ...qa.originality.notes] : [];
  const v = qa.visual;
  const visual = !v ? [] : v.status === "visual_review_unavailable" || v.status === "disabled"
    ? [`${visualLabel(v)}${v.reason ? `: ${v.reason}` : ""}. Avalie as capturas manualmente.`]
    : [
      `${visualLabel(v)}; ${v.rounds} rodada(s) de correção visual.`,
      ...v.criteria.map((item) => `${item.label} (${Math.round(item.weight * 100)}%): ${score(item.score)} — ${item.evidence}`),
      ...v.history.filter((entry) => entry.round > 0).map((entry) => `Rodada ${entry.round}: ${entry.note}`),
      ...(v.status === "approved" ? [] : v.problems.slice(0, 5).map((problem) => `Problema: ${problem}`)),
    ];
  return [
    { title: "Bloqueantes (impedem a aprovação)", items: [...blocking] },
    { title: "Corrigíveis não resolvidos", items: (qa.fixable ?? []).filter((issue) => !blocking.has(issue)) },
    { title: "Avisos", items: qa.warnings ?? [] },
    { title: "Impacto visual (avaliação do Claude com capturas reais; sinal auxiliar)", items: visual },
    { title: "Originalidade", items: originality },
    { title: "Revisão humana", items: qa.review ?? [] },
  ].filter((group) => group.items.length);
}
