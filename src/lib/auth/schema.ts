import { z } from "zod";

/** Validação do login (cliente e servidor). */
export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(6, "A senha tem ao menos 6 caracteres.").max(200, "Senha longa demais."),
});
