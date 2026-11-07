/** Entidades do domínio Sellora. Datas em ISO 8601 (string) para serialização simples. */

export type ID = string;

export type LeadSource = "google_maps" | "instagram" | "indicacao" | "manual" | "outros";

export type LeadStage =
  | "novo"
  | "qualificado"
  | "contatado"
  | "respondeu"
  | "diagnostico"
  | "proposta"
  | "negociacao"
  | "ganho"
  | "perdido";

export type Priority = "baixa" | "media" | "alta";

export type WebsiteSituation = "sem_site" | "desatualizado" | "sem_mobile" | "adequado";

/** Temperatura é derivada da etapa (ver lib/metrics/leads.ts), nunca digitada. */
export type LeadTemperature = "frio" | "morno" | "quente" | "convertido";

export type Segment = "restaurantes" | "saude" | "beleza" | "servicos" | "comercio" | "outros";

export interface Lead {
  id: ID;
  name: string;
  segment: Segment;
  city: string;
  uf: string;
  source: LeadSource;
  website: string | null;
  websiteSituation: WebsiteSituation;
  stage: LeadStage;
  priority: Priority;
  phone: string;
  email: string;
  instagram: string;
  potentialValue: number;
  lastContactAt: string | null;
  nextAction: string;
  nextActionAt: string | null;
  notes: string;
  clientId: ID | null;
  lostReason: string;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = "ligacao" | "whatsapp" | "email" | "visita" | "reuniao" | "nota" | "follow_up" | "etapa";

export interface Activity {
  id: ID;
  leadId: ID | null;
  clientId: ID | null;
  projectId: ID | null;
  type: ActivityType;
  description: string;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export type ClientStatus = "ativo" | "aguardando_cliente" | "pausado" | "encerrado";

export interface Client {
  id: ID;
  leadId: ID | null;
  name: string;
  segment: Segment;
  city: string;
  uf: string;
  contactName: string;
  phone: string;
  email: string;
  status: ClientStatus;
  siteUrl: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type ProjectStage = "briefing" | "design" | "desenvolvimento" | "revisao" | "publicacao" | "entrega";

export type SiteType = "landing" | "institucional" | "personalizado";

export interface ProjectTask {
  id: ID;
  title: string;
  stage: ProjectStage;
  done: boolean;
  doneAt: string | null;
}

export interface Project {
  id: ID;
  clientId: ID;
  proposalId: ID | null;
  title: string;
  siteType: SiteType;
  stage: ProjectStage;
  startDate: string;
  dueDate: string;
  contractValue: number;
  tasks: ProjectTask[];
  previewUrl: string;
  publishedUrl: string;
  publishedAt: string | null;
  deliveredAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

/** Status derivado de etapa + progresso (lib/metrics/projects.ts). */
export type ProjectStatus = "nao_iniciado" | "em_desenvolvimento" | "em_revisao" | "concluido";

export type PackageId = "essencial" | "profissional" | "personalizado";

export interface ProposalItem {
  id: ID;
  description: string;
  quantity: number;
  unitPrice: number;
}

export type ProposalStatus = "rascunho" | "enviada" | "negociacao" | "aprovada" | "recusada";

export interface Proposal {
  id: ID;
  leadId: ID | null;
  clientId: ID | null;
  recipientName: string;
  title: string;
  packageId: PackageId;
  items: ProposalItem[];
  discount: number;
  deadlineDays: number;
  revisions: number;
  paymentTerms: string;
  exclusions: string;
  validUntil: string;
  status: ProposalStatus;
  sentAt: string | null;
  decidedAt: string | null;
  nextAction: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionKind = "receita" | "custo";

export interface Payment {
  id: ID;
  amount: number;
  date: string;
  note: string;
}

export interface Transaction {
  id: ID;
  kind: TransactionKind;
  clientId: ID | null;
  projectId: ID | null;
  description: string;
  amount: number;
  dueDate: string;
  payments: Payment[];
  cancelled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Derivado: pago | parcial | vencido | a_receber | cancelado */
export type TransactionStatus = "pago" | "parcial" | "vencido" | "a_receber" | "cancelado";

export interface PackageConfig {
  id: PackageId;
  name: string;
  price: number;
  description: string;
}

export type MotionPreference = "system" | "full" | "reduced";
export type Density = "confortavel" | "compacta";

export interface Settings {
  profile: { name: string; email: string; role: string };
  appearance: { motion: MotionPreference; density: Density };
  packages: PackageConfig[];
  currency: "BRL";
  defaultProposalValidityDays: number;
  defaultFollowUpDays: number;
  /** Meta mensal de leads captados; base do eixo "Prospecção" do radar. */
  monthlyLeadTarget: number;
}

export interface Database {
  version: number;
  /** Indica que os registros iniciais são fictícios (modo demonstração). */
  demo: boolean;
  seededAt: string;
  leads: Lead[];
  activities: Activity[];
  clients: Client[];
  projects: Project[];
  proposals: Proposal[];
  transactions: Transaction[];
  settings: Settings;
}
