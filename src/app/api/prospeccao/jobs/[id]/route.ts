import { json, requireAccess } from "@/lib/prospecting/access";
import { cancelJob, getJob } from "@/lib/prospecting/jobs";
import { UUID_RE } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

/** GET: estado e, ao concluir, resultados do job (só para o dono). */
export async function GET(request: Request, { params }: Ctx) {
  const access = await requireAccess(request);
  if (access instanceof Response) return access;
  const { id } = await params;
  if (!UUID_RE.test(id)) return json({ error: "Pesquisa não encontrada." }, 404);
  const job = getJob(id, access.owner);
  if (!job) return json({ error: "Pesquisa não encontrada ou expirada (o servidor pode ter sido reiniciado).", code: "not_found" }, 404);
  return json({ job });
}

/** DELETE: cancela o job em andamento. */
export async function DELETE(request: Request, { params }: Ctx) {
  const access = await requireAccess(request, { write: true });
  if (access instanceof Response) return access;
  const { id } = await params;
  if (!UUID_RE.test(id)) return json({ error: "Pesquisa não encontrada." }, 404);
  const job = cancelJob(id, access.owner);
  if (!job) return json({ error: "Pesquisa não encontrada ou expirada.", code: "not_found" }, 404);
  return json({ job });
}
