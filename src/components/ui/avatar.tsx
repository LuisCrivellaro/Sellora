import { cn, initials } from "@/lib/utils";

const GRADIENTS = [
  "linear-gradient(135deg,#bb6ba5,#8866bd)",
  "linear-gradient(135deg,#8866bd,#7473c4)",
  "linear-gradient(135deg,#5fbf9f,#7473c4)",
  "linear-gradient(135deg,#d8a75a,#bb6ba5)",
  "linear-gradient(135deg,#a891d1,#5fbf9f)",
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
