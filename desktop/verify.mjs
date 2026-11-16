import { chromium, expect } from "@playwright/test";
import { mkdtemp, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { displayVersion } from "../src/lib/release-version.ts";
import { verifyIndependentAgents } from "./verify-agents.mjs";
import { verifyOfficeChat } from "../integrations/claw3d/verify-chat.mjs";
import { verifyAutomaticPreparation } from "./verify-preparation.mjs";

const root = path.resolve(import.meta.dirname, "..");
const version = JSON.parse(await readFile(path.join(root, "version.json"), "utf8"));
const profile = await mkdtemp(path.join(tmpdir(), "sellora-release-qa-"));
const env = { ...process.env, SELLORA_DATA_DIR: path.join(profile, "demo-generator") };
delete env.ELECTRON_RUN_AS_NODE;
const literal = (value) => `'${value.replaceAll("'", "''")}'`;
const powershell = (command) => spawnSync("powershell.exe", ["-NoProfile", "-Command", command], { env, windowsHide: true, encoding: "utf8" });
const executable = path.join(root, `release/Sellora-${displayVersion(version)}-Windows-x64.exe`);
const launched = powershell(`Start-Process -FilePath ${literal(executable)} -ArgumentList ${literal(`--user-data-dir="${profile}"`)}`);
assert.equal(launched.status, 0, launched.stderr);
const testProcesses = `Get-CimInstance Win32_Process -Filter "Name='Sellora.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains(${literal(profile)}) }`;
let browser;
try {
  const deadline = Date.now() + 120000;
  let ready = false;
  while (!ready && Date.now() < deadline) {
    ready = (await readFile(path.join(profile, "startup.log"), "utf8").catch(() => "")).includes("Ready");
    if (!ready) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(ready, "O portátil não iniciou o servidor no perfil isolado");
  // A janela só é criada depois que o main.mjs confirma a rota de status (logo após o "Ready"): espera o título aparecer.
  let title = "";
  for (const until = Date.now() + 30000; !title.includes(`Sellora ${displayVersion(version)}`) && Date.now() < until;) {
    title = powershell(`${testProcesses} | ForEach-Object { (Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue).MainWindowTitle }`).stdout;
    if (!title.includes(`Sellora ${displayVersion(version)}`)) await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.ok(title.includes(`Sellora ${displayVersion(version)}`), "A janela desktop deve exibir a versão candidata");
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  const started = [];
  await page.route("**/api/demos/generator", (route) => route.fulfill({ json: { available: true, connected: true, imageGeneration: true, message: "Conexão simulada para teste", claude: { available: true, message: "Texto simulado para teste" } } }));
  await page.route("**/api/demos/jobs**", (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      started.push({ id: body.id, leadId: body.leadId });
      return route.fulfill({ json: { job: { id: body.id, status: "failed", phase: "Etapa simulada concluída", error: "Fim controlado do teste", result: null } } });
    }
    return route.fulfill({ json: { job: null } });
  });
  await page.goto("http://127.0.0.1:3187/leads?aba=demos");
  await page.waitForFunction(() => localStorage.getItem("sellora.db.v1"));
  await expect(page).toHaveTitle(new RegExp(`Sellora ${displayVersion(version).replace(".", "\\.")}$`));
  await expect(page.getByText(`Sellora ${displayVersion(version)} · painel interno`, { exact: true })).toBeVisible();
  const response = await page.request.get("http://127.0.0.1:3187/api/prospeccao/status");
  assert.equal((await response.json()).configured, true);
  const baseline = await page.evaluate(() => JSON.parse(localStorage.getItem("sellora.db.v1")));
  const ids = baseline.leads.slice(0, 2).map((lead) => lead.id);
  // Revisão no escritório: dados fictícios apenas no perfil isolado.
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("sellora.db.v1"));
    const lead = db.leads[0];
    const at = new Date().toISOString();
    lead.demo = { id: crypto.randomUUID(), version: 1, business: { name: lead.name, segment: lead.segment, city: lead.city, uf: lead.uf, phone: lead.phone }, message: "Olá, confira esta demonstração não oficial.", status: "approved", createdAt: at, updatedAt: at, approvedAt: at, approvedBy: "Teste isolado" };
    localStorage.setItem("sellora.db.v1", JSON.stringify(db));
  });
  await page.goto("http://127.0.0.1:3187/dashboard/cloud-3d");
  await expect(page.getByRole("heading", { name: "Ver, testar e aprovar" })).toBeVisible();
  await page.getByRole("button", { name: `${baseline.leads[0].name} · Aprovada`, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("radio", { name: "Celular", exact: true }).click();
  await expect(page.getByTitle(`Demo de ${baseline.leads[0].name}`)).toHaveAttribute("width", "390");
  await page.getByLabel("Pedir ajustes", { exact: true }).fill("Aumentar título no celular");
  await page.getByRole("button", { name: "Registrar pedido de ajuste", exact: true }).click();
  // O pedido fica pendente na demo até a próxima geração, que o aplica.
  await expect(page.getByRole("status").filter({ hasText: "ajuste pendente" })).toContainText("Aumentar título no celular");
  const reviewed = await page.evaluate(() => JSON.parse(localStorage.getItem("sellora.db.v1")));
  assert.equal(reviewed.leads[0].demo.status, "pending");
  assert.equal(reviewed.leads[0].demo.approvedAt, null);
  await page.getByRole("button", { name: "Fechar", exact: true }).click();
  console.log("PASS escritório abre entrega, alterna celular e registra ajuste com aprovação revogada");
  async function setup(individual) {
    started.length = 0;
    await page.evaluate(({ db, ids }) => {
      localStorage.setItem("sellora.db.v1", JSON.stringify(db));
      localStorage.setItem("sellora-demo-generator-v1", JSON.stringify(ids.map((leadId) => ({ leadId, id: crypto.randomUUID(), status: "paused", resumeStatus: "queued", phase: "Pausado", error: null, expectedRevision: null, textProvider: "claude", imageProvider: "codex" }))));
    }, { db: baseline, ids });
    await page.goto(`http://127.0.0.1:3187/leads?${individual ? `id=${ids[0]}` : "aba=demos"}`);
    await expect(page.getByRole("button", { name: "Retomar geração", exact: true }).first()).toBeVisible();
  }
  await setup(true);
  await page.getByRole("dialog").getByRole("button", { name: "Gerar demo e mensagem com IA", exact: true }).click();
  await expect.poll(() => started.length).toBe(1);
  await page.waitForTimeout(500);
  assert.deepEqual(started.map((job) => job.leadId), [ids[0]]);
  console.log("PASS clique individual inicia somente o lead escolhido");

  await setup(true);
  await page.getByRole("dialog").getByRole("button", { name: "Retomar geração", exact: true }).click();
  await expect.poll(() => started.length).toBe(1);
  await page.waitForTimeout(500);
  assert.deepEqual(started.map((job) => job.leadId), [ids[0]]);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem("sellora-demo-generator-v1")).filter((item) => item.status === "paused").length), 1);
  console.log("PASS retomada individual mantém o outro lead pausado");

  await setup(true);
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar geração", exact: true }).click();
  await expect(page.getByRole("dialog").getByText("Cancelado", { exact: true })).toBeVisible();
  assert.equal(started.length, 0);
  const queue = await page.evaluate(() => JSON.parse(localStorage.getItem("sellora-demo-generator-v1")));
  assert.equal(queue.find((item) => item.leadId === ids[1]).status, "paused");
  console.log("PASS cancelamento individual preserva o outro lead e os dados");

  await setup(false);
  await page.getByRole("button", { name: "Retomar geração", exact: true }).click();
  await expect.poll(() => started.length).toBe(2);
  assert.deepEqual(started.map((job) => job.leadId), ids);
  assert.equal(new Set(started.map((job) => job.id)).size, 2);
  console.log("PASS lote explícito inicia dois ids diferentes sem duplicação");
  await mkdir(path.join(root, "test-results"), { recursive: true });
  await page.screenshot({ path: path.join(root, "test-results/release-desktop.png") });
  console.log(`PASS portátil aberto e versão exibida ${displayVersion(version)}, servidor local e perfis isolados`);
  await verifyIndependentAgents(browser, "http://127.0.0.1:3187");
  await verifyAutomaticPreparation(browser, "http://127.0.0.1:3187");
  if (process.env.SELLORA_CHAT_QA_APP_DIR) await verifyOfficeChat(process.env.SELLORA_CHAT_QA_APP_DIR);
} finally {
  if (browser) {
    for (const context of browser.contexts()) for (const page of context.pages()) await page.close();
    await browser.close();
  }
  powershell(`${testProcesses} | ForEach-Object { $window = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue; if ($window -and $window.MainWindowHandle -ne 0) { $null = $window.CloseMainWindow() } }`);
}
