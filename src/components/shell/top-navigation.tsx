"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS } from "./nav-config";

/**
 * Navegação principal em pill. O indicador ativo desliza entre itens (shared
 * layout) e fica sincronizado com a rota. Em larguras intermediárias o grupo
 * rola horizontalmente; o item ativo é mantido visível.
 */
export function TopNavigation() {
  const pathname = usePathname();
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>("[aria-current=page]");
    active?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [pathname]);

  return (
    <nav aria-label="Principal" className="hidden min-w-0 flex-1 md:flex">
      <div className="pill-group relative min-w-0 max-w-full p-1">
        <ul
          ref={listRef}
          className="flex min-w-0 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ maskImage: "linear-gradient(90deg, transparent 0, #000 12px, #000 calc(100% - 12px), transparent 100%)" }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-inset relative isolate flex h-10 items-center gap-2 rounded-full px-4 text-[13.5px] font-semibold transition-colors duration-150",
                    active ? "text-ink" : "text-ink-soft hover:bg-white/[0.04] hover:text-ink",
                  )}
                >
                  {active && <motion.span layoutId="nav-active" className="pill-active absolute inset-0 -z-10" transition={{ type: "spring", stiffness: 420, damping: 38 }} />}
                  <Icon className="size-[17px] shrink-0" strokeWidth={1.8} aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
