import { expect, it } from "vitest";
import { navigationKind } from "../../../desktop/policy.mjs";
it("isola o aplicativo e recusa protocolos executáveis", () => {
  expect(navigationKind("http://127.0.0.1:3187/leads", "http://127.0.0.1:3187")).toBe("internal");
  expect(navigationKind("https://wa.me/5519999991234", "http://127.0.0.1:3187")).toBe("external");
  for (const url of ["javascript:alert(1)", "file:///C:/Windows", "https://user:pass@example.com", "http://evil.example"]) expect(navigationKind(url, "http://127.0.0.1:3187")).toBe("deny");
});
