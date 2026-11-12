import { requireLocalDemoAccess } from "@/lib/demos/generation-access";
import { DemoBusyError, generationRequestSchema, startDemoGeneration } from "@/lib/demos/generation-server";
import { json } from "@/lib/prospecting/access";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const access = await requireLocalDemoAccess(request, true);
  if (access instanceof Response) return access;
  try {
    const text = await request.text();
    if (text.length > 2_000_000) return json({ error: "Histórico grande demais para uma solicitação." }, 413);
    const parsed = generationRequestSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return json({ error: "Cadastro ou histórico da demo inválido." }, 422);
    return json({ job: await startDemoGeneration(parsed.data) }, 202);
  } catch (error) {
    if (error instanceof DemoBusyError) return json({ error: error.message }, 429);
    return json({ error: error instanceof SyntaxError ? "Requisição inválida." : "Não foi possível iniciar o gerador local." }, 400);
  }
}
