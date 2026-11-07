"use client";

import { Dialog } from "radix-ui";
import { Bell, ChevronDown, Download, LogOut, Menu as MenuIcon, RotateCcw, Search, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { DemoBadge } from "@/components/ui/badge";
import { ConfirmDialog, Menu, Popover, Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { tone } from "@/lib/constants";
import { signOut } from "@/lib/auth/actions";
import { exportDatabase, resetDemoData } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { nextActions } from "@/lib/metrics/home";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { isActive, NAV_ITEMS } from "./nav-config";

const circleBtn =
  "grid size-10 place-items-center rounded-full text-ink-soft transition-colors duration-150 hover:bg-white/[0.06] hover:text-ink";

export function SearchButton({ onOpen }: { onOpen: () => void }) {
  return (
    <Tooltip content="Busca global (Ctrl + K)">
      <button type="button" onClick={onOpen} className={cn("pill-group", circleBtn, "size-11")} aria-label="Abrir busca global" aria-keyshortcuts="Control+K Meta+K">
        <Search className="size-[18px]" strokeWidth={1.8} aria-hidden />
      </button>
    </Tooltip>
  );
}

export function NotificationsButton() {
  const { db } = useStore();
  const items = useMemo(() => (db ? nextActions(db).filter((a) => a.count > 0) : []), [db]);
  const urgent = items.filter((i) => i.tone === "danger" || i.key === "sem_contato" || i.key === "follow_ups").reduce((s, i) => s + i.count, 0);
  return (
    <Popover
      className="w-[min(340px,calc(100vw-24px))]"
      trigger={
        <button type="button" className={cn(circleBtn, "relative")} aria-label={`Notificações${urgent ? `: ${urgent} itens pedem atenção` : ""}`}>
          <Bell className="size-[18px]" strokeWidth={1.8} aria-hidden />
          {urgent > 0 && <span className="absolute top-2 right-2.5 size-2 rounded-full bg-magenta shadow-[0_0_8px_var(--neon-magenta)]" aria-hidden />}
        </button>
      }
    >
      <p className="px-1 text-[13.5px] font-semibold text-ink">Pendências</p>
      <p className="px-1 text-[12px] text-ink-faint">Geradas a partir dos seus registros.</p>
      {items.length === 0 ? (
        <p className="px-1 py-4 text-[13px] text-ink-soft">Nada pendente agora.</p>
      ) : (
        <ul className="mt-2 flex flex-col gap-0.5">
          {items.map((i) => (
            <li key={i.key}>
              <Link href={i.href} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.05]">
                <span className="size-2 rounded-full" style={{ background: tone[i.tone], boxShadow: `0 0 8px ${tone[i.tone]}` }} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] text-ink">{i.label}</span>
                  <span className="block text-[11.5px] text-ink-faint">{i.hint}</span>
                </span>
                <span className="tnum text-[14px] font-bold text-ink">{i.count}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Popover>
  );
}

export function UserMenu() {
  const { db, mode, account, sync } = useStore();
  const router = useRouter();
  const { notify } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const remote = mode === "supabase";
  const name = db?.settings.profile.name ?? "Administrador";
  const role = db?.settings.profile.role || "Administrador";

  const download = () => {
    const blob = new Blob([exportDatabase()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sellora-dados-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify({ kind: "success", title: "Arquivo gerado", description: remote ? "Cópia dos dados do banco em JSON." : "Cópia dos dados deste navegador em JSON." });
  };

  const leave = async () => {
    if (sync.pending > 0) {
      notify({ kind: "error", title: "Ainda há alterações não salvas", description: "Aguarde salvar ou resolva o aviso no topo antes de sair." });
      return;
    }
    setLeaving(true);
    try {
      const res = await signOut();
      if (res.ok) {
        // Recarga completa: limpa os dados desta sessão da memória do navegador.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarga completa proposital: limpa os dados da sessão da memória
        window.location.assign("/entrar");
        return;
      }
      notify({ kind: "error", title: "Não foi possível sair", description: res.message });
    } catch {
      notify({ kind: "error", title: "Não foi possível sair", description: "Sem resposta do servidor. Tente novamente." });
    }
    setLeaving(false);
  };

  const heading = remote ? `Conectado · ${account?.email || "sessão ativa"}` : db?.demo ? "Modo demonstração · sem login" : "Dados locais · sem login";

  return (
    <>
      <Menu
        label="Menu do usuário"
        trigger={
          <button type="button" className="pill-group flex h-12 items-center gap-2.5 py-1 pr-3 pl-1 text-left hover:border-seam-strong" aria-label={`Menu do usuário: ${name}`}>
            <Avatar name={name} size={38} />
            <span className="hidden min-w-0 lg:block">
              <span className="block max-w-[140px] truncate text-[13.5px] font-semibold text-ink">{name}</span>
              <span className="block text-[11.5px] text-ink-faint">{role}</span>
            </span>
            <ChevronDown className="size-4 text-ink-soft" aria-hidden />
          </button>
        }
        items={[
          { heading },
          { label: "Perfil e preferências", icon: <Settings />, onSelect: () => router.push("/configuracoes") },
          { label: "Exportar dados (JSON)", icon: <Download />, onSelect: download },
          "separator",
          remote
            ? { label: leaving ? "Saindo…" : "Sair", icon: <LogOut />, onSelect: () => void leave() }
            : { label: "Restaurar dados de demonstração", icon: <RotateCcw />, onSelect: () => setConfirmReset(true), destructive: true },
        ]}
      />
      {!remote && (
        <ConfirmDialog
          open={confirmReset}
          onOpenChange={setConfirmReset}
          title="Restaurar dados de demonstração?"
          description="Todos os registros deste navegador serão substituídos pelos dados fictícios iniciais. Suas configurações são mantidas. Esta ação não pode ser desfeita."
          confirmLabel="Restaurar demonstração"
          onConfirm={() => {
            resetDemoData();
            notify({ kind: "success", title: "Demonstração restaurada" });
          }}
        />
      )}
    </>
  );
}

export function SettingsShortcut() {
  return (
    <Tooltip content="Configurações">
      <Link href="/configuracoes" className={circleBtn} aria-label="Configurações">
        <Settings className="size-[18px]" strokeWidth={1.8} aria-hidden />
      </Link>
    </Tooltip>
  );
}

/** Menu compacto (< 768px) com acesso às 7 páginas. */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { db, mode } = useStore();
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={cn("pill-group md:hidden", circleBtn, "size-11")} aria-label="Abrir menu de navegação">
          <MenuIcon className="size-5" aria-hidden />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_var(--ease-out)]" />
        <Dialog.Content className="facade fixed inset-x-2 top-2 z-[70] p-3 outline-none data-[state=open]:animate-[pop-in_200ms_var(--ease-out)]">
          <div className="flex items-center justify-between px-2 pb-2">
            <Dialog.Title className="flex items-center gap-2 text-[15px] font-bold text-ink">
              <LogoMark className="size-5" /> Sellora
            </Dialog.Title>
            <div className="flex items-center gap-2">
              {db && <DemoBadge demo={db.demo} remote={mode === "supabase"} />}
              <Dialog.Close className={circleBtn} aria-label="Fechar menu">
                <X className="size-5" aria-hidden />
              </Dialog.Close>
            </div>
          </div>
          <Dialog.Description className="sr-only">Navegação principal</Dialog.Description>
          <nav aria-label="Principal (móvel)">
            <ul className="grid grid-cols-1 gap-1 min-[420px]:grid-cols-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn("flex min-h-12 items-center gap-3 rounded-2xl px-3.5 text-[14px] font-semibold", active ? "pill-active text-ink" : "text-ink-soft hover:bg-white/[0.04]")}
                    >
                      <Icon className="size-[18px]" strokeWidth={1.8} aria-hidden />
                      <span>
                        {item.label}
                        <span className="block text-[11.5px] font-normal text-ink-faint">{item.description}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
