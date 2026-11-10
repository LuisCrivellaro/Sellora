import { tone, type Tone } from "./constants";
import type { LeadTemperature, ProjectStage, ProjectStatus, ProposalStatus } from "./types";

/** Paleta exclusiva dos dashboards comerciais. O Financeiro mantém seus tokens. */
export const dashboardColors = {
  red: "#C94B55",
  redLight: "#D97981",
  redDark: "#923A43",
  redSoft: "#B85B65",
  steel: "#7186A6",
  steelLight: "#92A4BF",
  steelDark: "#4D607D",
  muted: "#817C90",
  gray: "#A3A3A3",
  graphite: "#252525",
} as const;

/** Compatibilidade com os metadados existentes, sem alterar seus significados. */
export const dashboardTone: Record<Tone, string> = {
  magenta: dashboardColors.red,
  violet: dashboardColors.steel,
  lilac: dashboardColors.steelLight,
  indigo: dashboardColors.steelDark,
  mint: tone.mint,
  warn: tone.warn,
  danger: tone.danger,
  ghost: dashboardColors.gray,
};

export const dashboardCategoryColors = [
  dashboardColors.red, dashboardColors.steel, dashboardColors.redLight,
  dashboardColors.steelLight, dashboardColors.redSoft, dashboardColors.muted,
];

export const dashboardProgressColor = (progress: number) => progress >= 100 ? tone.mint : dashboardColors.red;

export const dashboardTemperatureColors: Record<LeadTemperature, string> = {
  frio: dashboardColors.steel,
  morno: dashboardColors.redLight,
  quente: dashboardColors.red,
  convertido: tone.mint,
};

export const dashboardProjectStatusColors: Record<ProjectStatus, string> = {
  nao_iniciado: dashboardColors.gray,
  em_desenvolvimento: dashboardColors.steel,
  em_revisao: dashboardColors.redSoft,
  concluido: tone.mint,
};

export const dashboardProjectStageColors: Record<ProjectStage, string> = {
  briefing: dashboardColors.red,
  briefing_recebido: dashboardColors.redSoft,
  planejamento: dashboardColors.redDark,
  design: dashboardColors.redLight,
  desenvolvimento: dashboardColors.steel,
  revisao: dashboardColors.steelLight,
  aprovacao: dashboardColors.steelDark,
  publicacao: tone.warn,
  entrega: tone.mint,
};

export const dashboardProposalStatusColors: Record<ProposalStatus, string> = {
  rascunho: dashboardColors.gray,
  pronta: dashboardColors.steelLight,
  enviada: dashboardColors.steel,
  negociacao: dashboardColors.redSoft,
  aprovada: tone.mint,
  recusada: dashboardColors.muted,
  expirada: tone.warn,
};
