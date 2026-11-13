"use client";

import { ChevronDown, CloudUpload, Copy, ExternalLink, RefreshCw, RotateCcw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import type { LeadDemo } from "@/lib/demos/model";
import { usePublication } from "@/lib/publishing/client";
import { publicationStatusLabel, type PublicationStatus, type PublicationView } from "@/lib/publishing/types";
import type { Lead } from "@/lib/types";

const tone: Record<PublicationStatus, { text: string; dot: string }> = {
  awaiting: { text: "text-ink-soft", dot: "bg-ink-faint" },
  preparing: { text: "text-warn", dot: "bg-warn animate-pulse motion-reduce:animate-none" },
  deploying: { text: "text-warn", dot: "bg-warn animate-pulse motion-reduce:animate-none" },
  published: { text: "text-mint", dot: "bg-mint" },
  failed: { text: "text-[#e3a1a1]", dot: "bg-[#e3a1a1]" },
  suspended: { text: "text-warn", dot: "bg-warn" },
  removed: { text: "text-ink-soft", dot: "bg-ink-faint" },
};
const kindLabel = { publish: "Publicação", republish: "Republicação", retry: "Nova tentativa" } as const;
const opLabel = { preparing: "Preparando", deploying: "Publicando", published: "Publicada e confirmada", failed: "Falhou" } as const;
const healthLabel = { ok: "respondeu com o conteúdo da demo", unreachable: "não respondeu", mismatch: "respondeu com conteúdo diferente", unknown: "não verificado" } as const;
const dateTime = (iso: string | null) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/**
 * Publicação da demo V6 no Coolify (infraestrutura interna; o lead só recebe o link). Etapa independente da
 * geração e da aprovação da mensagem. Os estados vêm do servidor, que consulta o Coolify e confere o conteúdo.
 */
export function DemoPublicationPanel({ lead, demo }: { lead: Lead; demo: LeadDemo }) {
  const { notify } = useToast();
  const siteId = demo.site?.id ?? null;
  const { config, publication, error, busy, working, run } = usePublication(lead.id, { name: demo.business.name, city: demo.business.city, uf: demo.business.uf }, siteId);
  const [confirm, setConfirm] = useState<"publish" | "republish" | null>(null);
  if (!siteId) return null;

  const status: PublicationStatus = publication?.status ?? "awaiting";
  const outdated = !!publication?.publishedSiteId && publication.publishedSiteId !== siteId;
  const url = publication?.status === "published" || publication?.status === "suspended" || publication?.status === "failed" ? publication.url : null;
  const act = async (action: "publish" | "republish" | "retry" | "verify") => {
    const result = await run(action);
    if (!result.ok) notify({ kind: "error", title: "Não foi possível concluir", description: result.error });
    else if (action === "verify") notify({ kind: "success", title: "Estado conferido no Coolify" });
    else notify({ kind: "success", title: result.reused ? "Publicação já em andamento ou concluída" : "Publicação iniciada", description: result.reused ? undefined : "Acompanhe o andamento aqui. Nenhuma mensagem é enviada ao lead." });
  };
  const copy = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); notify({ kind: "success", title: "Link copiado", description: "Envie manualmente pelo canal que preferir." }); }
    catch { notify({ kind: "error", title: "Não foi possível copiar", description: "Permita acesso à área de transferência e tente novamente." }); }
  };

  const canAct = !!config?.configured && !working && !busy;
  const primary: "publish" | "republish" | "retry" = !publication || status === "awaiting" || status === "removed" ? "publish" : status === "failed" ? "retry" : "republish";

  return <section className="flex flex-col gap-3 rounded-2xl border border-seam p-4" aria-label="Publicação da demo">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-[14px] font-semibold text-ink">Publicação da demo</h3>
      <span role="status" className={`inline-flex items-center gap-1.5 text-[12px] font-semibold ${tone[status].text}`}>
        <span aria-hidden className={`size-1.5 rounded-full ${tone[status].dot}`} />{publication === undefined ? "Consultando…" : publicationStatusLabel[status]}
      </span>
    </div>

    {config === null && <p className="text-[12px] text-warn">Não foi possível consultar a configuração de publicação.</p>}
    {config && !config.configured && <div className="rounded-xl border border-seam p-3 text-[12px] text-ink-soft">
      <p className="font-semibold text-ink">Publicação não configurada neste computador</p>
      <p className="mt-1">A demo continua pronta para revisão. Para publicar, defina no servidor (arquivo .env.local) as variáveis abaixo e reinicie o app. Passo a passo em docs/COOLIFY_INTEGRATION.md.</p>
      <p className="mt-2 font-mono text-[11.5px] break-words text-ink-faint">{[...config.missing, ...config.invalid.map((name) => `${name} (inválida)`)].join(" · ")}</p>
      <p className="mt-2">No aplicativo Windows, a configuração fica em %APPDATA%\sellora\sellora.env (criado na primeira abertura).</p>
    </div>}
    {config && <ConnectionTest />}

    {url && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-selected p-3">
      <a href={url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-ink underline-offset-2 hover:underline" title={url}>{url}</a>
      <Button size="sm" variant="secondary" onClick={() => void copy()}><Copy aria-hidden /> Copiar link</Button>
      <Button size="sm" variant="ghost" asChild><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> Abrir demo</a></Button>
    </div>}

    {outdated && status !== "preparing" && status !== "deploying" && <p role="status" className="text-[12px] text-warn">O endereço mostra uma versão anterior desta demo. Republique para publicar a versão atual.</p>}
    {publication?.lastError && (status === "failed" || status === "suspended" || status === "removed" || publication.health !== "ok") && <p role="alert" className="rounded-xl border border-[#5c2a2e] p-3 text-[12px] text-[#e3a1a1]">{publication.lastError}</p>}
    {working && publication?.operations[0]?.events.at(-1) && <p role="status" className="text-[12px] text-ink-soft">{publication.operations[0].events.at(-1)!.message}</p>}
    {error && <p role="alert" className="text-[12px] text-warn">{error}</p>}

    {publication && <dl className="grid grid-cols-[9rem_minmax(0,1fr)] gap-y-1 text-[12px]">
      <dt className="text-ink-faint">Último deploy</dt><dd className="tnum text-ink">{dateTime(publication.lastDeployAt)}</dd>
      <dt className="text-ink-faint">Domínio</dt><dd className="break-all text-ink">{publication.domain ?? "gerado pelo Coolify"}</dd>
      <dt className="text-ink-faint">Aplicação Coolify</dt><dd className="font-mono text-[11.5px] break-all text-ink">{publication.coolifyAppUuid ?? "ainda não criada"}</dd>
      <dt className="text-ink-faint">Repositório</dt><dd className="font-mono text-[11.5px] break-all text-ink-soft">{publication.github.repo}/{publication.github.path}{publication.github.commitSha ? ` @ ${publication.github.commitSha.slice(0, 7)}` : ""}</dd>
      <dt className="text-ink-faint">Última verificação</dt><dd className="text-ink-soft">{publication.lastCheckedAt ? `${dateTime(publication.lastCheckedAt)} · ${healthLabel[publication.health]}` : "—"}</dd>
    </dl>}

    <div className="flex flex-wrap gap-2">
      <Button size="sm" loading={busy === "publish" || busy === "republish" || busy === "retry"} disabled={!canAct} onClick={() => primary === "retry" ? void act("retry") : setConfirm(primary)}>
        {primary === "retry" ? <><RotateCcw aria-hidden /> Tentar novamente</> : primary === "republish" ? <><CloudUpload aria-hidden /> Republicar</> : <><CloudUpload aria-hidden /> Publicar demo</>}
      </Button>
      {publication && <Button size="sm" variant="ghost" loading={busy === "verify"} disabled={!config?.configured || working || !!busy} onClick={() => void act("verify")}><RefreshCw aria-hidden /> Verificar no Coolify</Button>}
    </div>
    <p className="text-[11.5px] text-ink-faint">Publicar deixa a demo acessível a quem tiver o endereço. Nada é enviado ao lead: copie o link e envie manualmente.</p>

    {publication && publication.operations.length > 0 && <details className="group rounded-xl border border-seam text-[12px]">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 font-semibold text-ink-soft hover:text-ink [&::-webkit-details-marker]:hidden">
        <ChevronDown aria-hidden className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />Histórico de publicações ({publication.operations.length})
      </summary>
      <History publication={publication} />
    </details>}

    <ConfirmDialog open={!!confirm} onOpenChange={(open) => !open && setConfirm(null)} destructive={false}
      title={confirm === "republish" ? "Republicar esta demo?" : "Publicar esta demo?"}
      description={`Os arquivos da demo de ${demo.business.name} serão enviados ao repositório ${config?.repository ?? "configurado"} e publicados pelo Coolify em ${publication?.domain ?? (config?.baseDomain ? `um subdomínio de ${config.baseDomain}` : "um endereço gerado pelo Coolify")}. O endereço fica acessível a quem tiver o link. Nenhuma mensagem é enviada ao lead.`}
      confirmLabel={confirm === "republish" ? "Republicar" : "Publicar"} onConfirm={() => { const action = confirm; setConfirm(null); if (action) void act(action); }} />
  </section>;
}

type CheckResult = { ok: boolean | null; error?: string; version?: string; repo?: string; private?: boolean; branch?: string };

/** Testa, sem gravar nada, o token do Coolify e o acesso de escrita ao repositório das demos. */
function ConnectionTest() {
  const [state, setState] = useState<{ coolify: CheckResult; github: CheckResult } | "loading" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const run = async () => {
    setState("loading"); setFailure(null);
    try {
      const response = await fetch("/api/publications?test=1", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !body.connection) throw new Error(body.error || "Teste indisponível.");
      setState(body.connection);
    } catch (error) { setState(null); setFailure(error instanceof Error ? error.message : "Teste indisponível."); }
  };
  const line = (label: string, result: CheckResult, ok: string) => <li className={result.ok ? "text-mint" : result.ok === false ? "text-[#e3a1a1]" : "text-ink-faint"}>
    {label}: {result.ok ? ok : result.error}
  </li>;
  return <div className="flex flex-col gap-2 text-[12px]">
    <Button size="sm" variant="secondary" className="self-start" loading={state === "loading"} onClick={() => void run()}><RefreshCw aria-hidden /> Testar conexão</Button>
    {failure && <p role="alert" className="text-warn">{failure}</p>}
    {state && state !== "loading" && <ul role="status" className="flex flex-col gap-1">
      {line("Coolify", state.coolify, `conectado (versão ${state.coolify.version})`)}
      {line("GitHub", state.github, `${state.github.repo} com permissão de escrita, ramo ${state.github.branch}${state.github.private ? " (privado)" : " (público)"}`)}
    </ul>}
  </div>;
}

function History({ publication }: { publication: PublicationView }) {
  return <ol className="flex flex-col gap-2 border-t border-seam p-3">
    {publication.operations.map((op) => <li key={op.id} className="flex flex-col gap-1">
      <p><span className="tnum text-ink-faint">{dateTime(op.startedAt)}</span> · <span className="text-ink">{kindLabel[op.kind]}</span> · <span className={op.status === "published" ? "text-mint" : op.status === "failed" ? "text-[#e3a1a1]" : "text-warn"}>{opLabel[op.status]}</span>
        {op.coolifyDeploymentUuid && <span className="font-mono text-[11px] text-ink-faint"> · deploy {op.coolifyDeploymentUuid}</span>}</p>
      {op.error && <p className="text-[#e3a1a1]">{op.error}</p>}
      {op.events.length > 0 && <ol className="max-h-32 overflow-auto pl-3 text-ink-soft">{op.events.map((event) => <li key={event.at + event.message}><span className="tnum text-ink-faint">{new Date(event.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span> {event.message}</li>)}</ol>}
    </li>)}
  </ol>;
}
