import type {
  ActivityType,
  ClientStatus,
  LeadSource,
  LeadStage,
  LeadTemperature,
  PackageId,
  Priority,
  ProjectStage,
  ProjectStatus,
  ProposalStatus,
  Segment,
  SiteType,
  TransactionStatus,
  WebsiteSituation,
} from "./types";

/** Tons neon com significado (ver docs/DESIGN_SYSTEM.md). Valores = variáveis CSS. */
export const tone = {
  magenta: "var(--neon-magenta)",
  violet: "var(--neon-violet)",
  lilac: "var(--neon-lilac)",
  mint: "var(--neon-mint)",
  indigo: "var(--neon-indigo)",
  warn: "var(--signal-warn)",
  danger: "var(--signal-danger)",
  ghost: "var(--ink-faint)",
} as const;

export type Tone = keyof typeof tone;

interface Meta {
  label: string;
  tone: Tone;
}

export const LEAD_STAGES: LeadStage[] = [
  "novo",
  "qualificado",
  "contatado",
  "respondeu",
  "diagnostico",
  "proposta",
  "negociacao",
  "ganho",
  "perdido",
];

/** Etapas abertas, na ordem do funil (exclui ganho/perdido). */
export const OPEN_STAGES: LeadStage[] = LEAD_STAGES.slice(0, 7);

export const leadStageMeta: Record<LeadStage, Meta> = {
  novo: { label: "Novo", tone: "magenta" },
  qualificado: { label: "Qualificado", tone: "magenta" },
  contatado: { label: "Contatado", tone: "lilac" },
  respondeu: { label: "Respondeu", tone: "lilac" },
  diagnostico: { label: "Diagnóstico", tone: "violet" },
  proposta: { label: "Proposta", tone: "violet" },
  negociacao: { label: "Negociação", tone: "indigo" },
  ganho: { label: "Ganho", tone: "mint" },
  perdido: { label: "Perdido", tone: "ghost" },
};

export const LEAD_SOURCES: LeadSource[] = ["google_maps", "instagram", "indicacao", "manual", "outros"];

export const leadSourceMeta: Record<LeadSource, Meta> = {
  google_maps: { label: "Google Maps", tone: "magenta" },
  instagram: { label: "Instagram", tone: "violet" },
  indicacao: { label: "Indicação", tone: "mint" },
  manual: { label: "Pesquisa manual", tone: "indigo" },
  outros: { label: "Outros", tone: "lilac" },
};

export const priorityMeta: Record<Priority, Meta & { rank: number }> = {
  alta: { label: "Alta", tone: "magenta", rank: 3 },
  media: { label: "Média", tone: "violet", rank: 2 },
  baixa: { label: "Baixa", tone: "ghost", rank: 1 },
};

export const temperatureMeta: Record<LeadTemperature, Meta> = {
  frio: { label: "Frio", tone: "indigo" },
  morno: { label: "Morno", tone: "violet" },
  quente: { label: "Quente", tone: "magenta" },
  convertido: { label: "Convertido", tone: "mint" },
};

export const websiteSituationMeta: Record<WebsiteSituation, Meta> = {
  sem_site: { label: "Sem site", tone: "magenta" },
  desatualizado: { label: "Desatualizado", tone: "warn" },
  sem_mobile: { label: "Sem versão mobile", tone: "violet" },
  adequado: { label: "Adequado", tone: "mint" },
};

export const SEGMENTS: Segment[] = ["restaurantes", "saude", "beleza", "servicos", "comercio", "outros"];

export const segmentMeta: Record<Segment, Meta> = {
  restaurantes: { label: "Restaurantes", tone: "magenta" },
  saude: { label: "Saúde", tone: "mint" },
  beleza: { label: "Beleza", tone: "lilac" },
  servicos: { label: "Serviços", tone: "violet" },
  comercio: { label: "Comércio", tone: "indigo" },
  outros: { label: "Outros", tone: "ghost" },
};

export const activityTypeMeta: Record<ActivityType, { label: string }> = {
  ligacao: { label: "Ligação" },
  whatsapp: { label: "WhatsApp" },
  email: { label: "E-mail" },
  visita: { label: "Visita" },
  reuniao: { label: "Reunião" },
  nota: { label: "Nota" },
  follow_up: { label: "Follow-up" },
  etapa: { label: "Mudança de etapa" },
};

/** Tipos que contam como contato efetivo com o lead. */
export const CONTACT_ACTIVITY_TYPES: ActivityType[] = ["ligacao", "whatsapp", "email", "visita", "reuniao"];

export const clientStatusMeta: Record<ClientStatus, Meta> = {
  ativo: { label: "Ativo", tone: "mint" },
  aguardando_cliente: { label: "Aguardando cliente", tone: "warn" },
  pausado: { label: "Pausado", tone: "ghost" },
  encerrado: { label: "Encerrado", tone: "indigo" },
};

export const PROJECT_STAGES: ProjectStage[] = ["briefing", "design", "desenvolvimento", "revisao", "publicacao", "entrega"];

export const projectStageMeta: Record<ProjectStage, Meta> = {
  briefing: { label: "Briefing", tone: "magenta" },
  design: { label: "Design", tone: "lilac" },
  desenvolvimento: { label: "Desenvolvimento", tone: "violet" },
  revisao: { label: "Revisão", tone: "indigo" },
  publicacao: { label: "Publicação", tone: "warn" },
  entrega: { label: "Entrega", tone: "mint" },
};

export const projectStatusMeta: Record<ProjectStatus, Meta> = {
  nao_iniciado: { label: "Não iniciado", tone: "ghost" },
  em_desenvolvimento: { label: "Em desenvolvimento", tone: "violet" },
  em_revisao: { label: "Em revisão", tone: "magenta" },
  concluido: { label: "Concluído", tone: "mint" },
};

export const siteTypeMeta: Record<SiteType, { label: string }> = {
  landing: { label: "Landing page" },
  institucional: { label: "Site institucional" },
  personalizado: { label: "Personalizado" },
};

/** Tarefas padrão criadas para cada novo projeto (base do cálculo de progresso). */
export const DEFAULT_PROJECT_TASKS: { title: string; stage: ProjectStage }[] = [
  { title: "Reunião de briefing", stage: "briefing" },
  { title: "Coletar conteúdo, fotos e logo", stage: "briefing" },
  { title: "Ficha de direção criativa aprovada", stage: "design" },
  { title: "Layout desktop e mobile", stage: "design" },
  { title: "Construir páginas", stage: "desenvolvimento" },
  { title: "Formulário e contatos funcionando", stage: "desenvolvimento" },
  { title: "QA: mobile, acessibilidade, performance", stage: "revisao" },
  { title: "Ajustes da revisão do cliente", stage: "revisao" },
  { title: "Preview aprovado por escrito", stage: "publicacao" },
  { title: "Publicar com domínio do cliente", stage: "publicacao" },
  { title: "Entrega e orientações finais", stage: "entrega" },
];

export const PROPOSAL_STATUSES: ProposalStatus[] = ["rascunho", "enviada", "negociacao", "aprovada", "recusada"];

export const proposalStatusMeta: Record<ProposalStatus, Meta> = {
  rascunho: { label: "Rascunho", tone: "ghost" },
  enviada: { label: "Enviada", tone: "violet" },
  negociacao: { label: "Em negociação", tone: "magenta" },
  aprovada: { label: "Aprovada", tone: "mint" },
  recusada: { label: "Recusada", tone: "indigo" },
};

export const packageOrder: PackageId[] = ["essencial", "profissional", "personalizado"];

export const transactionStatusMeta: Record<TransactionStatus, Meta> = {
  pago: { label: "Recebido", tone: "mint" },
  parcial: { label: "Parcial", tone: "violet" },
  a_receber: { label: "A receber", tone: "lilac" },
  vencido: { label: "Vencido", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "ghost" },
};
