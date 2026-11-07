import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-balance text-[22px] leading-tight font-bold tracking-[-0.02em] text-ink sm:text-[24px]">{title}</h1>
        {description && <p className="mt-1 text-[13px] text-ink-faint">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Ícone em tile (padrão das listas das referências). */
export function IconTile({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={`tile grid size-9 shrink-0 place-items-center text-ink-soft [&_svg]:size-[17px] ${className}`}>{children}</span>;
}
