import { json, requireAccess } from "@/lib/prospecting/access";
import { executorStatus } from "@/lib/prospecting/config";

/** GET: o executor está configurado? (nenhuma chamada externa aqui) */
export async function GET(request: Request) {
  const access = await requireAccess(request);
  if (access instanceof Response) return access;
  return json(executorStatus());
}
