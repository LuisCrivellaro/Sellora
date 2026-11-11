import { expect, it, vi } from "vitest";
import { requireAccess } from "./access";

vi.mock("../supabase/config", () => ({ isSupabaseConfigured: () => false }));

function request(origin: string, host = "127.0.0.1:3187") {
  return new Request("http://localhost:3187/api/prospeccao/jobs", {
    method: "POST",
    headers: { origin, host },
  });
}

it("aceita a origem da janela desktop quando a URL interna usa localhost", async () => {
  expect(await requireAccess(request("http://127.0.0.1:3187"), { write: true }))
    .toEqual({ owner: "demo:local" });
});

it.each(["https://example.com", "http://127.0.0.1:9999", "https://127.0.0.1:3187", "http://localhost:3187", "null"])(
  "bloqueia uma origem diferente do endereço solicitado: %s",
  async (origin) => {
    const result = await requireAccess(request(origin), { write: true });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(403);
  },
);

it("aceita a URL da requisição quando o cabeçalho Host está ausente", async () => {
  const result = await requireAccess(new Request("http://localhost:3187/api/prospeccao/jobs", {
    method: "POST", headers: { origin: "http://localhost:3187" },
  }), { write: true });
  expect(result).toEqual({ owner: "demo:local" });
});
