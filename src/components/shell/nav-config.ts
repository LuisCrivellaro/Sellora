import { FileText, FolderKanban, LayoutDashboard, Settings, Store, UsersRound, Wallet, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard, description: "Visão executiva da operação" },
  { href: "/leads", label: "Leads", icon: UsersRound, description: "CRM, funil e pipeline" },
  { href: "/clientes", label: "Clientes", icon: Store, description: "Clientes convertidos e atendimento" },
  { href: "/projetos", label: "Projetos", icon: FolderKanban, description: "Produção e entrega dos sites" },
  { href: "/propostas", label: "Propostas", icon: FileText, description: "Propostas comerciais" },
  { href: "/financeiro", label: "Financeiro", icon: Wallet, description: "Contratos, recebimentos e custos" },
  { href: "/configuracoes", label: "Configurações", icon: Settings, description: "Perfil, aparência, pacotes e integrações" },
];

export function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
