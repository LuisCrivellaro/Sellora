import { DemoBusyError, cancelDemoGeneration, getDemoGenerationJob, pauseDemoGeneration, resumeDemoGeneration } from "@/lib/demos/generation-server";
import { requireLocalDemoAccess } from "@/lib/demos/generation-access";
import { json } from "@/lib/prospecting/access";

export const runtime = "nodejs";
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireLocalDemoAccess(request, true);
  if (access instanceof Response) return access;
  try {
    const job = await resumeDemoGeneration((await context.params).id);
    return job ? json({ job }) : json({ error: "Geração não encontrada." }, 404);
  } catch (error) { return json({ error: "Não foi possível retomar esta geração. Confira se há outra demo em andamento." }, error instanceof DemoBusyError ? 429 : 409); }
}
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireLocalDemoAccess(request, true);
  if (access instanceof Response) return access;
  const id = (await context.params).id;
  const job = await (new URL(request.url).searchParams.get("action") === "cancel" ? cancelDemoGeneration(id) : pauseDemoGeneration(id));
  return job ? json({ job }) : json({ job: null });
}
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const access = await requireLocalDemoAccess(request);
  if (access instanceof Response) return access;
  const job = await getDemoGenerationJob((await context.params).id);
  return job ? json({ job }) : json({ error: "Geração não encontrada. Tente novamente." }, 404);
}
