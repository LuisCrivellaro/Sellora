import Link from "next/link";
import { cn } from "@/lib/utils";

/** Marca Sellora: "S" em neon dentro de uma vitrine (tile). Desenho próprio. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6", className)} aria-hidden>
      <defs>
        <linearGradient id="sellora-mark" x1="4" y1="4" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#c97cb5" />
          <stop offset="1" stopColor="#8866bd" />
        </linearGradient>
        <filter id="sellora-glow" x="-30%" y="-30%" width="160%" height="160%">
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
        stroke="url(#sellora-mark)"
        strokeWidth="3.4"
        strokeLinecap="round"
        filter="url(#sellora-glow)"
      />
      <circle cx="24.6" cy="24.8" r="1.9" fill="#5fbf9f" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 rounded-2xl" aria-label="Sellora — ir para a Home">
      <span className="tile grid size-11 place-items-center rounded-2xl border-[rgba(190,165,220,0.28)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_0_12px_-8px_rgba(187,107,165,0.35)]">
        <LogoMark />
      </span>
      <span className="hidden text-[17px] font-extrabold tracking-[-0.02em] text-ink 3xl:inline">Sellora</span>
    </Link>
  );
}
