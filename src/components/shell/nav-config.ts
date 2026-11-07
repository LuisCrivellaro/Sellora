import type { IconSvgElement } from "@hugeicons/react";
import DashboardSquare01Icon from "@hugeicons/core-free-icons/DashboardSquare01Icon";
import UserGroupIcon from "@hugeicons/core-free-icons/UserGroupIcon";
import Store01Icon from "@hugeicons/core-free-icons/Store01Icon";
import FolderLibraryIcon from "@hugeicons/core-free-icons/FolderLibraryIcon";
import File01Icon from "@hugeicons/core-free-icons/File01Icon";
import Wallet01Icon from "@hugeicons/core-free-icons/Wallet01Icon";
import Settings02Icon from "@hugeicons/core-free-icons/Settings02Icon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconSvgElement;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: DashboardSquare01Icon, description: "Visão executiva da operação" },
  { href: "/leads", label: "Leads", icon: UserGroupIcon, description: "CRM, funil e pipeline" },
  { href: "/clientes", label: "Clientes", icon: Store01Icon, description: "Clientes convertidos e atendimento" },
  { href: "/projetos", label: "Projetos", icon: FolderLibraryIcon, description: "Produção e entrega dos sites" },
  { href: "/propostas", label: "Propostas", icon: File01Icon, description: "Propostas comerciais" },
  { href: "/financeiro", label: "Financeiro", icon: Wallet01Icon, description: "Contratos, recebimentos e custos" },
  { href: "/configuracoes", label: "Configurações", icon: Settings02Icon, description: "Perfil, aparência, pacotes e integrações" },
];

export const NAV_SECTIONS = [
  { label: "Visão geral", items: NAV_ITEMS.slice(0, 1) },
  { label: "Comercial", items: NAV_ITEMS.slice(1, 5) },
  { label: "Gestão", items: NAV_ITEMS.slice(5) },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
