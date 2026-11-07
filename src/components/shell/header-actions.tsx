"use client";

import { Bell, ChevronDown, Download, LogOut, RotateCcw, Search, Settings } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ConfirmDialog, Menu, Popover, Tooltip } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { tone } from "@/lib/constants";
import { signOut } from "@/lib/auth/actions";
import { exportDatabase, resetDemoData } from "@/lib/data/repository";
import { useStore } from "@/lib/data/store";
import { nextActions } from "@/lib/metrics/home";
import { cn } from "@/lib/utils";

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
