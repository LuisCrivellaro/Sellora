"use client";

import { AnimatePresence, motion } from "motion/react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  title: string;
  description?: ReactNode;
}

const ToastCtx = createContext<{ notify: (t: Omit<ToastItem, "id">) => void } | null>(null);

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast fora do ToastProvider");
  return ctx;
}

/** Toasts não roubam foco; anunciados por aria-live. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const notify = useCallback(
    (t: Omit<ToastItem, "id">) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      window.setTimeout(() => dismiss(id), t.kind === "error" ? 7000 : 4200);
    },
    [dismiss],
  );
  const value = useMemo(() => ({ notify }), [notify]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed right-3 bottom-3 z-[90] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="facade pointer-events-auto flex items-start gap-3 border-seam-strong bg-facade-raised px-4 py-3"
            >
              {t.kind === "error" ? (
                <CircleAlert className="mt-0.5 size-4.5 shrink-0 text-danger" aria-hidden />
              ) : (
                <CircleCheck className={cn("mt-0.5 size-4.5 shrink-0", t.kind === "success" ? "text-mint" : "text-lilac")} aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-semibold text-ink">{t.title}</p>
                {t.description && <p className="mt-0.5 text-[12.5px] text-ink-soft">{t.description}</p>}
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="grid size-6 place-items-center rounded-full text-ink-faint hover:bg-white/[0.06] hover:text-ink" aria-label="Dispensar aviso">
                <X className="size-3.5" aria-hidden />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}
