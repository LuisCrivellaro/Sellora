import { getDemoGenerationJob } from "@/lib/demos/generation-server";
import { requireLocalDemoAccess } from "@/lib/demos/generation-access";
import { json } from "@/lib/prospecting/access";

export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireLocalDemoAccess(request);
  if (access instanceof Response) return access;
  const job = await getDemoGenerationJob((await context.params).id);
  return job ? json({ job }) : json({ error: "Geração não encontrada. Tente novamente." }, 404);
}
