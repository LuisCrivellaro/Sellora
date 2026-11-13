import path from "node:path";
import { existsSync } from "node:fs";
import { expect, it } from "vitest";
import { browserQa, endpointFromActivePort } from "./qa-browser";

it("lê o endereço DevTools do arquivo DevToolsActivePort (Edge 157 não escreve mais no stderr)", () => {
  expect(endpointFromActivePort("54832\r\n/devtools/browser/93d0-ab\r\n")).toBe("ws://127.0.0.1:54832/devtools/browser/93d0-ab");
  expect(endpointFromActivePort("54832\n/devtools/browser/x")).toBe("ws://127.0.0.1:54832/devtools/browser/x");
  expect(endpointFromActivePort("abc\n/other")).toBeNull();
  expect(endpointFromActivePort("")).toBeNull();
});

// Auditoria real em Edge/Chrome instalado. Rode com SELLORA_LIVE_BROWSER=<pasta files de um site V6>.
const site = process.env.SELLORA_LIVE_BROWSER;
it.skipIf(!site || !existsSync(path.join(site, "index.html")))("auditoria em navegador real abre, captura e encerra", async () => {
  const result = await browserQa(site!);
  expect(result.reason).toBeUndefined();
  expect(result.executed).toBe(true);
  expect(Object.keys(result.shots)).toEqual(expect.arrayContaining(["shot-1440.png", "shot-390.png"]));
}, 180_000);
