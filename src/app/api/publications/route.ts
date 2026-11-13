import { requireLocalDemoAccess } from "@/lib/demos/generation-access";
import { readPublishingConfig } from "@/lib/publishing/config";
import { testCoolifyConnection } from "@/lib/publishing/service";
import { json } from "@/lib/prospecting/access";

export const runtime = "nodejs";

/**
 * Estado da integração de publicação (Coolify + GitHub). Devolve só nomes de variáveis ausentes/inválidas,
 * nunca valores. `?test=1` testa a autenticação no Coolify (GET /api/v1/version).
 */
export async function GET(request: Request) {
  const access = await requireLocalDemoAccess(request);
  if (access instanceof Response) return access;
  const { status } = readPublishingConfig();
  if (new URL(request.url).searchParams.get("test") !== "1" || !status.configured) return json({ status });
  return json({ status, connection: await testCoolifyConnection() });
}
