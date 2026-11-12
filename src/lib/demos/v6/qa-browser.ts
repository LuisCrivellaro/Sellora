import { spawn, type ChildProcess } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Auditoria visual em navegador real (Edge/Chrome instalados, modo headless, DevTools Protocol pelo WebSocket nativo do Node).
 * Sem navegador, devolve executed=false: a demo segue só com as checagens estáticas e o relatório diz isso.
 */
export interface BrowserQa { executed: boolean; reason?: string; fixable: string[]; warnings: string[]; shots: Record<string, Buffer> }

export const QA_VIEWPORTS = [
  { name: "1440", width: 1440, height: 900, mobile: false },
  { name: "1024", width: 1024, height: 768, mobile: false },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "390", width: 390, height: 844, mobile: true },
] as const;

export async function findBrowser(): Promise<string | null> {
  const candidates = [
    process.env.SELLORA_QA_BROWSER,
    process.env["ProgramFiles(x86)"] && path.join(process.env["ProgramFiles(x86)"], "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, "Google", "Chrome", "Application", "chrome.exe"),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"),
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter((item): item is string => !!item);
  for (const candidate of candidates) if (await access(candidate).then(() => true, () => false)) return candidate;
  return null;
}

type Listener = (params: Record<string, unknown>, sessionId?: string) => void;
class Cdp {
  private sequence = 0;
  private pending = new Map<number, { resolve: (value: Record<string, unknown>) => void; reject: (error: Error) => void }>();
  private listeners = new Map<string, Listener[]>();
  private constructor(private socket: WebSocket) {
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as { id?: number; result?: Record<string, unknown>; error?: { message: string }; method?: string; params?: Record<string, unknown>; sessionId?: string };
      if (message.id !== undefined) {
        const waiting = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) waiting?.reject(new Error(message.error.message)); else waiting?.resolve(message.result ?? {});
      } else if (message.method) for (const listener of this.listeners.get(message.method) ?? []) listener(message.params ?? {}, message.sessionId);
    });
  }
  static connect(url: string): Promise<Cdp> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url);
      socket.addEventListener("open", () => resolve(new Cdp(socket)), { once: true });
      socket.addEventListener("error", () => reject(new Error("Falha ao conectar ao navegador de auditoria.")), { once: true });
    });
  }
  send(method: string, params: object = {}, sessionId?: string): Promise<Record<string, unknown>> {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
      setTimeout(() => { if (this.pending.delete(id)) reject(new Error(`Tempo esgotado em ${method}.`)); }, 30_000);
    });
  }
  on(method: string, listener: Listener) { this.listeners.set(method, [...(this.listeners.get(method) ?? []), listener]); }
  close() { try { this.socket.close(); } catch { /* already closed */ } }
}

function launch(browser: string, profile: string): Promise<{ child: ChildProcess; endpoint: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(browser, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
      "--disable-extensions", "--disable-sync", "--disable-background-networking", "--disable-component-update", "--hide-scrollbars", "--mute-audio",
      "--disable-gpu", "--allow-file-access-from-files", "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    const timer = setTimeout(() => { child.kill(); reject(new Error("O navegador de auditoria não respondeu.")); }, 20_000);
    let buffer = "";
    child.stderr!.on("data", (chunk) => {
      buffer += chunk;
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) { clearTimeout(timer); resolve({ child, endpoint: match[1] }); }
    });
    child.on("error", () => { clearTimeout(timer); reject(new Error("Não foi possível abrir o navegador de auditoria.")); });
  });
}

/** Medições feitas dentro da página, depois de fontes, imagens e da entrada do hero. */
const METRICS = `(async () => {
  await (document.fonts ? document.fonts.ready.catch(() => {}) : null);
  await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 5000); })));
  await new Promise((r) => setTimeout(r, 1300));
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const label = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/)[0] : '');
  const off = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > vw + 2 && getComputedStyle(el).position !== 'fixed' && !el.closest('[aria-hidden="true"]')) { off.push(label(el)); if (off.length >= 4) break; }
  }
  const broken = [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'));
  const visible = (el) => { if (!el) return false; const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.top < vh && r.bottom > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0.05; };
  const h1 = document.querySelector('h1');
  const actions = [...document.querySelectorAll('a[href], button')].filter((a) => visible(a) && !a.closest('nav') && !a.classList.contains('${"sellora-demo-notice"}'));
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(',').map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const lowContrast = [];
  for (const el of [...document.querySelectorAll('h1,h2,h3,p,li,a,button,span,dd,dt,small')].slice(0, 400)) {
    if (!el.textContent.trim() || el.closest('.sellora-demo-notice') || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const s = getComputedStyle(el); const fg = parse(s.color); if (!fg || s.visibility === 'hidden' || Number(s.opacity) < 0.05) continue;
    let node = el, bg = null, image = false;
    while (node && node.nodeType === 1) { const ns = getComputedStyle(node); if (ns.backgroundImage !== 'none') { image = true; break; } const c = parse(ns.backgroundColor); if (c && c.a > 0.9) { bg = c; break; } node = node.parentElement; }
    if (image) continue; if (!bg) bg = { r: 255, g: 255, b: 255, a: 1 };
    const a = lum(fg), b = lum(bg); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(s.fontSize), large = size >= 24 || (size >= 18.6 && Number(s.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) { lowContrast.push(label(el) + ' ' + ratio.toFixed(2) + ':1'); if (lowContrast.length >= 4) break; }
  }
  const small = [...document.querySelectorAll('p,li,a,span,small,dd')].filter((el) => !el.closest('.sellora-demo-notice') && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 12 && el.getBoundingClientRect().width > 0).length;
  const taps = [...document.querySelectorAll('a[href], button')].filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 40 && !el.closest('p, li p'); }).length;
  return { overflow: document.documentElement.scrollWidth - vw, off, broken, h1Visible: visible(h1), actionVisible: actions.length > 0, lowContrast, small, taps, height: document.documentElement.scrollHeight };
})()`;

export async function browserQa(siteDir: string, timeoutMs = 150_000): Promise<BrowserQa> {
  const browser = await findBrowser();
  if (!browser) return { executed: false, reason: "Nenhum Edge ou Chrome encontrado para a auditoria visual.", fixable: [], warnings: [], shots: {} };
  const profile = await mkdtemp(path.join(tmpdir(), "sellora-qa-"));
  let child: ChildProcess | undefined;
  let cdp: Cdp | undefined;
  const deadline = setTimeout(() => { child?.kill(); }, timeoutMs);
  const result: BrowserQa = { executed: true, fixable: [], warnings: [], shots: {} };
  try {
    const launched = await launch(browser, profile);
    child = launched.child;
    cdp = await Cdp.connect(launched.endpoint);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
    const errors = new Set<string>();
    const failed = new Set<string>();
    const urls = new Map<string, string>();
    cdp.on("Runtime.exceptionThrown", (params) => errors.add(String((params.exceptionDetails as { text?: string; exception?: { description?: string } })?.exception?.description ?? (params.exceptionDetails as { text?: string })?.text ?? "erro").split("\n")[0]));
    cdp.on("Runtime.consoleAPICalled", (params) => { if (params.type === "error") errors.add(String((params.args as { value?: unknown; description?: string }[])?.[0]?.value ?? (params.args as { description?: string }[])?.[0]?.description ?? "console.error").slice(0, 160)); });
    cdp.on("Network.requestWillBeSent", (params) => urls.set(String(params.requestId), String((params.request as { url: string }).url)));
    cdp.on("Network.loadingFailed", (params) => { const url = urls.get(String(params.requestId)) ?? ""; if (!params.canceled) failed.add(url); });
    for (const method of ["Page.enable", "Runtime.enable", "Network.enable"]) await cdp.send(method, {}, sessionId);
    const page = pathToFileURL(path.join(siteDir, "index.html")).href;
    for (const viewport of QA_VIEWPORTS) {
      await cdp.send("Emulation.setDeviceMetricsOverride", { width: viewport.width, height: viewport.height, deviceScaleFactor: 1, mobile: viewport.mobile }, sessionId);
      const loaded = new Promise<void>((resolve) => { cdp!.on("Page.loadEventFired", (_, session) => { if (session === sessionId) resolve(); }); setTimeout(resolve, 20_000); });
      await cdp.send("Page.navigate", { url: page }, sessionId);
      await loaded;
      const evaluated = await cdp.send("Runtime.evaluate", { expression: METRICS, awaitPromise: true, returnByValue: true }, sessionId) as { result?: { value?: Record<string, unknown> } };
      const m = evaluated.result?.value as { overflow: number; off: string[]; broken: string[]; h1Visible: boolean; actionVisible: boolean; lowContrast: string[]; small: number; taps: number; height: number } | undefined;
      if (!m) { result.warnings.push(`Não foi possível medir a página em ${viewport.name} px.`); continue; }
      if (m.overflow > 2) result.fixable.push(`Rolagem horizontal em ${viewport.name} px (${m.overflow}px a mais)${m.off.length ? `; elementos passando da tela: ${m.off.join(", ")}` : ""}.`);
      if (m.broken.length) result.fixable.push(`Imagens que não carregaram em ${viewport.name} px: ${m.broken.join(", ")}.`);
      if (!m.h1Visible) result.fixable.push(`O h1 não fica visível na primeira tela em ${viewport.name} px.`);
      if (!m.actionVisible && viewport.name !== "768") result.fixable.push(`Nenhuma ação (link ou botão fora do menu) visível na primeira tela em ${viewport.name} px.`);
      if (m.lowContrast.length) result.fixable.push(`Contraste insuficiente em ${viewport.name} px: ${m.lowContrast.join("; ")}.`);
      if (m.small > 0) result.warnings.push(`${m.small} textos com menos de 12px em ${viewport.name} px.`);
      if (viewport.name === "390" && m.taps > 2) result.fixable.push(`${m.taps} links ou botões com menos de 40px de altura no celular (390 px).`);
      if (viewport.name === "1440" || viewport.name === "390") {
        const fold = await cdp.send("Page.captureScreenshot", { format: "png" }, sessionId) as { data: string };
        result.shots[`shot-${viewport.name}.png`] = Buffer.from(fold.data, "base64");
        const height = Math.min(m.height, 9000);
        const scale = viewport.name === "1440" ? 0.5 : 0.8;
        const full = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: viewport.width, height, scale } }, sessionId) as { data: string };
        result.shots[`shot-${viewport.name}-full.png`] = Buffer.from(full.data, "base64");
      }
    }
    for (const error of errors) result.fixable.push(`Erro de JavaScript no navegador: ${error}`);
    for (const url of failed) {
      if (/fonts\.(googleapis|gstatic)\.com/.test(url)) result.warnings.push("Google Fonts não carregou na auditoria (sem internet?).");
      else if (url.startsWith("file:")) result.fixable.push(`Arquivo não encontrado: ${path.basename(url)}.`);
    }
    result.fixable = [...new Set(result.fixable)];
    result.warnings = [...new Set(result.warnings)];
    return result;
  } catch (error) {
    return { executed: false, reason: error instanceof Error ? error.message : "Auditoria visual interrompida.", fixable: [], warnings: [], shots: {} };
  } finally {
    clearTimeout(deadline);
    cdp?.close();
    child?.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}
