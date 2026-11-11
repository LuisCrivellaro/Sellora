"use client";

import { ExternalLink, Monitor, Smartphone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { demoPreviewUrl, type LeadDemo } from "@/lib/demos/model";
import { Segmented } from "@/components/ui/segmented";

export function DemoCanvas({ demo, onEscape }: { demo: LeadDemo; onEscape?: () => void }) {
  const [device, setDevice] = useState("desktop");
  const [width, setWidth] = useState(640);
  const [loaded, setLoaded] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, entry.contentRect.width - 24)));
    if (stage.current) observer.observe(stage.current);
    return () => observer.disconnect();
  }, []);
  const document = new URL(demoPreviewUrl(demo, "https://preview.invalid"));
  const src = document.pathname + document.hash;
  const frameWidth = device === "desktop" ? 1120 : 390;
  const frameHeight = device === "desktop" ? 930 : 844;
  const scale = Math.min(1, width / frameWidth);
  return <section aria-label="Prévia da demo" className="min-w-0">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <Segmented label="Tamanho da prévia" value={device} onChange={(next) => { if (next !== device) { setLoaded(false); setDevice(next); } }} options={[{ value: "desktop", label: <><Monitor size={14} aria-hidden /> Computador</> }, { value: "mobile", label: <><Smartphone size={14} aria-hidden /> Celular</> }]} />
      <Button size="sm" variant="ghost" asChild><a href={src} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden /> Abrir demo</a></Button>
    </div>
    <div ref={stage} className="flex min-h-64 justify-center overflow-hidden rounded-xl border border-seam bg-black/30 p-3">
      <div className="relative shrink-0 overflow-hidden rounded-lg bg-white" style={{ width: frameWidth * scale, height: frameHeight * scale }}>
        {!loaded && <span role="status" className="absolute inset-0 z-10 grid place-items-center bg-white text-[13px] text-neutral-600">Carregando a demo…</span>}
        <iframe key={`${demo.id}:${device}:${demo.version}`} src={src} title={`Demo de ${demo.business.name}`} width={frameWidth} height={frameHeight} className="absolute top-0 left-0 border-0" style={{ width: frameWidth, height: frameHeight, transform: `scale(${scale})`, transformOrigin: "top left" }} referrerPolicy="no-referrer" onLoad={(event) => { setLoaded(true); event.currentTarget.contentDocument?.addEventListener("keydown", (e) => { if (e.key === "Escape") onEscape?.(); }); }} />
      </div>
    </div>
    <p className="mt-2 text-[11.5px] text-ink-faint">Role dentro da prévia para conferir a página completa. As imagens são referências visuais.</p>
  </section>;
}
