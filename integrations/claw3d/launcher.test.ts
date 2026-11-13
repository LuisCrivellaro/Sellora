import { mkdtempSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { frameHeaders, writeStudioSettings } from "./launcher.mjs";

it("devolve o escritório ao andar da Sellora (Lobby/Demo) sem apagar as outras preferências", () => {
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "claw3d-state-"));
  mkdirSync(path.join(stateDir, "claw3d"));
  const file = path.join(stateDir, "claw3d", "settings.json");
  // Estado real observado em 2026-11-12: depois de uma falha, o Claw3D foi para o andar OpenClaw e perdeu o token do perfil demo.
  writeFileSync(file, JSON.stringify({
    version: 1, activeFloorId: "openclaw-ground", avatars: { x: { color: "red" } },
    gateway: { url: "ws://localhost:18789", token: "antigo", adapterType: "openclaw", profiles: { openclaw: { url: "ws://localhost:18789", token: "" }, demo: { url: "ws://localhost:18790", token: "" } } },
    officeFloors: { lobby: { floorId: "lobby", provider: "demo", status: "error", lastErrorCode: "GATEWAY_ERROR", lastErrorMessage: "connect failed" }, "openclaw-ground": { floorId: "openclaw-ground", provider: "openclaw", status: "error" } },
  }));
  writeStudioSettings(stateDir, { adapterPort: 18790, token: "token-da-sessao" });
  const saved = JSON.parse(readFileSync(file, "utf8"));
  expect(saved.activeFloorId).toBe("lobby");
  expect(saved.gateway).toMatchObject({ adapterType: "demo", url: "ws://localhost:18790", token: "token-da-sessao", lastKnownGood: { adapterType: "demo", token: "token-da-sessao" } });
  expect(saved.gateway.profiles.demo).toEqual({ url: "ws://localhost:18790", token: "token-da-sessao" });
  expect(saved.gateway.profiles.openclaw).toEqual({ url: "ws://localhost:18789", token: "" });
  expect(saved.officeFloors.lobby).toMatchObject({ status: "disconnected", lastErrorCode: null });
  expect(saved.avatars).toEqual({ x: { color: "red" } });
});

it("primeiro uso: cria a configuração mínima", () => {
  const stateDir = mkdtempSync(path.join(os.tmpdir(), "claw3d-state-"));
  writeStudioSettings(stateDir, { adapterPort: 18790, token: "t" });
  const saved = JSON.parse(readFileSync(path.join(stateDir, "claw3d", "settings.json"), "utf8"));
  expect(saved).toMatchObject({ version: 1, activeFloorId: "lobby", gateway: { adapterType: "demo", token: "t" } });
});

it("proxy só libera o enquadramento para as origens locais da Sellora", () => {
  const headers = frameHeaders({ "x-frame-options": "SAMEORIGIN", "content-security-policy": "default-src 'self'; frame-ancestors 'self'; upgrade-insecure-requests" });
  expect(headers["x-frame-options"]).toBeUndefined();
  expect(headers["content-security-policy"]).toContain("frame-ancestors 'self' http://localhost:3100");
  expect(headers["content-security-policy"]).toContain("http://127.0.0.1:3187");
  expect(headers["content-security-policy"]).not.toContain("upgrade-insecure-requests");
});
