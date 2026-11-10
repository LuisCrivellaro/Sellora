import { z } from "zod";
import { prospectSegmentIds, UFS } from "./catalog";
import { MAX_OPTIONS, OPPORTUNITY_TYPES, RADIUS_OPTIONS } from "./types";

/** Validação dos parâmetros da pesquisa: no formulário e de novo na rota do servidor. */
export const prospectParamsSchema = z.object({
  city: z
    .string()
    .trim()
    .min(2, "Cidade: informe ao menos 2 caracteres.")
    .max(60, "Cidade: use no máximo 60 caracteres.")
    .regex(/^[\p{L}\p{M}' .-]+$/u, "Cidade: use só letras, espaços, hífen e apóstrofo."),
  uf: z.enum(UFS, { message: "Selecione a UF." }),
  segment: z.enum(prospectSegmentIds, { message: "Selecione o segmento." }),
  radiusKm: z.union(RADIUS_OPTIONS.map((n) => z.literal(n)) as [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<20>, z.ZodLiteral<50>], { message: "Raio inválido." }),
  maxResults: z.union(MAX_OPTIONS.map((n) => z.literal(n)) as [z.ZodLiteral<10>, z.ZodLiteral<20>, z.ZodLiteral<50>, z.ZodLiteral<100>], { message: "Quantidade inválida." }),
  opportunity: z.enum(OPPORTUNITY_TYPES, { message: "Selecione o tipo de oportunidade." }),
});

export type ProspectParamsInput = z.infer<typeof prospectParamsSchema>;
