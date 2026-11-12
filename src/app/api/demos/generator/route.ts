import { codexGenerationStatus } from "@/lib/demos/codex-server";
import { requireLocalDemoAccess } from "@/lib/demos/generation-access";
import { json } from "@/lib/prospecting/access";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const access = await requireLocalDemoAccess(request);
  if (access instanceof Response) return access;
  return json(await codexGenerationStatus());
}
