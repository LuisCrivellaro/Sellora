"use client";

import { Code2, ExternalLink, Eye, Monitor, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { demoPreviewUrl, type LeadDemo } from "@/lib/demos/model";
import { Segmented } from "@/components/ui/segmented";
import { CodeViewer } from "./code-viewer";

export function DemoCanvas({ demo, onEscape, onGenerate, generateDisabled }: { demo: LeadDemo; onEscape?: () => void; onGenerate?: () => void; generateDisabled?: boolean }) {
  const [view, setView] = useState<"preview" | "code">("preview");
  const [device, setDevice] = useState("desktop");
  const [width, setWidth] = useState(640);
  const [loaded, setLoaded] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width - 24)));
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, [view]);
  const document = new URL(demoPreviewUrl(demo, "https://preview.invalid"));
  const src = document.pathname + document.hash;
  const site = demo.version === 6 ? demo.site : undefined;
  const frameWidth = device === "desktop" ? 1120 : 390;
  const frameHeight = device === "desktop" ? 930 : 844;
  const scale = Math.min(1, width / frameWidth);
  return <section aria-label="Prévia da demo" className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented label="Prévia ou código" value={view} onChange={(next) => setView(next as "preview" | "code")} options={[{ value: "preview", label: <><Eye size={14} aria-hidden /> Prévia</> }, { value: "code", label: <><Code2 size={14} aria-hidden /> Código</> }]} />
        {view === "preview" && <Segmented label="Tamanho da prévia" value={device} onChange={(next) => { if (next !== device) { setLoaded(false); setDevice(next); } }} options={[{ value: "desktop", label: <><Monitor size={14} aria-hidden /> Computador</> }, { value: "mobile", label: <><Smartphone size={14} aria-hidden /> Celular</> }]} />}
      </div>
      <Button size="sm" variant="ghost" asChild><a href={src} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> Abrir demo</a></Button>
    </div>
    {view === "code" ? (site ? <CodeViewer siteId={site.id} businessName={demo.business.name} /> : <div className="rounded-xl border border-seam p-5 text-[13px] leading-relaxed text-ink-soft">
      <p className="font-semibold text-ink">Esta demo não tem código próprio.</p>
      <p className="mt-1">Ela foi criada numa versão anterior do gerador (v{demo.version}), em que os dados eram encaixados num modelo compartilhado do Sellora. Não há arquivos exportáveis para mostrar.</p>
      {onGenerate && <Button size="sm" className="mt-3" disabled={generateDisabled} onClick={onGenerate}><Code2 aria-hidden /> Gerar nova versão com código (V6)</Button>}
    </div>) : <>
      <div ref={stage} className="flex min-h-64 justify-center overflow-hidden rounded-xl border border-seam bg-black/30 p-3">
        <div className="relative shrink-0 overflow-hidden rounded-lg bg-white" style={{ width: frameWidth * scale, height: frameHeight * scale }}>
          {!loaded && <span role="status" className="absolute inset-0 z-10 grid place-items-center bg-white text-[13px] text-neutral-600">Carregando a demo…</span>}
          <iframe key={`${demo.id}:${device}:${demo.version}:${site?.id ?? ""}`} src={src} title={`Demo de ${demo.business.name}`} width={frameWidth} height={frameHeight} className="absolute top-0 left-0 border-0" style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})`, transformOrigin: "top left" }} referrerPolicy="no-referrer"
            sandbox={site ? "allow-scripts allow-popups allow-popups-to-escape-sandbox" : undefined}
            onLoad={(event) => { setLoaded(true); try { event.currentTarget.contentDocument?.addEventListener("keydown", (e) => { if (e.key === "Escape") onEscape?.(); }); } catch { /* site V6 isolado: sem acesso ao documento */ } }} />
        </div>
      </div>
      <p className="mt-2 text-[11.5px] text-ink-faint">{site ? "Site próprio da demo (V6), isolado em sandbox. É o mesmo código mostrado em Código e exportado no ZIP." : "Role dentro da prévia para conferir a página completa. As imagens são referências visuais."}</p>
    </>}
  </section>;
}
