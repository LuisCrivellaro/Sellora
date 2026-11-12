import { z } from "zod";
import { EXPENSE_CATEGORIES, LEAD_SOURCES, LEAD_STAGES, PAYMENT_METHODS, PROJECT_STAGES, PROPOSAL_STATUSES, SEGMENTS } from "./constants";

/**
 * Esquemas de validação de entrada. Usados nos formulários (feedback inline) e
 * novamente na camada de dados antes de gravar — a mesma fronteira que um
 * backend real validaria.
 */

const requiredText = (label: string, min = 2, max = 120) =>
  z
    .string()
    .trim()
    .min(min, `${label}: informe ao menos ${min} caracteres.`)
    .max(max, `${label}: use no máximo ${max} caracteres.`);

const optionalText = (max = 500) => z.string().trim().max(max, `Use no máximo ${max} caracteres.`);

/** Aceita vazio ou URL; completa "https://" quando o protocolo foi omitido. */
export const optionalUrl = z
  .string()
  .trim()
  .transform((v) => (v && !/^https?:\/\//i.test(v) ? `https://${v}` : v))
  .pipe(z.union([z.literal(""), z.url("Informe um endereço válido, ex.: www.exemplo.com.br")]));

const optionalEmail = z.string().trim().pipe(z.union([z.literal(""), z.email("Informe um e-mail válido, ex.: contato@empresa.com.br")]));

const optionalPhone = z
  .string()
  .trim()
  .refine((v) => v === "" || v.replace(/\D/g, "").length >= 10, "Telefone com DDD, ex.: (19) 99999-0000");

const money = (label: string) =>
  z.coerce
    .number({ message: `${label}: informe um valor numérico.` })
    .min(0, `${label}: o valor não pode ser negativo.`)
    .max(10_000_000, `${label}: valor acima do limite.`);

const optionalIsoDate = z.string().nullable();

export const leadInputSchema = z.object({
  name: requiredText("Estabelecimento"),
  segment: z.enum(SEGMENTS),
  city: requiredText("Cidade", 2, 60),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "UF com 2 letras, ex.: SP"),
  source: z.enum(LEAD_SOURCES),
  website: optionalUrl,
  websiteSituation: z.enum(["sem_site", "desatualizado", "sem_mobile", "adequado"]),
  stage: z.enum(LEAD_STAGES),
  priority: z.enum(["baixa", "media", "alta"]),
  phone: optionalPhone,
  email: optionalEmail,
  instagram: optionalText(60),
  potentialValue: money("Valor potencial"),
  nextAction: optionalText(140),
  nextActionAt: optionalIsoDate,
  notes: optionalText(2000),
});
export type LeadInput = z.infer<typeof leadInputSchema>;

export const activityInputSchema = z.object({
  type: z.enum(["ligacao", "whatsapp", "email", "visita", "reuniao", "nota", "follow_up"]),
  description: requiredText("Descrição", 3, 500),
  dueAt: optionalIsoDate,
  completed: z.boolean(),
});
export type ActivityInput = z.infer<typeof activityInputSchema>;

export const clientInputSchema = z.object({
  name: requiredText("Cliente"),
  segment: z.enum(SEGMENTS),
  city: requiredText("Cidade", 2, 60),
  uf: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, "UF com 2 letras, ex.: SP"),
  contactName: optionalText(80),
  phone: optionalPhone,
  email: optionalEmail,
  status: z.enum(["ativo", "aguardando_cliente", "pausado", "encerrado"]),
  siteUrl: optionalUrl,
  notes: optionalText(2000),
});
export type ClientInput = z.infer<typeof clientInputSchema>;

/** Objeto base (sem refinamento) para poder ser estendido pelos schemas de gravação no servidor. */
export const projectInputBaseSchema = z.object({
  clientId: z.string().min(1, "Selecione o cliente."),
  title: requiredText("Projeto", 3, 100),
  siteType: z.enum(["landing", "institucional", "personalizado"]),
  stage: z.enum(PROJECT_STAGES),
  startDate: z.string().min(1, "Informe a data de início."),
  dueDate: z.string().min(1, "Informe o prazo."),
  contractValue: money("Valor contratado"),
  previewUrl: optionalUrl,
  publishedUrl: optionalUrl,
  notes: optionalText(2000),
});

export const projectDatesRefinement: [(v: { startDate: string; dueDate: string }) => boolean, { message: string; path: string[] }] = [
  (v) => new Date(v.dueDate).getTime() >= new Date(v.startDate).getTime(),
  { message: "O prazo deve ser igual ou posterior ao início.", path: ["dueDate"] },
];

export const projectInputSchema = projectInputBaseSchema.refine(...projectDatesRefinement);
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const proposalItemSchema = z.object({
  id: z.string(),
  description: requiredText("Item", 2, 140),
  quantity: z.coerce.number().int("Quantidade inteira.").min(1, "Quantidade mínima 1."),
  unitPrice: money("Preço"),
});

export const proposalInputSchema = z.object({
  recipientName: requiredText("Cliente/lead"),
  leadId: z.string().nullable(),
  clientId: z.string().nullable(),
  title: requiredText("Título", 3, 120),
  packageId: z.enum(["essencial", "profissional", "personalizado"]),
  items: z.array(proposalItemSchema).min(1, "Adicione ao menos um item."),
  scope: optionalText(2000).default(""),
  discount: money("Desconto"),
  deadlineDays: z.coerce.number().int().min(1, "Prazo mínimo de 1 dia.").max(365, "Prazo máximo de 365 dias."),
  revisions: z.coerce.number().int().min(0).max(20, "No máximo 20 rodadas."),
  paymentTerms: optionalText(300),
  exclusions: optionalText(600),
  validUntil: z.string().min(1, "Informe a validade."),
  status: z.enum(PROPOSAL_STATUSES),
  nextAction: optionalText(140),
  notes: optionalText(2000),
});
export type ProposalInput = z.infer<typeof proposalInputSchema>;

/** Valor monetário positivo com no máximo 2 casas (centavos). */
const positiveMoney = (label: string) =>
  money(label)
    .refine((v) => v > 0, "Valor deve ser maior que zero.")
    .refine((v) => Math.abs(Math.round(v * 100) - v * 100) < 1e-6, `${label}: use no máximo 2 casas decimais.`);

export const transactionInputSchema = z.object({
  kind: z.enum(["receita", "custo"]),
  clientId: z.string().nullable(),
  projectId: z.string().nullable(),
  description: requiredText("Descrição", 3, 140),
  amount: positiveMoney("Valor"),
  dueDate: z.string().min(1, "Informe o vencimento."),
  // Campos com padrão: lançamentos gravados antes deles continuam válidos.
  category: z.enum(["", ...EXPENSE_CATEGORIES]).default(""),
  notes: optionalText(500).default(""),
});
export type TransactionInput = z.input<typeof transactionInputSchema>;

export const paymentInputSchema = z.object({
  amount: positiveMoney("Valor"),
  date: z.string().min(1, "Informe a data do pagamento."),
  method: z.enum(["", ...PAYMENT_METHODS]).default(""),
  note: optionalText(140),
});
export type PaymentInput = z.input<typeof paymentInputSchema>;

/** Saldo informado (pode ser negativo: conta no vermelho). */
export const openingBalanceSchema = z.object({
  amount: z.coerce.number({ message: "Saldo: informe um valor numérico." }).min(-10_000_000).max(10_000_000),
  date: z.string().min(1, "Informe a data do saldo."),
});

export const packageSchema = z.object({
  id: z.enum(["essencial", "profissional", "personalizado"]),
  name: requiredText("Nome do pacote", 2, 40),
  price: money("Preço"),
  description: optionalText(200),
});

export const profileSchema = z.object({
  name: requiredText("Nome", 2, 80),
  email: optionalEmail,
  role: optionalText(60),
});

/** Converte erros do Zod em mapa campo → mensagem para exibição inline. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
