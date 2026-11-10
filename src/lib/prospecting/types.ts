/**
 * Tipos da Prospecção IA (compartilhados entre servidor e navegador).
 * Nada aqui é simulado: todo resultado vem de um executor real (ver executor.ts).
 */
import type { Segment } from "../types";

export type Classification = "HOT" | "WARM" | "LOW" | "SKIP";

export type Presence = "sem_site" | "so_redes" | "site_com_problemas" | "site_adequado";

export type Confidence = "alta" | "media" | "baixa";

/** verificado = conferido por ferramenta · fonte = declarado pela fonte, sem conferência · nao_verificado = pendente. */
export type EvidenceStatus = "verificado" | "fonte" | "nao_verificado";

export interface Evidence {
  claim: string;
  status: EvidenceStatus;
  source: string;
}

export interface SiteCheck {
  url: string;
  finalUrl: string | null;
  reachable: boolean;
  httpStatus: number | null;
  https: boolean;
  hasViewport: boolean | null;
  title: string | null;
  copyrightYear: number | null;
  hasPhoneLink: boolean | null;
  freeHost: string | null;
  /** O site respondeu, mas recusou a verificação automática (401/403/429): problemas não verificáveis. */
  blocked: boolean;
  /** Página montada por JavaScript: links e conteúdo não verificáveis sem navegador. */
  scriptRendered: boolean;
  error: string | null;
  checkedAt: string;
}

export interface ScorePart {
  label: string;
  points: number;
}

export interface ProspectResult {
  /** Identificador estável na fonte, ex.: "osm:node/123". */
  id: string;
  name: string;
  /** Categoria original da fonte, em português (ex.: "Cabeleireiro"). */
  category: string;
  segment: Segment;
  city: string;
  uf: string;
  address: string;
  distanceKm: number | null;
  phone: string;
  email: string;
  website: string;
  instagram: string;
  otherSocials: string[];
  openingHours: string;
  presence: Presence;
  classification: Classification;
  score: number;
  scoreParts: ScorePart[];
  confidence: Confidence;
  /** Frase curta para a tabela. */
  diagnosis: string;
  /** Problemas verificáveis do site (só preenchido quando conferido). */
  problems: string[];
  justification: string;
  evidence: Evidence[];
  sources: { label: string; url: string }[];
  siteCheck: SiteCheck | null;
  checkedAt: string;
}

export const RADIUS_OPTIONS = [5, 10, 20, 50] as const;
export const MAX_OPTIONS = [10, 20, 50, 100] as const;
export const OPPORTUNITY_TYPES = ["sem_site", "desatualizado", "so_redes", "todas"] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export interface ProspectParams {
  city: string;
  uf: string;
  segment: string;
  radiusKm: (typeof RADIUS_OPTIONS)[number];
  maxResults: (typeof MAX_OPTIONS)[number];
  opportunity: OpportunityType;
}

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type JobPhase = "geocoding" | "discovering" | "verifying" | "classifying" | "done";

/** Visão pública de um job (o que a API devolve). */
export interface JobView {
  id: string;
  executor: string;
  params: ProspectParams;
  status: JobStatus;
  phase: JobPhase;
  message: string;
  candidates: number;
  analyzed: number;
  planned: number;
  found: number;
  warnings: string[];
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  results: ProspectResult[] | null;
  attribution: string;
}

export interface ExecutorStatus {
  configured: boolean;
  executor: string | null;
  label: string;
  /** Instruções quando não configurado. */
  instructions: string[];
  limits: { maxResults: number; maxRadiusKm: number; jobsPerHour: number };
  attribution: string | null;
}
