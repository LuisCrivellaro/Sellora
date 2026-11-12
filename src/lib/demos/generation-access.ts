import { json, requireAccess } from "../prospecting/access";

/** A conta do Codex pertence ao computador local e nunca é disponibilizada a visitantes de um deploy. */
export async function requireLocalDemoAccess(request: Request, write = false) {
  const hosts = [new URL(request.url).hostname, request.headers.get("host"), request.headers.get("x-forwarded-host")].filter(Boolean) as string[];
  const local = hosts.every((host) => /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host));
  if (!local) return json({ error: "O gerador com conta Codex funciona no aplicativo local deste computador." }, 403);
  return requireAccess(request, { write });
}
