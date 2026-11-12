import { codexGenerationStatus } from "@/lib/demos/codex-server";
import { claudeTextStatus } from "@/lib/demos/claude-server";
import { requireLocalDemoAccess } from "@/lib/demos/generation-access";
import { json } from "@/lib/prospecting/access";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const access = await requireLocalDemoAccess(request);
  if (access instanceof Response) return access;
  const [codex, claude] = await Promise.all([codexGenerationStatus(), claudeTextStatus()]);
  return json({ ...codex, claude });
}
