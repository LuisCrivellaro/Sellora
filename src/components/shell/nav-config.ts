import type { IconSvgElement } from "@hugeicons/react";
import DashboardSquare01Icon from "@hugeicons/core-free-icons/DashboardSquare01Icon";
import UserGroupIcon from "@hugeicons/core-free-icons/UserGroupIcon";
import Store01Icon from "@hugeicons/core-free-icons/Store01Icon";
import FolderLibraryIcon from "@hugeicons/core-free-icons/FolderLibraryIcon";
import File01Icon from "@hugeicons/core-free-icons/File01Icon";
import Wallet01Icon from "@hugeicons/core-free-icons/Wallet01Icon";
import Settings02Icon from "@hugeicons/core-free-icons/Settings02Icon";
import CubeIcon from "@hugeicons/core-free-icons/CubeIcon";

export interface NavItem {
  href: string;
  label: string;
  icon: IconSvgElement;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: DashboardSquare01Icon, description: "Visão executiva da operação" },
  { href: "/dashboard/cloud-3d", label: "Cloud 3D", icon: CubeIcon, description: "Agentes de IA em execução, com estados reais" },
  { href: "/leads", label: "Leads", icon: UserGroupIcon, description: "CRM, funil e pipeline" },
  { href: "/clientes", label: "Clientes", icon: Store01Icon, description: "Clientes convertidos e atendimento" },
  { href: "/projetos", label: "Projetos", icon: FolderLibraryIcon, description: "Produção e entrega dos sites" },
  { href: "/propostas", label: "Propostas", icon: File01Icon, description: "Propostas comerciais" },
  { href: "/financeiro", label: "Financeiro", icon: Wallet01Icon, description: "Contratos, recebimentos e custos" },
  { href: "/configuracoes", label: "Configurações", icon: Settings02Icon, description: "Perfil, aparência, pacotes e integrações" },
];

export const NAV_SECTIONS = [
  { label: "Visão geral", items: NAV_ITEMS.slice(0, 2) },
  { label: "Comercial", items: NAV_ITEMS.slice(2, 6) },
  { label: "Gestão", items: NAV_ITEMS.slice(6) },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Item ativo = o de caminho mais longo que casa (em /dashboard/cloud-3d, Cloud 3D e não Home). */
export function findActiveItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.filter((item) => isActive(pathname, item.href)).sort((a, b) => b.href.length - a.href.length)[0];
}
