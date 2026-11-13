import { expect, it } from "vitest";
import { navigationKind, parseUserConfig, USER_CONFIG_TEMPLATE } from "../../../desktop/policy.mjs";
it("configuração local do app aceita só chaves conhecidas e ignora vazias", () => {
  expect(parseUserConfig([
    "# comentário", "COOLIFY_API_URL = https://coolify.exemplo.com.br", 'SELLORA_DEMOS_GITHUB_REPO="dono/demos"', "COOLIFY_API_TOKEN=",
    "PATH=C:\\malicioso", "NODE_OPTIONS=--require x", "SELLORA_CLAW3D_DIR=C:\\Users\\x\\.sellora\\claw3d\\app", "linha solta",
  ].join("\r\n"))).toEqual({ COOLIFY_API_URL: "https://coolify.exemplo.com.br", SELLORA_DEMOS_GITHUB_REPO: "dono/demos", SELLORA_CLAW3D_DIR: "C:\\Users\\x\\.sellora\\claw3d\\app" });
  // O modelo criado na primeira abertura não traz nenhum segredo preenchido.
  const template = parseUserConfig(USER_CONFIG_TEMPLATE);
  expect(Object.keys(template)).toEqual(["SELLORA_DEMOS_GITHUB_REPO"]);
});
it("isola o aplicativo e recusa protocolos executáveis", () => {
  expect(navigationKind("http://127.0.0.1:3187/leads", "http://127.0.0.1:3187")).toBe("internal");
  expect(navigationKind("https://wa.me/5519999991234", "http://127.0.0.1:3187")).toBe("external");
  for (const url of ["javascript:alert(1)", "file:///C:/Windows", "https://user:pass@example.com", "http://evil.example"]) expect(navigationKind(url, "http://127.0.0.1:3187")).toBe("deny");
});
