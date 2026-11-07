"use client";

import { Dialog } from "radix-ui";
import { Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { DemoBadge } from "@/components/ui/badge";
import { useStore } from "@/lib/data/store";
import BranchedMenu from "./branched-menu";
import { Logo } from "./logo";
import { isActive, NAV_ITEMS, NAV_SECTIONS } from "./nav-config";
import "./sidebar.css";

const MENU_ITEMS = NAV_SECTIONS.map((section) => ({
  label: section.label,
  children: section.items.map((item) => ({ value: item.href, label: item.label, icon: item.icon })),
}));
const TABLET_QUERY = "(min-width: 768px) and (max-width: 1024px)";
const subscribeTablet = (onChange: () => void) => {
  const media = window.matchMedia(TABLET_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
};
const getTablet = () => window.matchMedia(TABLET_QUERY).matches;
const getServerTablet = () => false;

function SidebarMenu({ compact = false, onSelect }: { compact?: boolean; onSelect?: () => void }) {
  const pathname = usePathname();
  const active = NAV_ITEMS.find((item) => isActive(pathname, item.href))?.href ?? "";
  return <BranchedMenu items={MENU_ITEMS} activeValue={active} compact={compact} onSelect={onSelect} />;
}

export function SidebarTrigger() {
  return (
    <Dialog.Trigger asChild>
      <button type="button" className="sidebar-mobile-trigger pill-group" aria-label="Abrir menu de navegação">
        <Menu size={20} aria-hidden="true" />
      </button>
    </Dialog.Trigger>
  );
}

/** Um menu compartilhado por todas as páginas; o drawer reutiliza o mesmo conteúdo. */
export function Sidebar({ expanded, onExpandedChange, onDrawerClose }: {
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onDrawerClose: () => void;
}) {
  const tablet = useSyncExternalStore(subscribeTablet, getTablet, getServerTablet);
  const compact = tablet && !expanded;
  const navigating = useRef(false);
  const { db, mode } = useStore();

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (media.matches) onDrawerClose(); };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, [onDrawerClose]);

  const closeAfterNavigation = () => {
    navigating.current = true;
    onDrawerClose();
  };

  return (
    <>
      <aside className="sellora-sidebar" data-compact={compact ? "" : undefined} aria-label="Navegação lateral">
        <div className="sidebar-brand"><Logo compact={compact} /></div>
        <div className="sidebar-scroll"><SidebarMenu compact={compact} /></div>
        <div className="sidebar-bottom">
          {!compact && <div className="sidebar-status">{db && <DemoBadge demo={db.demo} remote={mode === "supabase"} />}</div>}
          <button
            type="button"
            className="sidebar-collapse"
            aria-label={expanded ? "Recolher menu lateral" : "Expandir menu lateral"}
            aria-expanded={expanded}
            title={expanded ? "Recolher menu lateral" : "Expandir menu lateral"}
            onClick={() => onExpandedChange(!expanded)}
          >
            {expanded ? <PanelLeftClose size={19} aria-hidden="true" /> : <PanelLeftOpen size={19} aria-hidden="true" />}
            {!compact && <span>Recolher menu</span>}
          </button>
        </div>
      </aside>

      <Dialog.Portal>
        <Dialog.Overlay className="sidebar-overlay" />
        <Dialog.Content
          className="sidebar-drawer"
          onCloseAutoFocus={(event) => {
            if (!navigating.current) return;
            event.preventDefault();
            navigating.current = false;
            document.getElementById("conteudo")?.focus({ preventScroll: true });
          }}
        >
          <Dialog.Title className="sr-only">Menu do Sellora</Dialog.Title>
          <Dialog.Description className="sr-only">Navegue pelas páginas de visão geral, comercial e gestão.</Dialog.Description>
          <div className="sidebar-drawer-brand">
            <Logo onNavigate={closeAfterNavigation} />
            <Dialog.Close className="sidebar-close" aria-label="Fechar menu de navegação"><X size={20} aria-hidden="true" /></Dialog.Close>
          </div>
          <div className="sidebar-scroll"><SidebarMenu onSelect={closeAfterNavigation} /></div>
          <div className="sidebar-status">{db && <DemoBadge demo={db.demo} remote={mode === "supabase"} />}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </>
  );
}
