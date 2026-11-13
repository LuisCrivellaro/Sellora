import { z } from "zod";
import { requireLocalDemoAccess } from "@/lib/demos/generation-access";
import { PublishingError, reconcilePublication, startPublication, toView } from "@/lib/publishing/service";
import { readPublication } from "@/lib/publishing/store";
import { leadIdSchema } from "@/lib/publishing/types";
import { json } from "@/lib/prospecting/access";

export const runtime = "nodejs";

/**
 * Publicação da demo de um lead. Só no app local (os arquivos da demo estão neste computador), com a mesma
 * validação de acesso do gerador. Nenhuma rota envia mensagens ou contata leads.
 *   GET  ?refresh=1[&force=1] → registro, reconciliado com o Coolify
 *   POST { action: publish | republish | retry | verify, siteId, business }
 */
const bodySchema = z.object({
  action: z.enum(["publish", "republish", "retry", "verify"]),
  siteId: z.uuid(),
  business: z.object({ name: z.string().trim().min(2).max(120), city: z.string().trim().min(2).max(60), uf: z.string().regex(/^[A-Z]{2}$/) }),
}).strict();

const statusFor: Record<PublishingError["code"], number> = { not_configured: 409, site_missing: 404, forbidden: 403, rate_limited: 429, busy: 429, invalid: 422 };
const failure = (error: unknown) => error instanceof PublishingError
  ? json({ error: error.message, code: error.code }, statusFor[error.code])
  : json({ error: "Não foi possível concluir a operação de publicação." }, 500);

async function leadIdOf(context: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await context.params;
  return leadIdSchema.safeParse(leadId).success ? leadId : null;
}

export async function GET(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const access = await requireLocalDemoAccess(request);
  if (access instanceof Response) return access;
  const leadId = await leadIdOf(context);
  if (!leadId) return json({ error: "Lead inválido." }, 400);
  const params = new URL(request.url).searchParams;
  try {
    if (params.get("refresh") === "1") return json({ publication: await reconcilePublication(leadId, access.owner, { force: params.get("force") === "1" }) });
    const record = await readPublication(leadId);
    if (record && record.owner !== access.owner) return json({ error: "Publicação pertence a outra conta." }, 403);
    return json({ publication: record ? toView(record) : null });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request, context: { params: Promise<{ leadId: string }> }) {
  const access = await requireLocalDemoAccess(request, true);
  if (access instanceof Response) return access;
  const leadId = await leadIdOf(context);
  if (!leadId) return json({ error: "Lead inválido." }, 400);
  let body: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) return json({ error: "Pedido de publicação inválido." }, 422);
    body = parsed.data;
  } catch { return json({ error: "Requisição inválida." }, 400); }
  try {
    if (body.action === "verify") return json({ publication: await reconcilePublication(leadId, access.owner, { force: true }) });
    const { view, reused } = await startPublication({ leadId, siteId: body.siteId, owner: access.owner, kind: body.action, business: body.business });
    return json({ publication: view, reused }, reused ? 200 : 202);
  } catch (error) { return failure(error); }
}
