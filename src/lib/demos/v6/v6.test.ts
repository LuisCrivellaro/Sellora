import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { createZip, readZip, zipFolderName } from "./zip";
import { readSiteFile, readSiteManifest, writeSite, sitesRoot } from "./store";
import { postprocessSite, NOTICE_CLASS } from "./postprocess";
import { staticQa } from "./qa-static";
import { highlightLines } from "./highlight";
import { siteHeaders } from "./serve";
import { siteBriefSchema, type SiteBrief } from "./schema";
import { fallbackArtwork } from "./images";
import { summarize } from "./generator";

const brief: SiteBrief = siteBriefSchema.parse({
  analysis: { businessType: "lugar", specificSegment: "barbearia de bairro", confirmed: ["Nome e cidade"], unknown: ["Horários", "Preços"], audienceInference: "Inferência: moradores do bairro.", commercialGoal: "Levar a pessoa a chamar no WhatsApp." },
  direction: { concept: "Barbearia de esquina com cadeira de couro e luz quente", mood: "sóbrio", displayFont: "Bebas Neue", bodyFont: "Work Sans", typographyReason: "contraste", palette: { background: "#f4efe6", surface: "#e9e1d3", ink: "#1d1a16", muted: "#5a5248", accent: "#7a2e1f", accentInk: "#ffffff" }, paletteReason: "couro e madeira", imageStyle: "fotografia quente", motion: "calma", motionPlan: "entrada do hero", tone: "direto", primaryAction: "Chamar no WhatsApp", heroComposition: "fotografia de ponta a ponta com título embaixo" },
  sections: [{ id: "inicio", purpose: "hero", composition: "foto", imageId: "hero" }, { id: "servicos", purpose: "serviços", composition: "lista", imageId: null }, { id: "contato", purpose: "contato", composition: "faixa", imageId: null }],
  images: [{ id: "hero", role: "hero", aspect: "16:9", prompt: "Cadeira de barbeiro de couro sob luz quente de janela.", alt: "Cadeira de barbeiro de couro iluminada" }],
  differentiation: "Primeira demo do segmento.", message: "Olá! Preparei uma demonstração não oficial de site para a barbearia. Posso enviar o link?",
});
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Barbearia Teste em Campinas</title><meta name="description" content="Demo"><link rel="stylesheet" href="styles.css"></head>
<body><header><a href="#inicio">Barbearia Teste</a></header><main><section id="inicio"><h1>Barbearia no Cambuí, em Campinas</h1><img src="assets/hero.webp" alt="Cadeira de barbeiro" width="1600" height="900"><a href="{{WHATSAPP_LINK}}" target="_blank" rel="noopener">Chamar no WhatsApp</a> <span>{{PHONE_DISPLAY}}</span></section>
<section id="contato"><h2>Contato</h2><p onclick="alert(1)">Fale com a barbearia.</p><script>alert(1)</script></section></main><footer>Campinas</footer></body></html>`;
const css = "body{margin:0} .hero{transition: transform 160ms cubic-bezier(0.23,1,0.32,1)} @media (max-width: 600px){h1{font-size:2rem}} @media (prefers-reduced-motion: reduce){*{transition:none}}";

beforeEach(() => { process.env.SELLORA_DATA_DIR = path.join(process.cwd(), "test-results", "v6-unit", randomUUID()); });
afterEach(() => { delete process.env.SELLORA_DATA_DIR; });

it("ZIP store é lido de volta com o mesmo conteúdo e CRC", () => {
  const zip = createZip([{ name: "demo-x/index.html", data: Buffer.from("<h1>oi</h1>") }, { name: "demo-x/assets/hero.webp", data: Buffer.from([1, 2, 3, 255]) }]);
  const files = readZip(zip);
  expect([...files.keys()]).toEqual(["demo-x/index.html", "demo-x/assets/hero.webp"]);
  expect(files.get("demo-x/assets/hero.webp")).toEqual(Buffer.from([1, 2, 3, 255]));
  expect(() => createZip([{ name: "../fora.txt", data: Buffer.from("x") }])).toThrow();
  expect(zipFolderName("Barbearia São João")).toBe("demo-barbearia-sao-joao");
});

it("site gravado é imutável, só serve arquivos do manifesto e detecta adulteração", async () => {
  const id = randomUUID();
  const manifest = await writeSite(id, new Map([["index.html", Buffer.from("<h1>a</h1>")], ["styles.css", Buffer.from("body{}")]]), { "brief.json": "{}" });
  expect(manifest.map((file) => file.path)).toEqual(["index.html", "styles.css"]);
  await expect(writeSite(id, new Map([["index.html", Buffer.from("outro")]]), {})).rejects.toThrow(/não pode ser regravado/);
  expect((await readSiteFile(id, "index.html"))?.toString()).toBe("<h1>a</h1>");
  expect(await readSiteFile(id, "../meta/brief.json")).toBeNull();
  expect(await readSiteFile(id, "meta/brief.json")).toBeNull();
  await writeFile(path.join(sitesRoot(), id, "files", "index.html"), "adulterado");
  expect(await readSiteFile(id, "index.html")).toBeNull();
  expect(await readSiteManifest("nao-e-uuid")).toBeNull();
  await expect(writeSite(randomUUID(), new Map([["../x.html", Buffer.from("x")]]), {})).rejects.toThrow(/não permitido/);
});

it("pós-processamento troca marcadores, aponta imagens reais, remove scripts inline e insere o aviso", () => {
  const out = postprocessSite({ code: { html, css, js: "document.documentElement.classList.add('js');", notes: "" }, business: { name: "Barbearia Teste", city: "Campinas", uf: "SP" }, phone: "(19) 99999-0000", assets: new Map([["hero", "assets/hero.svg"]]) });
  expect(out.html).toContain("https://wa.me/5519999990000");
  expect(out.html).toContain("(19) 99999-0000");
  expect(out.html).toContain('src="assets/hero.svg"');
  expect(out.html).not.toMatch(/onclick|<script>alert/);
  expect(out.html).toContain('<script src="script.js" defer></script>');
  expect(out.html).toContain(NOTICE_CLASS);
  expect(out.html).toContain('name="robots"');
  expect(out.css).toContain(`.${NOTICE_CLASS}`);
  const noPhone = postprocessSite({ code: { html, css, js: "", notes: "" }, business: { name: "Barbearia Teste", city: "Campinas", uf: "SP" }, phone: "", assets: new Map() });
  expect(noPhone.html).not.toContain("wa.me");
  expect(noPhone.notes.join(" ")).toContain("telefone");
});

it("QA estático aprova o básico e acusa links quebrados, textos genéricos, fatos inventados e externos", () => {
  const ok = postprocessSite({ code: { html, css, js: "", notes: "" }, business: { name: "Barbearia Teste", city: "Campinas", uf: "SP" }, phone: "19999990000", assets: new Map([["hero", "assets/hero.webp"]]) });
  const clean = staticQa(ok, brief, ["assets/hero.webp"], []);
  expect(clean.critical).toEqual([]);
  expect(clean.fixable).toEqual([]);
  const bad = staticQa({ html: ok.html.replace("<h2>Contato</h2>", '<h2>Contato</h2><p>Há 20 anos de tradição, uma experiência única. Lorem ipsum.</p><a href="#galeria">Galeria</a><img src="https://cdn.exemplo.com/a.jpg" alt="x"><img src="assets/outra.webp" alt="y">'), css: "body{transition: all 1s}", js: "fetch('/x')" }, brief, ["assets/hero.webp"], [{ headline: "Barbearia no Cambuí, em Campinas", texts: [] }]);
  const all = [...bad.critical, ...bad.fixable].join(" | ");
  for (const expected of ["experiencia unica", "anos", "lorem", "#galeria", "cdn.exemplo.com", "assets/outra.webp", "@media", "transition: all", "APIs não permitidas", "Título principal igual"]) expect(all).toContain(expected);
});

it("destaque de sintaxe mantém o texto e separa linhas, inclusive comentários de várias linhas", () => {
  const source = "/* a\nb */\nbody { color: #fff; }";
  const lines = highlightLines(source, "css");
  expect(lines).toHaveLength(3);
  expect(lines.map((line) => line.map((t) => t.text).join("")).join("\n")).toBe(source);
  expect(lines[0][0].kind).toBe("comment");
  expect(highlightLines('<a href="x">', "html")[0].some((t) => t.kind === "attr")).toBe(true);
});

it("HTML do site sai com CSP sandbox, sem rede e sem formulários", () => {
  const headers = siteHeaders("html", "127.0.0.1:3187") as Record<string, string>;
  expect(headers["Content-Security-Policy"]).toMatch(/^sandbox allow-scripts allow-popups/);
  expect(headers["Content-Security-Policy"]).toContain("connect-src 'none'");
  expect(headers["Content-Security-Policy"]).toContain("form-action 'none'");
  expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  expect((siteHeaders("css", null) as Record<string, string>)["Content-Security-Policy"]).toBeUndefined();
  expect((siteHeaders("html", "evil host\r\nx") as Record<string, string>)["Content-Security-Policy"]).not.toContain("evil");
});

it("fallback SVG usa a paleta, a proporção e o alt, sem texto visível", async () => {
  const svg = fallbackArtwork(brief.images[0], brief.direction.palette, "Barbearia Teste").toString("utf8");
  expect(svg).toContain('viewBox="0 0 1600 900"');
  expect(svg).toContain(brief.direction.palette.background);
  expect(svg).toContain('aria-label="Cadeira de barbeiro de couro iluminada"');
  expect(svg).not.toMatch(/<text/);
  expect(summarize(html, brief).headline).toBe("Barbearia no Cambuí, em Campinas");
  void readFile;
});
