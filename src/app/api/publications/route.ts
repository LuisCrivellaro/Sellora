import { requireLocalDemoAccess } from "@/lib/demos/generation-access";
import { readPublishingConfig } from "@/lib/publishing/config";
import { testPublishingConnection } from "@/lib/publishing/service";
import { json } from "@/lib/prospecting/access";

export const runtime = "nodejs";

/**
 * Estado da integração de publicação (Coolify + GitHub). Devolve só nomes de variáveis ausentes/inválidas,
 * nunca valores. `?test=1` testa, sem gravar nada, o Coolify (GET /api/v1/version) e o acesso de escrita
 * ao repositório das demos — cada um assim que as variáveis dele existem.
 */
export async function GET(request: Request) {
  const access = await requireLocalDemoAccess(request);
  if (access instanceof Response) return access;
  const { status } = readPublishingConfig();
  if (new URL(request.url).searchParams.get("test") !== "1") return json({ status });
  return json({ status, connection: await testPublishingConnection() });
}
