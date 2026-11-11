"use client";

import { AlertDialog, Dialog, DropdownMenu, Popover as RPopover, Tooltip as RTooltip } from "radix-ui";
import { X } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

const overlayCls =
  "fixed inset-0 z-[60] bg-[var(--overlay)] backdrop-blur-[3px] data-[state=open]:animate-[fade-in_180ms_var(--ease-out)] data-[state=closed]:animate-[fade-out_120ms_var(--ease-in)]";

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg" | "xl";
  /** "sheet" = painel lateral (detalhes); "dialog" = centralizado (formulários). */
  variant?: "dialog" | "sheet" | "workspace";
}

export function Modal({ open, onOpenChange, title, description, children, footer, size = "md", variant = "dialog" }: ModalProps) {
  const widths = { md: "sm:max-w-[560px]", lg: "sm:max-w-[760px]", xl: "sm:max-w-[960px]" };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlayCls} />
        <Dialog.Content
          className={cn(
            "facade fixed z-[70] flex flex-col overflow-hidden border-seam-strong bg-facade outline-none",
            variant === "dialog"
              ? cn(
                  "inset-x-3 bottom-3 max-h-[calc(100dvh-24px)] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[calc(100vw-48px)] sm:-translate-x-1/2 sm:-translate-y-1/2",
                  widths[size],
                  "data-[state=open]:animate-[dialog-in_220ms_var(--ease-out)] data-[state=closed]:animate-[fade-out_120ms_var(--ease-in)]",
                )
              : variant === "workspace" ? "inset-2 h-[calc(100dvh-16px)] sm:inset-4 sm:h-[calc(100dvh-32px)]" : cn(
                  "inset-y-2 right-2 left-2 sm:left-auto sm:w-[min(640px,calc(100vw-24px))]",
                  size === "xl" && "sm:w-[min(820px,calc(100vw-24px))]",
                  "data-[state=open]:animate-[sheet-in_260ms_var(--ease-out)] data-[state=closed]:animate-[sheet-out_160ms_var(--ease-in)]",
                ),
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-seam px-5 py-4">
            <div className="min-w-0">
              <Dialog.Title className="text-[17px] font-bold tracking-[-0.01em] text-ink">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-[13px] text-ink-faint">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Fechar">
                <X aria-hidden />
              </Button>
            </Dialog.Close>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
          {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-seam bg-black/10 px-5 py-3.5">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface ConfirmProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}

/** Confirmação proporcional ao risco: foco inicial em "Cancelar". */
export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel, onConfirm, destructive = true }: ConfirmProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className={overlayCls} />
        <AlertDialog.Content className="facade fixed inset-x-3 bottom-3 z-[70] border-seam-strong p-5 outline-none data-[state=open]:animate-[dialog-in_200ms_var(--ease-out)] sm:inset-auto sm:top-1/2 sm:left-1/2 sm:w-[440px] sm:-translate-x-1/2 sm:-translate-y-1/2">
          <AlertDialog.Title className="text-[16px] font-bold text-ink">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-[13.5px] leading-relaxed text-ink-soft">{description}</AlertDialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary">Cancelar</Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

const floatingCls =
  "z-[80] rounded-2xl border border-seam-strong bg-facade-raised shadow-[0_18px_50px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] outline-none data-[state=open]:animate-[pop-in_160ms_var(--ease-out)] data-[state=closed]:animate-[fade-out_100ms_var(--ease-in)]";

export function Popover({
  trigger,
  children,
  align = "end",
  className,
  open,
  onOpenChange,
}: {
  trigger: ReactNode;
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <RPopover.Root open={open} onOpenChange={onOpenChange}>
      <RPopover.Trigger asChild>{trigger}</RPopover.Trigger>
      <RPopover.Portal>
        <RPopover.Content align={align} sideOffset={8} collisionPadding={12} className={cn(floatingCls, "p-3", className)}>
          {children}
        </RPopover.Content>
      </RPopover.Portal>
    </RPopover.Root>
  );
}

export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export function Menu({
  trigger,
  items,
  label,
  align = "end",
}: {
  trigger: ReactNode;
  items: (MenuItem | "separator" | { heading: string })[];
  label?: string;
  align?: "start" | "end";
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={6} collisionPadding={12} aria-label={label} className={cn(floatingCls, "min-w-[200px] p-1")}>
          {items.map((item, i) =>
            item === "separator" ? (
              <DropdownMenu.Separator key={i} className="my-1 h-px bg-seam" />
            ) : "heading" in item ? (
              <DropdownMenu.Label key={i} className="px-3 pt-2 pb-1 text-[11.5px] font-semibold text-ink-faint">
                {item.heading}
              </DropdownMenu.Label>
            ) : (
              <DropdownMenu.Item
                key={i}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(
                  "flex h-9 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-[13.5px] outline-none select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40 data-[highlighted]:bg-white/[0.06] [&_svg]:size-4",
                  item.destructive ? "text-danger" : "text-ink-soft data-[highlighted]:text-ink",
                )}
              >
                {item.icon}
                {item.label}
              </DropdownMenu.Item>
            ),
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export function Tooltip({ content, children, side = "top" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <RTooltip.Root delayDuration={250}>
      <RTooltip.Trigger asChild>{children}</RTooltip.Trigger>
      <RTooltip.Portal>
        <RTooltip.Content side={side} sideOffset={6} collisionPadding={10} className={cn(floatingCls, "max-w-[260px] rounded-xl px-2.5 py-1.5 text-[12px] text-ink-soft")}>
          {content}
        </RTooltip.Content>
      </RTooltip.Portal>
    </RTooltip.Root>
  );
}

export const TooltipProvider = RTooltip.Provider;
