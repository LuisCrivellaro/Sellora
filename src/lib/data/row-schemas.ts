import { z } from "zod";
import { leadDemoSchema } from "../demos/model";
import { PROJECT_STAGES } from "../constants";
import {
  activityInputSchema,
  clientInputSchema,
  leadInputSchema,
  packageSchema,
  paymentInputSchema,
  profileSchema,
  projectDatesRefinement,
  projectInputBaseSchema,
  proposalInputSchema,
  proposalItemSchema,
  transactionInputSchema,
} from "../schemas";
import type { Settings } from "../types";
import type { ChangeSet } from "./sync";

/**
 * Validação no SERVIDOR de tudo que será gravado no Postgres. Reaproveita os
 * schemas de entrada dos formulários e acrescenta os campos de sistema
 * (ids, datas, vínculos). Nada chega ao banco sem passar por aqui.
 */

const id = z.uuid("Identificador inválido.");
const ref = id.nullable();
const iso = z.iso.datetime({ offset: true, message: "Data inválida." });
const isoOrNull = iso.nullable();
const position = z.number().int().min(0).max(10_000);
const MAX_ROWS = 5000;

export const leadRowSchema = leadInputSchema.extend({
  demo: leadDemoSchema.nullable().optional(),
  id,
  website: leadInputSchema.shape.website.nullable().transform((v) => v || null),
  nextActionAt: isoOrNull,
  lastContactAt: isoOrNull,
  clientId: ref,
  lostReason: z.string().trim().max(500),
  createdAt: iso,
  updatedAt: iso,
});

export const clientRowSchema = clientInputSchema.extend({ id, leadId: ref, createdAt: iso, updatedAt: iso });

export const activityRowSchema = z.object({
  id,
  leadId: ref,
  clientId: ref,
  projectId: ref,
  type: z.enum(["ligacao", "whatsapp", "email", "visita", "reuniao", "nota", "follow_up", "etapa"]),
  description: activityInputSchema.shape.description,
  dueAt: isoOrNull,
  completedAt: isoOrNull,
  createdAt: iso,
});

export const projectRowSchema = projectInputBaseSchema
  .extend({
    id,
    clientId: id,
    proposalId: ref,
    startDate: iso,
    dueDate: iso,
    publishedAt: isoOrNull,
    deliveredAt: isoOrNull,
    createdAt: iso,
    updatedAt: iso,
  })
  .refine(...projectDatesRefinement);

export const taskRowSchema = z.object({
  id,
  projectId: id,
  title: z.string().trim().min(2, "Descreva a tarefa com ao menos 2 caracteres.").max(200),
  stage: z.enum(PROJECT_STAGES),
  done: z.boolean(),
  doneAt: isoOrNull,
  position,
});

export const proposalRowSchema = proposalInputSchema.omit({ items: true }).extend({
  id,
  leadId: ref,
  clientId: ref,
  validUntil: iso,
  sentAt: isoOrNull,
  decidedAt: isoOrNull,
  createdAt: iso,
  updatedAt: iso,
});

export const itemRowSchema = proposalItemSchema.extend({ id, proposalId: id, position });

export const transactionRowSchema = transactionInputSchema.extend({
  id,
  clientId: ref,
  projectId: ref,
  dueDate: iso,
  cancelled: z.boolean(),
  createdAt: iso,
  updatedAt: iso,
});

export const paymentRowSchema = paymentInputSchema.extend({ id, transactionId: id, date: iso, position });

export const settingsSchema = z.object({
  profile: profileSchema,
  appearance: z.object({ motion: z.enum(["system", "full", "reduced"]), density: z.enum(["confortavel", "compacta"]) }),
  packages: z.array(packageSchema).min(1).max(3),
  currency: z.literal("BRL"),
  defaultProposalValidityDays: z.number().int().min(1).max(90),
  defaultFollowUpDays: z.number().int().min(1).max(30),
  // Campos novos têm padrão: preferências gravadas antes deles continuam válidas.
  defaultPaymentTerms: z.string().trim().max(300).default("50% de entrada na aprovação e 50% na entrega"),
  entryPercent: z.number().min(0).max(100).default(50),
  defaultRevisions: z.number().int().min(0).max(20).default(2),
  monthlyLeadTarget: z.number().int().min(1).max(1000),
}) satisfies z.ZodType<Settings, unknown>;

const rows = <T extends z.ZodType>(schema: T) => z.array(schema).max(MAX_ROWS, "Lote grande demais.").optional();
const ids = z.array(id).max(MAX_ROWS, "Lote grande demais.").optional();

export const changeSetSchema = z.object({
  upserts: z
    .object({
      leads: rows(leadRowSchema),
      clients: rows(clientRowSchema),
      proposals: rows(proposalRowSchema),
      proposal_items: rows(itemRowSchema),
      projects: rows(projectRowSchema),
      project_tasks: rows(taskRowSchema),
      transactions: rows(transactionRowSchema),
      payments: rows(paymentRowSchema),
      activities: rows(activityRowSchema),
    })
    .strict(),
  deletes: z
    .object({
      leads: ids,
      clients: ids,
      proposals: ids,
      proposal_items: ids,
      projects: ids,
      project_tasks: ids,
      transactions: ids,
      payments: ids,
      activities: ids,
    })
    .strict(),
  settings: settingsSchema.optional(),
});

/** Valida e normaliza um conjunto de mudanças. Lança ZodError se inválido. */
export function parseChangeSet(input: unknown): ChangeSet {
  return changeSetSchema.parse(input) as ChangeSet;
}
