import { cn, initials } from "@/lib/utils";

const GRADIENTS = [
  "linear-gradient(135deg,#f230d6,#8f4bff)",
  "linear-gradient(135deg,#8f4bff,#6f6cff)",
  "linear-gradient(135deg,#1de9b6,#6f6cff)",
  "linear-gradient(135deg,#f6b54a,#f230d6)",
  "linear-gradient(135deg,#b48cff,#1de9b6)",
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
