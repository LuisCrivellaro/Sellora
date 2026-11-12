import { codexGenerationStatus } from "@/lib/demos/codex-server";
import { claudeTextStatus } from "@/lib/demos/claude-server";
import { geminiImageStatus } from "@/lib/demos/gemini-server";
import { requireLocalDemoAccess } from "@/lib/demos/generation-access";
import { json } from "@/lib/prospecting/access";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const access = await requireLocalDemoAccess(request);
  if (access instanceof Response) return access;
  const [codex, claude, gemini] = await Promise.all([codexGenerationStatus(), claudeTextStatus(), geminiImageStatus()]);
  return json({ ...codex, claude, gemini });
}
