import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { proxy } from "./proxy";

vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true, supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "test" }));
vi.mock("@supabase/ssr", () => ({ createServerClient: vi.fn(() => ({ auth: { getClaims: async () => ({ data: null }) } })) }));
beforeEach(() => vi.clearAllMocks());

it("permite só o renderizador público da demo sem consultar o banco", async () => {
  const response = await proxy(new NextRequest("https://sellora.example/demo"));
  expect(response.headers.get("x-middleware-next")).toBe("1");
  expect(createServerClient).not.toHaveBeenCalled();
});

it.each(["/leads", "/api/prospeccao/jobs", "/demo/privado"])("continua exigindo login em %s", async (route) => {
  const response = await proxy(new NextRequest(`https://sellora.example${route}`));
  expect(new URL(response.headers.get("location")!).pathname).toBe("/entrar");
  expect(createServerClient).toHaveBeenCalledOnce();
});
