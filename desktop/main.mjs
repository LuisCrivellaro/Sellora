import { app, BrowserWindow, dialog, shell, utilityProcess } from "electron";
import path from "node:path";
import { appendFileSync } from "node:fs";
import { navigationKind } from "./policy.mjs";

let server;
let origin;
let quitting = false;
const port = 3187; // Origem estável: localStorage não muda a cada execução.
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { const win = BrowserWindow.getAllWindows()[0]; if (win) { win.restore(); win.focus(); } });
  app.whenReady().then(async () => {
    console.info("[sellora-desktop] iniciando servidor local");
    try {
      origin = `http://127.0.0.1:${port}`;
      // Nunca se conectar silenciosamente a um serviço que já ocupava a porta.
      const { createServer } = await import("node:net");
      await new Promise((resolve, reject) => { const check = createServer(); check.once("error", reject); check.listen(port, "127.0.0.1", () => check.close(resolve)); });
      const root = app.isPackaged ? path.join(process.resourcesPath, "web") : path.resolve(".desktop-web");
      server = utilityProcess.fork(path.join(root, "server.js"), [], { cwd: root, env: { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: String(port), PROSPECCAO_EXECUTOR: "osm" }, stdio: "pipe" });
      const log = (data) => appendFileSync(path.join(app.getPath("userData"), "startup.log"), data.toString());
      server.stderr?.on("data", log);
      server.stdout?.on("data", log);
      server.on("exit", () => { if (!quitting) { dialog.showErrorBox("Sellora", "O servidor local encerrou. Feche e abra o aplicativo novamente."); app.quit(); } });
      let ready = false;
      for (let i = 0; i < 100; i++) {
        try { const r = await fetch(`${origin}/api/prospeccao/status`, { signal: AbortSignal.timeout(800) }); if (r.ok) { ready = true; break; } } catch { /* starting */ }
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      if (!ready) throw new Error("Não foi possível iniciar o servidor local.");
      function windowFor(url) {
        const win = new BrowserWindow({ title: "Sellora", width: 1440, height: 960, minWidth: 800, minHeight: 600, backgroundColor: "#111111", autoHideMenuBar: true, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
        win.webContents.session.setPermissionRequestHandler((_wc, permission, callback) => callback(permission === "clipboard-sanitized-write"));
        win.webContents.on("will-navigate", (event, destination) => { if (navigationKind(destination, origin) !== "internal") event.preventDefault(); });
        win.webContents.setWindowOpenHandler(({ url: destination }) => {
          const kind = navigationKind(destination, origin);
          if (kind === "internal") windowFor(destination);
          else if (kind === "external") void shell.openExternal(destination);
          return { action: "deny" };
        });
        void win.loadURL(url);
        return win;
      }
      windowFor(`${origin}/leads?aba=demos`);
    } catch (error) { dialog.showErrorBox("Não foi possível abrir o Sellora", error.code === "EADDRINUSE" ? `A porta ${port} está ocupada. Feche outra instância do Sellora ou o serviço nessa porta.` : error.message); app.quit(); }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => { quitting = true; server?.kill(); });
}
