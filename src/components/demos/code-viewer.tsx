"use client";

/* eslint-disable @next/next/no-img-element -- miniatura do asset real do site gerado */
import { Check, Copy, Download, FileArchive, FileCode2, ImageIcon, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { highlightLines, languageOf, type TokenKind } from "@/lib/demos/v6/highlight";
import { qaGroups, qaStatusLabel, visualLabel, type QaSummary } from "@/lib/demos/v6/qa-label";
import { cn } from "@/lib/utils";

interface CodeFile { path: string; size: number; sha256: string; kind: "text" | "binary"; content: string | null }
interface Loaded { files: CodeFile[]; qa: QaSummary | null }

const tone: Record<TokenKind, string> = {
  plain: "text-[#d8d4cc]", comment: "text-[#7d8590] italic", tag: "text-[#e8907a]", attr: "text-[#e5c07b]", string: "text-[#98c379]",
  keyword: "text-[#c9a4f5]", number: "text-[#e5a96b]", property: "text-[#7fc4e8]", selector: "text-[#e8c07a]", punct: "text-[#a8a29a]",
};
const formatSize = (bytes: number) => bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

/** Código real do site V6: os mesmos arquivos servidos em /sites/<id>/ e exportados no ZIP. */
export function CodeViewer({ siteId, businessName }: { siteId: string; businessName: string }) {
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState("index.html");
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    fetch(`/api/demos/sites/${siteId}`, { cache: "no-store" })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error || "Não foi possível carregar o código."); return body as Loaded; })
      .then((body) => { if (alive) { setData(body); setError(null); } })
      .catch((failure: Error) => { if (alive) setError(failure.message); });
    return () => { alive = false; };
  }, [siteId, attempt]);
  const file = data?.files.find((item) => item.path === active) ?? data?.files[0];
  const lines = useMemo(() => file?.content != null ? highlightLines(file.content, languageOf(file.path)) : [], [file]);

  if (error) return <div role="alert" className="rounded-xl border border-seam p-4 text-[13px] text-ink-soft"><p>{error}</p><Button size="sm" variant="secondary" className="mt-3" onClick={() => { setError(null); setAttempt((n) => n + 1); }}><RefreshCw aria-hidden /> Tentar de novo</Button></div>;
  if (!data || !file) return <p role="status" className="rounded-xl border border-seam p-6 text-center text-[13px] text-ink-soft">Carregando os arquivos da demo…</p>;

  const copy = async () => {
    if (file.content == null) return;
    try { await navigator.clipboard.writeText(file.content); setCopied(true); setTimeout(() => setCopied(false), 1600); } catch { setError("Permita o acesso à área de transferência para copiar."); }
  };
  const downloadFile = () => {
    if (file.content == null) { window.open(`/sites/${siteId}/${file.path}`, "_blank", "noopener"); return; }
    const url = URL.createObjectURL(new Blob([file.content], { type: "text/plain;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: file.path.split("/").pop() });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return <section aria-label={`Código da demo de ${businessName}`} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-seam bg-[#121212]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-seam px-3 py-2">
      <p className="min-w-0 truncate font-mono text-[12.5px] text-ink-soft"><span className="text-ink">{file.path}</span> · {formatSize(file.size)}{file.content != null && ` · ${lines.length} linhas`}</p>
      <div className="flex flex-wrap gap-1.5">
        {file.content != null && <Button size="sm" variant="ghost" onClick={copy} aria-live="polite">{copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copiado" : "Copiar código"}</Button>}
        <Button size="sm" variant="ghost" onClick={downloadFile}><Download aria-hidden /> Baixar arquivo</Button>
        <Button size="sm" variant="secondary" asChild><a href={`/api/demos/sites/${siteId}/zip`} download><FileArchive aria-hidden /> Baixar código ZIP</a></Button>
      </div>
    </div>
    <div className="grid min-h-0 grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)]">
      <nav aria-label="Arquivos da demo" className="flex gap-1 overflow-x-auto border-b border-seam p-2 md:flex-col md:overflow-visible md:border-r md:border-b-0">
        {data.files.map((item) => <button key={item.path} type="button" aria-current={item.path === file.path ? "true" : undefined} onClick={() => setActive(item.path)}
          className={cn("flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1.5 text-left font-mono text-[12px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-ink", item.path === file.path ? "bg-selected text-ink" : "text-ink-faint hover:bg-white/[0.04] hover:text-ink-soft")}>
          {item.kind === "text" ? <FileCode2 size={14} aria-hidden /> : <ImageIcon size={14} aria-hidden />}<span className="truncate">{item.path}</span>
        </button>)}
      </nav>
      {file.content != null
        ? <pre tabIndex={0} aria-label={`Conteúdo de ${file.path}`} className="max-h-[68vh] min-w-0 overflow-auto p-0 font-mono text-[12.5px] leading-[1.65] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink">
          <code className="block py-3">{lines.map((line, index) => <span key={index} className="grid grid-cols-[3.5rem_minmax(0,1fr)]">
            <span aria-hidden className="select-none pr-4 text-right text-[#5b6168]">{index + 1}</span>
            <span className="pr-4 whitespace-pre">{line.length ? line.map((token, i) => <span key={i} className={tone[token.kind]}>{token.text}</span>) : " "}</span>
          </span>)}</code>
        </pre>
        : <div className="grid place-items-center gap-3 p-6"><img src={`/sites/${siteId}/${file.path}`} alt={`Arquivo ${file.path}`} className="max-h-[60vh] max-w-full rounded-lg border border-seam object-contain" /><p className="text-[12px] text-ink-faint">Imagem usada pelo site ({formatSize(file.size)}). Ilustrativa; não representa o estabelecimento.</p></div>}
    </div>
    {data.qa && <details className="border-t border-seam px-3 py-2 text-[12px] text-ink-soft"><summary className="cursor-pointer font-semibold">Verificação automática: {qaStatusLabel(data.qa)} · navegador real {data.qa.browser === "executed" ? `executado${data.qa.viewports?.length ? ` (${data.qa.viewports.join(", ")} px)` : ""}` : "não executado"} · {data.qa.rounds} rodada(s) de correção{data.qa.resolved ? ` · ${data.qa.resolved} problema(s) corrigido(s)` : ""}{visualLabel(data.qa.visual) ? ` · ${visualLabel(data.qa.visual)}` : ""}</summary>
      {qaGroups(data.qa).length ? qaGroups(data.qa).map((group) => <div key={group.title} className="mt-2"><p className="font-semibold text-ink">{group.title}</p><ul className="mt-1 list-disc space-y-1 pl-4">{group.items.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>) : <p className="mt-2">Nenhum aviso.</p>}</details>}
  </section>;
}
