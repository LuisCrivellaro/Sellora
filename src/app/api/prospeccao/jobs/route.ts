import { json, requireAccess } from "@/lib/prospecting/access";
import { activeExecutor } from "@/lib/prospecting/config";
import { JobLimitError, startJob } from "@/lib/prospecting/jobs";
import { findMunicipio, municipioError } from "@/lib/prospecting/municipios";
import { prospectParamsSchema } from "@/lib/prospecting/schema";
import type { ProspectParams } from "@/lib/prospecting/types";

/** POST: inicia uma pesquisa assíncrona. Responde 202 com o job; o progresso vem por GET /jobs/:id. */
export async function POST(request: Request) {
  const access = await requireAccess(request, { write: true });
  if (access instanceof Response) return access;
  const executor = activeExecutor();
  if (!executor) return json({ error: "Integração não configurada: defina PROSPECCAO_EXECUTOR no .env.local.", code: "not_configured" }, 503);

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 2000) return json({ error: "Requisição grande demais." }, 413);
    body = JSON.parse(text);
  } catch {
    return json({ error: "Corpo da requisição inválido." }, 400);
  }
  const parsed = prospectParamsSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Parâmetros inválidos.", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, 422);
  // Só municípios da lista oficial na UF escolhida; grava o nome oficial (com acentos).
  const municipio = findMunicipio(parsed.data.city, parsed.data.uf);
  if (!municipio) {
    const message = municipioError(parsed.data.city, parsed.data.uf) ?? "Município inválido.";
    return json({ error: message, issues: [{ path: "city", message }] }, 422);
  }

  try {
    const job = startJob(access.owner, { ...parsed.data, city: municipio.name } as ProspectParams, executor);
    return json({ job }, 202);
  } catch (e) {
    if (e instanceof JobLimitError) return json({ error: e.message, code: "limit" }, 429);
    throw e;
  }
}
