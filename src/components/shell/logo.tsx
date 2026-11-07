"use client";

import Link from "next/link";
import { useId } from "react";
import { cn } from "@/lib/utils";

/** Marca Sellora: "S" em neon dentro de uma vitrine (tile). Desenho próprio. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden>
      <defs>
        <linearGradient id={`${id}-mark`} x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--brand-start)" />
          <stop offset="1" stopColor="var(--brand-end)" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="1.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path
        d="M23 9.5c-1.6-1.7-4-2.6-6.6-2.6-3.9 0-6.6 2-6.6 4.9 0 6.4 13.4 3.6 13.4 10.2 0 3.1-2.9 5.1-7 5.1-2.8 0-5.4-1-7.2-2.9"
        fill="none"
        stroke={`url(#${id}-mark)`}
        strokeWidth="3.4"
        strokeLinecap="round"
        filter={`url(#${id}-glow)`}
      />
      <circle cx="24.6" cy="24.8" r="1.9" fill="var(--brand-dot)" />
    </svg>
  );
}

export function Logo({ compact = false, onNavigate }: { compact?: boolean; onNavigate?: () => void }) {
  return (
    <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 rounded-2xl" aria-label="Sellora — ir para a Home" onClick={onNavigate}>
      <span className="tile grid size-11 place-items-center rounded-2xl border-seam-strong shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        <LogoMark />
      </span>
      {!compact && <span className="text-[19px] font-extrabold tracking-[-0.02em] text-ink">Sellora</span>}
    </Link>
  );
}
