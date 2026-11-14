import { spawn, type ChildProcess } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Auditoria visual em navegador real (Edge/Chrome instalados, modo headless, DevTools Protocol pelo WebSocket nativo do Node).
 * Sem navegador, devolve executed=false: a demo segue só com as checagens estáticas e o relatório diz isso.
 *
 * O que é medido em cada página e largura: rolagem horizontal, imagens quebradas ou distorcidas, h1 e ação na primeira
 * tela, contraste calculado no DOM, textos sobrepostos, títulos cortados, alvos de toque, erros de JavaScript e arquivos
 * ausentes. Passagens extras: foco do teclado (Tab real), menu do celular por toque real, página com JavaScript desligado,
 * movimento reduzido e carregamento das fontes do briefing.
 */
export interface BrowserQa {
  executed: boolean; reason?: string; fixable: string[]; warnings: string[]; shots: Record<string, Buffer>;
  viewports: number[]; checks: string[];
  /** Subconjunto de `fixable` que compromete leitura ou interação (sobreposição, corte, rolagem horizontal…). */
  blocking: string[];
}

export const QA_VIEWPORTS = [
  { name: "1440", width: 1440, height: 900, mobile: false },
  { name: "1024", width: 1024, height: 768, mobile: false },
  { name: "768", width: 768, height: 1024, mobile: true },
  { name: "390", width: 390, height: 844, mobile: true },
  { name: "360", width: 360, height: 740, mobile: true },
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
  private listeners = new Map<string, Set<Listener>>();
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
  on(method: string, listener: Listener) {
    const set = this.listeners.get(method) ?? new Set();
    set.add(listener);
    this.listeners.set(method, set);
    return () => set.delete(listener);
  }
  close() { try { this.socket.close(); } catch { /* already closed */ } }
}

/**
 * Encerra o navegador de auditoria. No Windows o Edge 157 relança a si mesmo: o processo que o app abre sai em
 * milissegundos e o navegador real fica com outro PID. Por isso, lá, encerra todo processo que usa o perfil
 * temporário desta auditoria (caminho único criado por mkdtemp).
 */
export function killBrowser(child: ChildProcess | undefined, profile?: string): Promise<void> {
  if (process.platform !== "win32") { if (child?.exitCode === null) child.kill(); return Promise.resolve(); }
  if (child?.exitCode === null) child.kill();
  if (!profile || !/^[\w:\\/. -]+$/.test(profile)) return Promise.resolve();
  const script = `Get-CimInstance Win32_Process -Filter "Name='msedge.exe' OR Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*${profile.replace(/'/g, "")}*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;
  return new Promise((resolve) => {
    const killer = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, stdio: "ignore" });
    const done = () => { clearTimeout(limit); resolve(); };
    const limit = setTimeout(() => { killer.kill(); resolve(); }, 15_000);
    killer.on("error", done);
    killer.on("exit", done);
  });
}

/**
 * Endereço DevTools do navegador: pela linha "DevTools listening on" no stderr ou, nas versões que não
 * a escrevem mais (Edge 157), pelo arquivo DevToolsActivePort que o navegador grava no perfil.
 */
export function endpointFromActivePort(content: string): string | null {
  const [port, browserPath] = content.split(String.fromCharCode(10)).map((line) => line.trim());
  return /^\d+$/.test(port ?? "") && browserPath?.startsWith("/devtools/browser/") ? `ws://127.0.0.1:${port}${browserPath}` : null;
}

function launch(browser: string, profile: string): Promise<{ child: ChildProcess; endpoint: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(browser, ["--headless=new", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--no-first-run", "--no-default-browser-check",
      "--disable-extensions", "--disable-sync", "--disable-background-networking", "--disable-component-update", "--hide-scrollbars", "--mute-audio",
      "--disable-gpu", "--allow-file-access-from-files", "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
    let settled = false;
    const finish = (endpoint: string) => { if (settled) return; settled = true; clearTimeout(timer); clearInterval(poll); resolve({ child, endpoint }); };
    const timer = setTimeout(() => { settled = true; clearInterval(poll); void killBrowser(child, profile); reject(new Error("O navegador de auditoria não respondeu.")); }, 20_000);
    const poll = setInterval(() => {
      void readFile(path.join(profile, "DevToolsActivePort"), "utf8").then((content) => { const endpoint = endpointFromActivePort(content); if (endpoint) finish(endpoint); }).catch(() => {});
    }, 250);
    let buffer = "";
    child.stderr!.on("data", (chunk) => {
      buffer += chunk;
      const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) finish(match[1]);
    });
    child.on("error", () => { settled = true; clearTimeout(timer); clearInterval(poll); reject(new Error("Não foi possível abrir o navegador de auditoria.")); });
  });
}

/** Funções comuns às medições, avaliadas dentro da página. */
const HELPERS = `
  const vw = document.documentElement.clientWidth, vh = innerHeight;
  const label = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\\s+/)[0] : '');
  /** Rótulo com trecho do texto: "p × p" não deixa a correção encontrar o elemento. */
  const named = (el) => { const t = (el.textContent || '').replace(/\\s+/g, ' ').trim(); return label(el) + (t ? ' "' + (t.length > 38 ? t.slice(0, 38) + '…' : t) + '"' : ''); };
  /** Conteúdo de <details> fechado não é desenhado, mas ainda devolve caixas empilhadas (falso positivo de sobreposição). */
  const inClosedDetails = (el) => { const d = el.closest('details:not([open])'); return !!d && d !== el && !el.closest('summary'); };
  const shown = (el) => {
    if (!el || inClosedDetails(el)) return false;
    if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    const s = getComputedStyle(el); const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0.05;
  };
  const visible = (el) => shown(el) && el.getBoundingClientRect().top < vh && el.getBoundingClientRect().bottom > 0;
  const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
  const notice = (el) => !!el.closest('.sellora-demo-notice');
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = async () => {
    await (document.fonts ? document.fonts.ready.catch(() => {}) : null);
    await Promise.all([...document.images].map((i) => i.complete ? null : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); setTimeout(r, 5000); })));
    await wait(1300);
  };
  /** Rola a página inteira (como uma pessoa faria) para disparar revelações ao rolar; depois volta ao topo. */
  const revealAll = async () => {
    const step = Math.max(240, Math.floor(vh * 0.7));
    const end = document.documentElement.scrollHeight;
    for (let y = 0, n = 0; y < end && n < 60; y += step, n++) { window.scrollTo({ top: y, behavior: 'instant' }); await wait(90); }
    window.scrollTo({ top: end, behavior: 'instant' }); await wait(500);
    window.scrollTo({ top: 0, behavior: 'instant' }); await wait(900);
  };
  /** Elementos de conteúdo que continuam transparentes ou ocultos (no próprio elemento ou num ancestral). */
  const hiddenContent = () => [...document.querySelectorAll('main h1, main h2, main h3, main p, main img, main a, main li')].filter((el) => {
    if (notice(el) || inClosedDetails(el) || el.closest('nav, [hidden], [aria-hidden="true"], dialog')) return false;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return false;
    let node = el; while (node && node.nodeType === 1) { const s = getComputedStyle(node); if (Number(s.opacity) < 0.05 || s.visibility === 'hidden') return true; node = node.parentElement; }
    return false;
  }).map(label);
`;

/** Medições principais, depois de fontes, imagens e da entrada do hero. */
function metricsScript(fonts: string[]) {
  return `(async () => {
  ${HELPERS}
  await settle();
  await revealAll();
  const stillHidden = [...new Set(hiddenContent())];
  const off = [];
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && (r.right > vw + 2 || r.left < -2) && getComputedStyle(el).position !== 'fixed' && !el.closest('[aria-hidden="true"]')) { off.push(label(el)); if (off.length >= 4) break; }
  }
  const broken = [...document.images].filter((i) => !i.naturalWidth).map((i) => i.getAttribute('src'));
  const distorted = [], upscaled = [];
  for (const img of [...document.images].filter((i) => i.naturalWidth && shown(i))) {
    const r = img.getBoundingClientRect(); const fit = getComputedStyle(img).objectFit;
    if ((fit === 'fill' || fit === '') && Math.abs(r.width / r.height - img.naturalWidth / img.naturalHeight) > 0.06) distorted.push(img.getAttribute('src'));
    if (r.width * devicePixelRatio > img.naturalWidth * 1.6) upscaled.push(img.getAttribute('src'));
  }
  const h1 = document.querySelector('h1');
  const actions = [...document.querySelectorAll('a[href], button')].filter((a) => visible(a) && !a.closest('nav') && !notice(a));
  const parse = (c) => { const m = c.match(/rgba?\\(([^)]+)\\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map((x) => parseFloat(x)); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = (c) => [c.r, c.g, c.b].map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const lowContrast = [];
  for (const el of [...document.querySelectorAll('h1,h2,h3,h4,p,li,a,button,span,dd,dt,small,strong,em,label')].slice(0, 500)) {
    if (!el.textContent.trim() || notice(el) || !ownText(el)) continue;
    const s = getComputedStyle(el); const fg = parse(s.color); if (!fg || !shown(el)) continue;
    let node = el, bg = null, image = false;
    while (node && node.nodeType === 1) { const ns = getComputedStyle(node); if (ns.backgroundImage !== 'none') { image = true; break; } const c = parse(ns.backgroundColor); if (c && c.a > 0.9) { bg = c; break; } node = node.parentElement; }
    if (image) continue; if (!bg) bg = { r: 255, g: 255, b: 255, a: 1 };
    const a = lum(fg), b = lum(bg); const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const size = parseFloat(s.fontSize), large = size >= 24 || (size >= 18.6 && Number(s.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5)) { lowContrast.push(label(el) + ' ' + ratio.toFixed(2) + ':1'); if (lowContrast.length >= 4) break; }
  }
  // Sobreposição medida nas caixas de linha (getClientRects), não na união do elemento: um link que quebra linha
  // dentro de um parágrafo não "cobre" a palavra ao lado. Texto decorativo com aria-hidden fica de fora.
  const leaves = [...document.querySelectorAll('h1,h2,h3,h4,p,a,button,li,small,strong,span,dd,dt,summary,label')].filter((el) => !notice(el) && ownText(el) && shown(el) && !el.closest('[aria-hidden="true"]')).slice(0, 300);
  const rects = leaves.map((el) => ({ el, boxes: [...el.getClientRects()].filter((r) => r.width > 2 && r.height > 2), fixed: !!el.closest('[style*="position: fixed"]') || ['fixed', 'sticky'].includes(getComputedStyle(el.closest('header') || el).position) }));
  const overlaps = [];
  for (let i = 0; i < rects.length && overlaps.length < 3; i++) for (let j = i + 1; j < rects.length; j++) {
    const A = rects[i], B = rects[j];
    if (A.fixed || B.fixed || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    let hit = null;
    for (const a of A.boxes) { for (const b of B.boxes) {
      const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
      if (w > 2 && h > 2 && w * h > 0.3 * Math.min(a.width * a.height, b.width * b.height)) { hit = { w: Math.round(w), h: Math.round(h), y: Math.round(Math.max(a.top, b.top) + scrollY) }; break; }
    } if (hit) break; }
    if (hit) { overlaps.push(named(A.el) + ' × ' + named(B.el) + ' (' + hit.w + '×' + hit.h + ' px, a ' + hit.y + ' px do topo)'); break; }
  }
  const clipped = [...document.querySelectorAll('h1,h2,h3')].filter((el) => shown(el) && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX !== 'visible').map(label);
  const small = [...document.querySelectorAll('p,li,a,span,small,dd')].filter((el) => !notice(el) && el.textContent.trim() && parseFloat(getComputedStyle(el).fontSize) < 12 && el.getBoundingClientRect().width > 0).length;
  const taps = [...document.querySelectorAll('a[href], button')].filter((el) => { const r = el.getBoundingClientRect(); return shown(el) && r.height < 40 && !el.closest('p, li p') && !notice(el); }).map(label);
  const fonts = ${JSON.stringify(fonts)}.map((f) => ({ font: f, ok: document.fonts ? document.fonts.check('16px "' + f + '"') : true }));
  const fontRequests = performance.getEntriesByType('resource').filter((e) => /fonts\\.(googleapis|gstatic)\\.com/.test(e.name)).length;
  const heroActions = [...document.querySelectorAll('main a[href], main button')].filter((a) => visible(a) && !notice(a)).length;
  return { overflow: document.documentElement.scrollWidth - vw, off, broken, distorted, upscaled, h1Visible: visible(h1), actionVisible: actions.length > 0, lowContrast, overlaps, clipped, small, taps, fonts, fontRequests, heroActions, height: document.documentElement.scrollHeight, stillHidden };
})()`;
}

/** Conteúdo invisível (sem JavaScript ou com movimento reduzido) e animações em execução. */
const HIDDEN_SCRIPT = `(async () => {
  ${HELPERS}
  await settle();
  const hidden = hiddenContent();
  const running = document.getAnimations ? document.getAnimations().filter((a) => a.playState === 'running') : [];
  const infinite = running.filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity).length;
  return { hidden: [...new Set(hidden)].slice(0, 5), hiddenCount: hidden.length, infinite, running: running.length };
})()`;

const FOCUS_SCRIPT = `(() => {
  const el = document.activeElement;
  if (!el || el === document.body) return { none: true };
  const s = getComputedStyle(el); const r = el.getBoundingClientRect();
  const ring = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== 'none');
  return { none: false, ring, onScreen: r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight, tag: el.tagName.toLowerCase() };
})()`;

const NAV_SCRIPT = `(() => {
  const links = [...document.querySelectorAll('header nav a, nav a')];
  const shown = (el) => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0.05 && r.bottom > 0 && r.top < innerHeight; };
  const toggle = [...document.querySelectorAll('button[aria-expanded], [aria-controls]')].find(shown);
  const r = toggle ? toggle.getBoundingClientRect() : null;
  return { links: links.length, visible: links.filter(shown).length, toggle: toggle ? { x: r.left + r.width / 2, y: r.top + r.height / 2, expanded: toggle.getAttribute('aria-expanded') } : null };
})()`;

export interface BrowserQaOptions { pages?: string[]; fonts?: string[]; timeoutMs?: number }

export async function browserQa(siteDir: string, options: BrowserQaOptions | number = {}): Promise<BrowserQa> {
  const opts: BrowserQaOptions = typeof options === "number" ? { timeoutMs: options } : options;
  const pages = opts.pages?.length ? opts.pages : ["index.html"];
  const fonts = (opts.fonts ?? []).filter((font) => /^[\w .-]{2,40}$/.test(font));
  const browser = await findBrowser();
  const empty = (reason: string): BrowserQa => ({ executed: false, reason, fixable: [], blocking: [], warnings: [], shots: {}, viewports: [], checks: [] });
  if (!browser) return empty("Nenhum Edge ou Chrome encontrado para a auditoria visual.");
  const profile = await mkdtemp(path.join(tmpdir(), "sellora-qa-"));
  const cleanup: string[] = [];
  let child: ChildProcess | undefined;
  let cdp: Cdp | undefined;
  const deadline = setTimeout(() => { void killBrowser(child, profile); }, opts.timeoutMs ?? 240_000);
  const result: BrowserQa = { executed: true, fixable: [], blocking: [], warnings: [], shots: {}, viewports: QA_VIEWPORTS.map((v) => v.width), checks: [] };
  /** Defeito que compromete leitura ou interação: corrigível, mas impede a aprovação automática enquanto existir. */
  const block = (issue: string) => { result.fixable.push(issue); result.blocking.push(issue); };
  try {
    const launched = await launch(browser, profile);
    child = launched.child;
    cdp = await Cdp.connect(launched.endpoint);
    const session = cdp;
    const { targetId } = await session.send("Target.createTarget", { url: "about:blank" }) as { targetId: string };
    const { sessionId } = await session.send("Target.attachToTarget", { targetId, flatten: true }) as { sessionId: string };
    const errors = new Set<string>();
    const failed = new Set<string>();
    const urls = new Map<string, string>();
    session.on("Runtime.exceptionThrown", (params) => errors.add(String((params.exceptionDetails as { text?: string; exception?: { description?: string } })?.exception?.description ?? (params.exceptionDetails as { text?: string })?.text ?? "erro").split("\n")[0]));
    session.on("Runtime.consoleAPICalled", (params) => { if (params.type === "error") errors.add(String((params.args as { value?: unknown; description?: string }[])?.[0]?.value ?? (params.args as { description?: string }[])?.[0]?.description ?? "console.error").slice(0, 160)); });
    session.on("Network.requestWillBeSent", (params) => urls.set(String(params.requestId), String((params.request as { url: string }).url)));
    session.on("Network.loadingFailed", (params) => { const url = urls.get(String(params.requestId)) ?? ""; if (!params.canceled) failed.add(url); });
    for (const method of ["Page.enable", "Runtime.enable", "Network.enable"]) await session.send(method, {}, sessionId);
    const send = (method: string, params: object = {}) => session.send(method, params, sessionId);
    const evaluate = async <T>(expression: string) => ((await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true })) as { result?: { value?: T } }).result?.value;
    const open = async (file: string) => {
      const loaded = new Promise<void>((resolve) => {
        const stop = session.on("Page.loadEventFired", (_, from) => { if (from === sessionId) { stop(); resolve(); } });
        setTimeout(() => { stop(); resolve(); }, 20_000);
      });
      await send("Page.navigate", { url: pathToFileURL(path.join(siteDir, file)).href });
      await loaded;
    };
    const viewport = (v: (typeof QA_VIEWPORTS)[number]) => Promise.all([
      send("Emulation.setDeviceMetricsOverride", { width: v.width, height: v.height, deviceScaleFactor: 1, mobile: v.mobile }),
      send("Emulation.setTouchEmulationEnabled", v.mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false }),
    ]);
    const shot = async (name: string, full: { height: number; width: number; scale: number } | null) => {
      const data = await send("Page.captureScreenshot", full ? { format: "png", captureBeyondViewport: true, clip: { x: 0, y: 0, width: full.width, height: full.height, scale: full.scale } } : { format: "png" }) as { data: string };
      result.shots[name] = Buffer.from(data.data, "base64");
    };
    type Metrics = { overflow: number; off: string[]; broken: string[]; distorted: string[]; upscaled: string[]; h1Visible: boolean; actionVisible: boolean; lowContrast: string[]; overlaps: string[]; clipped: string[]; small: number; taps: string[]; fonts: { font: string; ok: boolean }[]; fontRequests: number; heroActions: number; height: number; stillHidden: string[] };

    for (const file of pages) {
      const at = pages.length > 1 ? `${file} ` : "";
      const slug = file === "index.html" ? "" : `${file.replace(/\.html$/, "")}-`;
      for (const v of QA_VIEWPORTS) {
        await viewport(v);
        await open(file);
        const m = await evaluate<Metrics>(metricsScript(fonts));
        if (!m) { result.warnings.push(`Não foi possível medir ${at}em ${v.name} px.`); continue; }
        if (m.overflow > 2) block(`Rolagem horizontal em ${at}${v.name} px (${m.overflow}px a mais)${m.off.length ? `; elementos passando da tela: ${m.off.join(", ")}` : ""}.`);
        if (m.broken.length) block(`Imagens que não carregaram em ${at}${v.name} px: ${m.broken.join(", ")}.`);
        if (m.distorted.length) result.fixable.push(`Imagem distorcida em ${at}${v.name} px (${m.distorted.join(", ")}); use object-fit: cover.`);
        if (m.upscaled.length && v.name === "1440") result.warnings.push(`Imagem ampliada além da resolução em ${at}${v.name} px (${m.upscaled.join(", ")}).`);
        if (file === "index.html" && !m.h1Visible) block(`O h1 não fica visível na primeira tela em ${v.name} px.`);
        if (file === "index.html" && !m.actionVisible && v.name !== "768") result.fixable.push(`Nenhuma ação (link ou botão fora do menu) visível na primeira tela em ${v.name} px.`);
        if (file === "index.html" && m.heroActions > 3 && v.name === "1440") result.warnings.push(`${m.heroActions} ações na primeira tela; o guia pede uma ação principal e no máximo uma secundária.`);
        if (m.lowContrast.length) result.fixable.push(`Contraste insuficiente em ${at}${v.name} px: ${m.lowContrast.join("; ")}.`);
        if (m.overlaps.length) block(`Textos sobrepostos em ${at}${v.name} px: ${m.overlaps.join("; ")}.`);
        if (m.stillHidden.length) block(`Conteúdo continua invisível depois de rolar a página inteira em ${at}${v.name} px (${m.stillHidden.slice(0, 4).join(", ")}); toda revelação ao rolar precisa terminar visível.`);
        if (m.clipped.length) block(`Título cortado em ${at}${v.name} px: ${m.clipped.slice(0, 3).join(", ")}.`);
        if (m.small > 0) result.warnings.push(`${m.small} textos com menos de 12px em ${at}${v.name} px.`);
        if ((v.name === "390" || v.name === "360") && m.taps.length > 2) result.fixable.push(`${m.taps.length} links ou botões com menos de 40px de altura no celular (${at}${v.name} px): ${m.taps.slice(0, 3).join(", ")}.`);
        if (v.name === "1440" && m.fontRequests > 0) for (const font of m.fonts.filter((item) => !item.ok)) result.fixable.push(`A fonte ${font.font} não carregou (nome errado ou família inexistente no Google Fonts).`);
        if (v.name === "1440" || v.name === "390") {
          await shot(`shot-${slug}${v.name}.png`, null);
          if (!slug) await shot(`shot-${v.name}-full.png`, { width: v.width, height: Math.min(m.height, 9000), scale: v.name === "1440" ? 0.5 : 0.8 });
        }
        if (v.name === "390") {
          const nav = await evaluate<{ links: number; visible: number; toggle: { x: number; y: number; expanded: string | null } | null }>(NAV_SCRIPT);
          if (nav && nav.links > 0 && nav.visible === 0) {
            if (!nav.toggle) block(`Em 390 px a navegação de ${file} some e não há botão de menu.`);
            else {
              for (const type of ["touchStart", "touchEnd"]) await send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchStart" ? [{ x: nav.toggle.x, y: nav.toggle.y }] : [] });
              await new Promise((resolve) => setTimeout(resolve, 500));
              const after = await evaluate<{ visible: number; toggle: { expanded: string | null } | null }>(NAV_SCRIPT);
              if (!after || after.visible === 0) block(`Em 390 px o botão de menu de ${file} não abre a navegação ao toque.`);
              else if (after.toggle && after.toggle.expanded !== "true") result.fixable.push(`O botão de menu de ${file} não atualiza aria-expanded ao abrir.`);
            }
            result.checks.push(`menu do celular por toque (${file})`);
          }
        }
      }
    }
    result.checks.push(`${pages.length} página(s) em ${QA_VIEWPORTS.map((v) => v.name).join(", ")} px`);

    // Teclado: Tab real a partir do topo da página inicial, em 1440 px.
    await viewport(QA_VIEWPORTS[0]);
    await open("index.html");
    let focused = 0, ring = 0, hiddenFocus = 0;
    for (let i = 0; i < 8; i += 1) {
      for (const type of ["keyDown", "keyUp"]) await send("Input.dispatchKeyEvent", { type, key: "Tab", code: "Tab", windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9 });
      const state = await evaluate<{ none: boolean; ring?: boolean; onScreen?: boolean }>(FOCUS_SCRIPT);
      if (!state || state.none) break;
      focused += 1;
      if (state.ring) ring += 1;
      if (!state.onScreen) hiddenFocus += 1;
    }
    if (focused && !ring) result.fixable.push("O foco do teclado não fica visível (Tab em 1440 px): defina :focus-visible com contorno da paleta.");
    else if (focused && ring < focused) result.warnings.push(`${focused - ring} de ${focused} elementos focados pelo Tab sem contorno visível.`);
    if (hiddenFocus) result.warnings.push(`${hiddenFocus} elementos recebem foco fora da tela.`);
    result.checks.push("foco do teclado (Tab)");

    // Sem JavaScript: todo o conteúdo precisa aparecer. A cópia sem scripts fica numa pasta temporária própria
    // (o navegador não abre arquivos do perfil), com <base> apontando para os arquivos do site.
    const original = await readFile(path.join(siteDir, "index.html"), "utf8");
    const base = `<base href="${pathToFileURL(siteDir).href.replace(/\/?$/, "/")}">`;
    const copyDir = await mkdtemp(path.join(tmpdir(), "sellora-qa-semjs-"));
    cleanup.push(copyDir);
    await writeFile(path.join(copyDir, "sem-js.html"), original.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<head([^>]*)>/i, `<head$1>${base}`));
    await new Promise<void>((resolve) => {
      const stop = session.on("Page.loadEventFired", (_, from) => { if (from === sessionId) { stop(); resolve(); } });
      setTimeout(() => { stop(); resolve(); }, 20_000);
      void send("Page.navigate", { url: pathToFileURL(path.join(copyDir, "sem-js.html")).href });
    });
    const noJs = await evaluate<{ hidden: string[]; hiddenCount: number }>(HIDDEN_SCRIPT).catch(() => undefined);
    if (!noJs) result.warnings.push("Não foi possível medir a página com JavaScript desligado.");
    else { if (noJs.hiddenCount) block(`Sem JavaScript, ${noJs.hiddenCount} elemento(s) ficam invisíveis (${noJs.hidden.join(", ")}); o estado inicial das animações deve depender da classe .js.`); result.checks.push("página sem JavaScript"); }

    // Movimento reduzido em 390 px: nada animando sem fim e nada escondido.
    await viewport(QA_VIEWPORTS[3]);
    await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
    await open("index.html");
    const reduced = await evaluate<{ hidden: string[]; hiddenCount: number; infinite: number; running: number }>(HIDDEN_SCRIPT);
    await send("Emulation.setEmulatedMedia", { features: [] });
    if (reduced) {
      if (reduced.hiddenCount) block(`Com movimento reduzido, ${reduced.hiddenCount} elemento(s) ficam invisíveis (${reduced.hidden.join(", ")}).`);
      if (reduced.infinite) result.fixable.push(`Com movimento reduzido ainda há ${reduced.infinite} animação(ões) infinita(s).`);
      result.checks.push("movimento reduzido");
    }

    for (const error of errors) result.fixable.push(`Erro de JavaScript no navegador: ${error}`);
    for (const url of failed) {
      if (/fonts\.(googleapis|gstatic)\.com/.test(url)) result.warnings.push("Google Fonts não carregou na auditoria (sem internet?): a verificação das fontes não foi feita.");
      else if (url.startsWith("file:")) result.fixable.push(`Arquivo não encontrado: ${path.basename(decodeURIComponent(url))}.`);
    }
    result.fixable = [...new Set(result.fixable)];
    result.blocking = [...new Set(result.blocking)];
    result.warnings = [...new Set(result.warnings)];
    return result;
  } catch (error) {
    return empty(error instanceof Error ? error.message : "Auditoria visual interrompida.");
  } finally {
    clearTimeout(deadline);
    cdp?.close();
    await killBrowser(child, profile);
    await new Promise((resolve) => setTimeout(resolve, 300));
    for (const dir of [profile, ...cleanup]) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
