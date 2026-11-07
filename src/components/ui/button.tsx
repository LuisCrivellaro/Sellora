"use client";

import { Slot } from "radix-ui";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "icon" | "icon-sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  asChild?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    "text-white border border-[rgba(190,170,220,0.45)] bg-[linear-gradient(180deg,#7a5bb0_0%,#644a99_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_0_14px_-6px_rgba(136,102,189,0.45)] hover:brightness-110",
  secondary: "pill-group text-ink hover:bg-facade-hover hover:border-seam-strong",
  outline: "border border-seam-strong text-ink hover:border-seam-lit hover:bg-white/[0.03]",
  ghost: "text-ink-soft hover:text-ink hover:bg-white/[0.05]",
  danger:
    "text-white border border-[rgba(255,120,150,0.5)] bg-[linear-gradient(180deg,#ff5d7d,#d83a5c)] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3.5 text-[13px] gap-1.5",
  md: "h-10 px-4.5 text-[13.5px] gap-2",
  icon: "size-10 justify-center",
  "icon-sm": "size-8 justify-center",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, asChild = false, className, children, disabled, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Comp
      ref={ref}
      className={cn(
        "inline-flex shrink-0 select-none items-center rounded-full font-semibold whitespace-nowrap transition-[filter,background-color,border-color,color,transform] duration-150 ease-out active:scale-[0.97] disabled:opacity-45 disabled:active:scale-100 [&_svg]:size-4 [&_svg]:shrink-0",
        variants[variant],
        sizes[size],
        className,
      )}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden />}
          {children}
        </>
      )}
    </Comp>
  );
});
