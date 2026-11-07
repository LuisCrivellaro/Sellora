import { cn, initials } from "@/lib/utils";

const GRADIENTS = [
  "linear-gradient(135deg,var(--avatar-1),var(--avatar-2))",
  "linear-gradient(135deg,var(--avatar-2),var(--avatar-4))",
  "linear-gradient(135deg,var(--avatar-3),var(--avatar-2))",
  "linear-gradient(135deg,var(--avatar-4),var(--avatar-1))",
  "linear-gradient(135deg,var(--avatar-1),var(--avatar-3))",
];

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Monograma do estabelecimento (sem fotos de pessoas reais). */
export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full font-bold text-white ring-1 ring-white/15", className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), background: GRADIENTS[hash(name) % GRADIENTS.length] }}
    >
      {initials(name)}
    </span>
  );
}
