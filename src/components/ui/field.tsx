"use client";

import { Select as RSelect } from "radix-ui";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Label persistente acima do campo; erro e dica associados por aria-describedby. */
export function Field({ label, error, hint, optional, className, children }: FieldProps) {
  const id = useId();
  const describedBy = [error ? `${id}-err` : null, hint ? `${id}-hint` : null].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[12.5px] font-semibold text-ink-soft">
        {label}
        {optional && <span className="ml-1 font-normal text-ink-faint">(opcional)</span>}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-[12px] text-ink-faint">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} role="alert" className="text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...props }, ref) {
  return <input ref={ref} className={cn("inset-field h-10 w-full px-3.5 text-[14px] text-ink placeholder:text-ink-faint", className)} {...props} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn("inset-field min-h-[88px] w-full resize-y px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint", className)} {...props} />;
});

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

interface SelectProps<T extends string> {
  id?: string;
  value: T;
  onValueChange: (v: T) => void;
  options: Option<T>[];
  placeholder?: string;
  className?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  "aria-label"?: string;
  size?: "sm" | "md";
}

/** Select estilizado (Radix): teclado, leitor de tela e foco tratados. */
export function Select<T extends string>({ id, value, onValueChange, options, placeholder, className, size = "md", ...aria }: SelectProps<T>) {
  return (
    <RSelect.Root value={value} onValueChange={(v) => onValueChange(v as T)}>
      <RSelect.Trigger
        id={id}
        {...aria}
        className={cn(
          "inset-field flex w-full items-center justify-between gap-2 text-left text-ink data-[placeholder]:text-ink-faint",
          size === "sm" ? "h-8 rounded-full px-3 text-[12.5px]" : "h-10 px-3.5 text-[14px]",
          className,
        )}
      >
        <RSelect.Value placeholder={placeholder} />
        <RSelect.Icon>
          <ChevronDown className="size-4 text-ink-faint" aria-hidden />
        </RSelect.Icon>
      </RSelect.Trigger>
      <RSelect.Portal>
        <RSelect.Content
          position="popper"
          sideOffset={6}
          className="z-[80] max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-2xl border border-seam-strong bg-facade-raised p-1 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.9)] data-[state=open]:animate-[pop-in_160ms_var(--ease-out)]"
        >
          <RSelect.Viewport>
            {options.map((o) => (
              <RSelect.Item
                key={o.value}
                value={o.value}
                className="relative flex h-9 cursor-pointer items-center rounded-xl pr-8 pl-3 text-[13.5px] text-ink-soft outline-none select-none data-[highlighted]:bg-white/[0.06] data-[highlighted]:text-ink data-[state=checked]:text-ink"
              >
                <RSelect.ItemText>{o.label}</RSelect.ItemText>
                <RSelect.ItemIndicator className="absolute right-2.5">
                  <Check className="size-4 text-lilac" aria-hidden />
                </RSelect.ItemIndicator>
              </RSelect.Item>
            ))}
          </RSelect.Viewport>
        </RSelect.Content>
      </RSelect.Portal>
    </RSelect.Root>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Buscar…",
  label,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("inset-field flex h-10 items-center gap-2 rounded-full pr-1.5 pl-3.5", className)}>
      <Search className="size-4 shrink-0 text-ink-faint" aria-hidden />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button type="button" onClick={() => onChange("")} className="grid size-7 place-items-center rounded-full text-ink-faint hover:bg-white/[0.06] hover:text-ink" aria-label="Limpar busca">
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
