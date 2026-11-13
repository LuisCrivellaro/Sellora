import { z } from "zod";

/**
 * Publicação das demos V6 (Coolify + GitHub). Tipos compartilhados entre servidor e interface: nada aqui
 * importa módulos de Node nem lê variáveis de ambiente.
 */
export const PUBLICATION_STATUSES = ["awaiting", "preparing", "deploying", "published", "failed", "suspended", "removed"] as const;
export const publicationStatusSchema = z.enum(PUBLICATION_STATUSES);
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;

export const publicationStatusLabel: Record<PublicationStatus, string> = {
  awaiting: "Aguardando publicação",
  preparing: "Preparando aplicação",
  deploying: "Publicando",
  published: "Publicado",
  failed: "Falha na publicação",
  suspended: "Suspenso",
  removed: "Removido",
};

/** Resultado da última verificação HTTP do endereço publicado (independe do estado do deploy). */
export const publicationHealthSchema = z.enum(["ok", "unreachable", "mismatch", "unknown"]);
export type PublicationHealth = z.infer<typeof publicationHealthSchema>;

export const operationKindSchema = z.enum(["publish", "republish", "retry"]);
export type OperationKind = z.infer<typeof operationKindSchema>;
export const operationStatusSchema = z.enum(["preparing", "deploying", "published", "failed"]);

const iso = z.iso.datetime({ offset: true });
export const leadIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

export const publicationEventSchema = z.object({ at: iso, level: z.enum(["info", "warn", "error"]), message: z.string().max(400) });
export type PublicationEvent = z.infer<typeof publicationEventSchema>;

/** Uma tentativa de publicação (histórico de deploys). */
export const publicationOperationSchema = z.object({
  id: z.uuid(),
  kind: operationKindSchema,
  siteId: z.uuid(),
  status: operationStatusSchema,
  commitSha: z.string().regex(/^[a-f0-9]{40}$/).nullable(),
  coolifyDeploymentUuid: z.string().max(64).nullable(),
  startedAt: iso,
  finishedAt: iso.nullable(),
  error: z.string().max(500).nullable(),
  events: z.array(publicationEventSchema).max(40),
});
export type PublicationOperation = z.infer<typeof publicationOperationSchema>;

/** Registro de publicação de um lead: uma aplicação Coolify por lead, reutilizada em cada republicação. */
export const publicationRecordSchema = z.object({
  version: z.literal(1),
  id: z.uuid(),
  leadId: leadIdSchema,
  owner: z.string().min(1).max(200),
  business: z.object({ name: z.string().max(120), city: z.string().max(60), uf: z.string().max(4) }),
  slug: z.string().regex(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/),
  status: publicationStatusSchema,
  health: publicationHealthSchema,
  /** Site que a operação atual está publicando (ou publicou por último). */
  siteId: z.uuid(),
  /** Último site com publicação confirmada (HTTP + hash do index.html). */
  publishedSiteId: z.uuid().nullable(),
  url: z.url().nullable(),
  domain: z.string().max(253).nullable(),
  coolifyAppUuid: z.string().max(64).nullable(),
  coolifyAppName: z.string().max(100),
  github: z.object({ repo: z.string().max(140), branch: z.string().max(100), path: z.string().max(200), commitSha: z.string().regex(/^[a-f0-9]{40}$/).nullable() }),
  createdAt: iso,
  updatedAt: iso,
  lastDeployAt: iso.nullable(),
  lastCheckedAt: iso.nullable(),
  lastError: z.string().max(500).nullable(),
  operations: z.array(publicationOperationSchema).max(30),
});
export type PublicationRecord = z.infer<typeof publicationRecordSchema>;

/** O que a interface recebe: o registro sem o dono, mais se há operação ativa neste processo. */
export type PublicationView = Omit<PublicationRecord, "owner"> & { active: boolean };

export interface PublishingStatusView {
  configured: boolean;
  /** Nomes das variáveis ausentes ou inválidas (nunca os valores). */
  missing: string[];
  invalid: string[];
  warnings: string[];
  baseDomain: string | null;
  repository: string | null;
  sourceMode: "github-app" | "public" | null;
}
