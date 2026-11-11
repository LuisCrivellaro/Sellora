"use client";

import { useEffect, useState } from "react";
import { parseDemoDocument } from "@/lib/demos/model";
import { DemoSite } from "./demo-site";
import { LegacyDemoPreview } from "./legacy-demo-preview";

export function DemoPreview() {
  const [state, setState] = useState<{ loaded: boolean; doc: ReturnType<typeof parseDemoDocument> }>({ loaded: false, doc: null });
  useEffect(() => {
    const read = () => setState({ loaded: true, doc: parseDemoDocument(window.location.hash) });
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  if (!state.loaded) return <p role="status" className="p-8 text-center text-ink-soft">Preparando a demonstração…</p>;
  if (!state.doc) return <div className="mx-auto max-w-lg py-20 text-center"><h1 className="text-xl font-semibold text-ink">Prévia indisponível</h1><p className="mt-3 text-ink-soft">O link está incompleto ou é inválido. Abra novamente pela ficha do lead no Sellora.</p></div>;
  return state.doc.version === 1 ? <LegacyDemoPreview /> : <DemoSite business={state.doc.business} />;
}
