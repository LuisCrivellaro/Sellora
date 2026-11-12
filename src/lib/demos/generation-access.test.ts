import { expect, it, vi } from "vitest";
import { requireLocalDemoAccess } from "./generation-access";
vi.mock("../supabase/config", () => ({ isSupabaseConfigured: () => false }));

it("permite o app local e bloqueia acesso remoto ou origem diferente à conta Codex", async () => {
  const local = new Request("http://127.0.0.1:3187/api/demos/jobs", { method: "POST", headers: { origin: "http://127.0.0.1:3187" } });
  expect(await requireLocalDemoAccess(local, true)).toEqual({ owner: "demo:local" });
  for (const request of [new Request("https://example.com/api/demos/jobs"), new Request(local.url, { method: "POST", headers: { origin: "https://example.com" } }), new Request(local.url, { headers: { "x-forwarded-host": "evil.example" } })]) {
    expect((await requireLocalDemoAccess(request, true) as Response).status).toBe(403);
  }
});
