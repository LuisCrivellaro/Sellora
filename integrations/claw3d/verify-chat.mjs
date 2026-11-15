import http from "node:http";
import path from "node:path";
import { mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { chromium, expect } from "@playwright/test";
import { startClaw3d } from "./launcher.mjs";

/** Usa o Claw3D real com bridge e estado isolados, sem contas de IA nem tarefas do usuário. */
export async function verifyOfficeChat(appDir, nodePath = process.execPath) {
  const stateDir = await mkdtemp(path.join(tmpdir(), "sellora-chat-qa-"));
  const agents = [
    { id: "prospeccao", name: "Agente de Prospecção", runtime: "openstreetmap" },
    { id: "gerador-de-demos", name: "Agente Gerador de Demos", runtime: "claude-code" },
    { id: "coolify-deploy", name: "Deployment Manager", runtime: "coolify" },
    { id: "revisor-de-demos", name: "Revisor de Demos", runtime: "sellora-qa" },
  ].map((agent) => ({ ...agent, type: "worker", role: "", status: "idle", currentRun: null, lastRun: null, recent: [] }));
  const bridge = http.createServer((request, response) => {
    if (request.url !== "/api/agents/events") { response.writeHead(404).end(); return; }
    response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
    response.write(`event: presence\ndata: ${JSON.stringify({ agents, at: new Date().toISOString() })}\n\n`);
    const timer = setInterval(() => response.write("event: heartbeat\ndata: {}\n\n"), 5000);
    response.on("close", () => clearInterval(timer));
  });
  await new Promise((resolve) => bridge.listen(0, "127.0.0.1", resolve));
  let office;
  let browser;
  try {
    office = startClaw3d({ appDir, stateDir, bridgeUrl: `http://127.0.0.1:${bridge.address().port}`, port: 3290, adapterPort: 19790, nodePath, log: () => {} });
    const until = Date.now() + 60000;
    let ready = false;
    while (!ready && Date.now() < until) {
      try { ready = (await fetch("http://127.0.0.1:3290/office", { signal: AbortSignal.timeout(1000) })).ok; } catch { /* iniciando */ }
      if (!ready) await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (!ready) throw new Error("Claw3D isolado não iniciou para verificar o chat.");
    browser = await chromium.launch({ channel: "msedge", headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    await page.addInitScript(() => localStorage.setItem("claw3d:onboarding:completed", "true"));
    await page.goto(office.url);
    await page.getByRole("button", { name: "CHAT", exact: true }).click();
    await expect(page.getByRole("button", { name: /Agente Gerador de Demos/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Revisor de Demos/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Agente de Prospecção/ })).toBeVisible();
    await page.getByRole("button", { name: /Agente de Prospecção/ }).click();
    await page.getByPlaceholder("type a message").fill("oque voce esta fazendo?");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(/Nenhuma tarefa em execução neste momento/)).toBeVisible();
    // O Claw3D mantém a animação de atividade por 5 s após uma fala.
    await expect(page.getByText("0 working", { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: "Start new session", exact: true }).click();
    await expect(page.getByText(/Nenhuma tarefa em execução neste momento/)).toHaveCount(0);
    await page.getByPlaceholder("type a message").fill("ajuda");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(/Consultas locais, sem IA:/)).toBeVisible();
    await page.reload();
    await page.getByRole("button", { name: "CHAT", exact: true }).click();
    await page.getByRole("button", { name: /Agente de Prospecção/ }).click();
    await expect(page.getByText(/Consultas locais, sem IA:/)).toBeVisible();
    await expect(page.getByText("0 working", { exact: true })).toBeVisible({ timeout: 15000 });
    await page.getByRole("button", { name: /Agente Gerador de Demos/ }).click();
    await page.getByPlaceholder("type a message").fill("status");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(/Nenhuma tarefa em execução neste momento/)).toBeVisible();
    await page.getByRole("button", { name: /Revisor de Demos/ }).click();
    await page.getByPlaceholder("type a message").fill("status");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page.getByText(/Nenhuma tarefa em execução neste momento/)).toBeVisible();
    await expect(page.getByText("0 working", { exact: true })).toBeVisible({ timeout: 15000 });
    await mkdir("test-results", { recursive: true });
    await page.screenshot({ path: "test-results/office-chat.png" });
    console.log("PASS chat real: preparar sessão, enviar pergunta, receber resposta, New session e histórico após recarregar (estado isolado, sem IA).");
  } finally {
    await browser?.close();
    office?.stop();
    bridge.closeAllConnections();
    await new Promise((resolve) => bridge.close(resolve));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const appDir = process.argv[process.argv.indexOf("--app-dir") + 1];
  if (!process.argv.includes("--app-dir") || !appDir) throw new Error("Informe --app-dir com o Claw3D preparado para teste.");
  await verifyOfficeChat(path.resolve(appDir));
}
