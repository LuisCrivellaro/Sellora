import { randomUUID } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { leadDemoSchema } from "../model";
import { BUSINESSES, briefFor, goodSite } from "./fixtures/sites";
import { createZip, readZip, zipFolderName } from "./zip";
import { readSiteFile, readSiteManifest, writeSite, sitesRoot } from "./store";
import { postprocessSite, NOTICE_CLASS } from "./postprocess";
import { staticQa } from "./qa-static";
import { highlightLines } from "./highlight";
import { siteHeaders } from "./serve";
import { normalizeCode, siteFileSchema, siteRefSchema } from "./schema";
import { fallbackArtwork } from "./images";
import { briefIssues, imageLimit, normalizeBrief, summarize } from "./generator";
import { briefPrompt, codePrompt, loadV6Guide, profileSection, segmentProfile, v6SystemPrompt, V6_GUIDE_FILES, V6_SKILL_DIR } from "./prompts";

const business = BUSINESSES.restaurante;
const processed = (code = goodSite(), phone = "") => postprocessSite({ code, business, phone, assets: new Map([["hero", "assets/hero.webp"]]) });

beforeEach(() => { process.env.SELLORA_DATA_DIR = path.join(process.cwd(), "test-results", "v6-unit", randomUUID()); });
afterEach(() => { delete process.env.SELLORA_DATA_DIR; });

it("ZIP store é lido de volta com o mesmo conteúdo e CRC", () => {
  const zip = createZip([{ name: "demo-x/index.html", data: Buffer.from("<h1>oi</h1>") }, { name: "demo-x/servicos.html", data: Buffer.from("<h1>s</h1>") }, { name: "demo-x/assets/hero.webp", data: Buffer.from([1, 2, 3, 255]) }]);
  const files = readZip(zip);
  expect([...files.keys()]).toEqual(["demo-x/index.html", "demo-x/servicos.html", "demo-x/assets/hero.webp"]);
  expect(files.get("demo-x/assets/hero.webp")).toEqual(Buffer.from([1, 2, 3, 255]));
  expect(() => createZip([{ name: "../fora.txt", data: Buffer.from("x") }])).toThrow();
  expect(zipFolderName("Barbearia São João")).toBe("demo-barbearia-sao-joao");
});

it("site gravado é imutável, aceita a segunda página, só serve arquivos do manifesto e detecta adulteração", async () => {
  const id = randomUUID();
  const manifest = await writeSite(id, new Map([["index.html", Buffer.from("<h1>a</h1>")], ["servicos.html", Buffer.from("<h1>s</h1>")], ["styles.css", Buffer.from("body{}")]]), { "brief.json": "{}" });
  expect(manifest.map((file) => file.path)).toEqual(["index.html", "servicos.html", "styles.css"]);
  await expect(writeSite(id, new Map([["index.html", Buffer.from("outro")]]), {})).rejects.toThrow(/não pode ser regravado/);
  expect((await readSiteFile(id, "servicos.html"))?.toString()).toBe("<h1>s</h1>");
  expect(await readSiteFile(id, "../meta/brief.json")).toBeNull();
  await writeFile(path.join(sitesRoot(), id, "files", "index.html"), "adulterado");
  expect(await readSiteFile(id, "index.html")).toBeNull();
  expect(await readSiteManifest("nao-e-uuid")).toBeNull();
  await expect(writeSite(randomUUID(), new Map([["../x.html", Buffer.from("x")]]), {})).rejects.toThrow(/não permitido/);
  // Segunda página: um nome curto, nunca outra "index", nunca caminho.
  for (const ok of ["servicos.html", "catalogo.html"]) expect(siteFileSchema.shape.path.safeParse(ok).success).toBe(true);
  for (const bad of ["Index.html", "a/b.html", "x.html", "../c.html"]) expect(siteFileSchema.shape.path.safeParse(bad).success).toBe(false);
});

it("pós-processamento em cada página: marcadores de contato, imagens reais, scripts inline removidos e aviso", () => {
  const code = goodSite({ twoPages: true, phone: true });
  code.html = code.html.replace("<h2>A cozinha</h2>", '<h2 onclick="alert(1)">A cozinha</h2><script>alert(1)</script>');
  const out = postprocessSite({ code, business, phone: "(19) 99999-0000", assets: new Map([["hero", "assets/hero.svg"]]) });
  expect(out.pages.map((page) => page.file)).toEqual(["index.html", "servicos.html"]);
  expect(out.html).toContain("https://wa.me/5519999990000");
  expect(out.html).toContain("(19) 99999-0000");
  expect(out.html).toContain('src="assets/hero.svg"');
  expect(out.html).not.toMatch(/onclick|<script>alert/);
  for (const page of out.pages) {
    expect(page.html).toContain('<script src="script.js" defer></script>');
    expect(page.html).toContain(NOTICE_CLASS);
    expect(page.html).toContain('name="robots"');
  }
  expect(out.css).toContain(`.${NOTICE_CLASS}`);
  const noPhone = processed(goodSite({ phone: true }));
  expect(noPhone.html).not.toContain("wa.me");
  expect(noPhone.notes.join(" ")).toContain("telefone");
});

it("QA estático aprova o site bem feito de uma e de duas páginas", () => {
  for (const twoPages of [false, true]) {
    const qa = staticQa(processed(goodSite({ twoPages })), briefFor({ twoPages }), ["assets/hero.webp"], [], business);
    expect(qa.critical).toEqual([]);
    expect(qa.fixable).toEqual([]);
  }
});

it("QA estático: navegação quebrada entre páginas, recursos externos, textos genéricos e fatos não confirmados", () => {
  const site = processed(goodSite({ twoPages: true }));
  site.pages[0].html = site.pages[0].html.replace("<h2>Contato</h2>", `<h2>Contato</h2><a href="inexistente.html">x</a><a href="servicos.html#nao-existe">y</a><a href="#">z</a><a href="https://cdn.exemplo.com/a.js">w</a>
<p>Desde 1998, nota 4,9 estrelas. Rua das Flores, 120. Pratos a partir de R$ 30. Aberto de seg a sex, das 11h às 15h. Uma experiência única. Atendimento relevante, sem pressa.</p><blockquote>Melhor cantina</blockquote>`);
  const qa = staticQa(site, briefFor({ twoPages: true }), ["assets/hero.webp"], [{ headline: "Comida de cantina no centro de Ribeirão Preto", texts: [] }], business);
  const all = [...qa.critical, ...qa.fixable].join(" | ");
  expect(qa.critical.join(" ")).toContain("página inexistente: inexistente.html");
  for (const expected of ["#nao-existe", "href vazio", "cdn.exemplo.com", "ano de fundação", "avaliação", "endereço", "preço", "horário", "experiencia unica", "blockquote", "Título principal igual"]) expect(all).toContain(expected);
  // Limite de palavra: "relevante" não é a palavra proibida "eleve"; nome e cidade do cadastro não são fatos inventados.
  expect(all).not.toContain('"eleve"');
  expect(all).not.toContain("Ribeirão");
});

it("QA estático: tipografia, movimento, acessibilidade, botões sem ação e estrutura", () => {
  const code = goodSite();
  code.html = code.html.replace("family=Fraunces:wght@600&family=Work+Sans:wght@400;600", "family=Inter&family=Roboto&family=Lato").replace("<footer>", "<button>Abrir</button><h4>Pulo</h4><section id=\"cozinha\"><h2>A cozinha</h2></section><footer>")
    .replace('target="_blank" rel="noopener"', 'target="_blank"');
  code.css = code.css.replace("a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:3px}", "") + ".x{transition:width 200ms}.y{animation:gira 2s infinite}@keyframes gira{to{left:10px}}.t{background-clip:text}";
  code.js = `${code.js};window.addEventListener('wheel',(e)=>e.preventDefault())`;
  const qa = staticQa(processed(code), briefFor(), ["assets/hero.webp"], [], business);
  const all = qa.fixable.join(" | ");
  for (const expected of ["Mais de duas famílias", "Fraunces do briefing não é carregada", "ids repetidos", "mesmo título", "Títulos fora de ordem", "noopener", "<button> sem ação", "propriedade de layout", "altera propriedades de layout", "gradiente", ":focus-visible", "bloqueia a rolagem"]) expect(all).toContain(expected);
  // Loop com prefers-reduced-motion no CSS vira aviso (decorativo); sem a media query, é corrigível.
  expect(qa.warnings.join(" ")).toContain("Animação infinita");
  const noReduced = goodSite();
  noReduced.css = noReduced.css.replace(/@media \(prefers-reduced-motion:reduce\)\{[^}]*\}\}/, "") + ".y{animation:gira 2s infinite}@keyframes gira{to{transform:rotate(1turn)}}";
  expect(staticQa(processed(noReduced), briefFor(), ["assets/hero.webp"], [], business).fixable.join(" ")).toContain("Animação infinita sem @media (prefers-reduced-motion");
});

it("compatibilidade: site e lead V6 gravados antes da mudança continuam válidos; checkpoint antigo de código é aproveitado", () => {
  const old = {
    id: randomUUID(), generator: "v6", title: "Barbearia", createdAt: "2026-11-12T22:55:50.033Z",
    files: [{ path: "index.html", size: 10, sha256: "a".repeat(64) }, { path: "styles.css", size: 10, sha256: "b".repeat(64) }],
    images: [{ id: "hero", path: "assets/hero.webp", source: "codex", sha256: "c".repeat(64), alt: "Cadeira" }], preview: true,
    summary: { headline: "Barbearia", texts: [], fonts: ["Big Shoulders Display", "Figtree"], palette: ["#f1ebe0"], sections: ["hero"], hero: "Foto de ponta a ponta", signature: "x" },
    qa: { status: "warnings", browser: "executed", rounds: 1, issues: ["aviso"] },
  };
  expect(siteRefSchema.safeParse(old).success).toBe(true);
  expect(siteRefSchema.safeParse({ ...old, images: [{ ...old.images[0], source: "gemini" }] }).success).toBe(true);
  const at = "2026-11-12T23:00:00.000Z";
  const demo = { id: randomUUID(), version: 6, status: "approved", business: { ...business, phone: "" }, message: "Mensagem editada pelo operador.", createdAt: at, updatedAt: at, approvedAt: at, approvedBy: "Lipe", site: old };
  const parsed = leadDemoSchema.safeParse(demo);
  expect(parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`)).toEqual([]);
  expect(normalizeCode({ html: goodSite().html, css: goodSite().css, js: "", notes: "" })?.secondary).toBeNull();
});

it("briefing: limites de imagem, páginas e problemas detectados antes do código", () => {
  const two = briefFor({ twoPages: true });
  expect(normalizeBrief({ ...two, pages: { ...two.pages, count: 1 } }, 1).pages.secondary).toBeNull();
  const three = { ...briefFor(), images: [briefFor().images[0], { ...briefFor().images[0], id: "detalhe" }, { ...briefFor().images[0], id: "extra" }] };
  expect(normalizeBrief(three, 1).images).toHaveLength(1);
  // Até 3 imagens por padrão; a variável só reduz (1 a 3) e valores inválidos voltam ao padrão.
  expect(imageLimit({})).toBe(3);
  expect(imageLimit({ SELLORA_DEMO_MAX_IMAGES: "3" })).toBe(3);
  expect(imageLimit({ SELLORA_DEMO_MAX_IMAGES: "2" })).toBe(2);
  expect(imageLimit({ SELLORA_DEMO_MAX_IMAGES: "1" })).toBe(1);
  expect(imageLimit({ SELLORA_DEMO_MAX_IMAGES: "9" })).toBe(3);
  expect(imageLimit({ SELLORA_DEMO_MAX_IMAGES: "0" })).toBe(3);
  const generic = briefFor({ displayFont: "Inter" });
  generic.direction.motion = "expressiva";
  const issues = briefIssues(generic, BUSINESSES.clinica, { hasPhone: false }).join(" | ");
  expect(issues).toContain("Inter");
  expect(issues).toContain("expressiva");
  expect(briefIssues(briefFor(), business, { hasPhone: false })).toEqual([]);
});

it("guia V6: todas as referências existem, cada etapa recebe só a sua e cada perfil de segmento tem seção", async () => {
  const guide = await loadV6Guide();
  for (const key of Object.keys(V6_GUIDE_FILES)) expect(guide[key as keyof typeof guide].length).toBeGreaterThan(400);
  const system = v6SystemPrompt(guide);
  expect(system).toContain("Verdade antes de tudo");
  expect(system).not.toContain("Contrato técnico");
  const brief = briefPrompt(business, { hasPhone: false }, [], guide, { maxImages: 1 });
  expect(brief).toContain("exatamente 1 imagem");
  expect(codePrompt(business, briefFor(), { hasPhone: false }, guide, [{ id: "hero", path: "assets/hero.webp", width: 1600, height: 2000 }])).toContain('"width":1600');
  for (const profile of ["comida", "beleza", "saude", "academia", "oficina", "pet", "profissional", "comercio", "presenca"]) expect(profileSection(guide.segments, profile)).toContain(`## perfil: ${profile}`);
  expect(segmentProfile(BUSINESSES.clinica)).toBe("saude");
  expect(segmentProfile(BUSINESSES.oficina)).toBe("oficina");
  expect(segmentProfile(BUSINESSES.loja)).toBe("comercio");
});

it("skills: espelhos .claude idênticos às fontes canônicas e skill V6 copiada pelo build do Windows", async () => {
  for (const skill of ["demo-generator-v6", "unique-site-designer"]) {
    const list = async (dir: string): Promise<string[]> => (await readdir(dir, { withFileTypes: true, recursive: true })).filter((entry) => entry.isFile()).map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name))).sort();
    const canonical = path.join(".agents", "skills", skill), mirror = path.join(".claude", "skills", skill);
    const files = await list(canonical);
    expect(await list(mirror)).toEqual(files);
    for (const file of files) expect(await readFile(path.join(mirror, file))).toEqual(await readFile(path.join(canonical, file)));
  }
  const build = await readFile(path.join("desktop", "build.mjs"), "utf8");
  expect(build).toContain(`cp(".agents/skills/demo-generator-v6"`);
  expect(build).toContain(`cp(".agents/skills/unique-site-designer"`);
  expect(V6_SKILL_DIR.replace(/\\/g, "/")).toBe(".agents/skills/demo-generator-v6");
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

it("fallback SVG usa a paleta, a proporção e o alt, sem texto visível; resumo traz identidade e páginas", () => {
  const brief = briefFor({ aspect: "16:9" });
  const svg = fallbackArtwork(brief.images[0], brief.direction.palette, "Cantina").toString("utf8");
  expect(svg).toContain('viewBox="0 0 1600 900"');
  expect(svg).toContain(brief.direction.palette.ink);
  expect(svg).toContain('aria-label="Mesa de madeira com travessa de massa"');
  expect(svg).not.toMatch(/<text/);
  const summary = summarize(processed().html, briefFor({ twoPages: true }), business);
  expect(summary.headline).toBe("Comida de cantina no centro de Ribeirão Preto");
  expect(summary.identity).toMatchObject({ hero: "colunas", pages: 2, displayCategory: "serifa" });
  expect(summary.identity?.headline).not.toContain("ribeirao");
  expect(summary.pages).toEqual(["index.html", "servicos.html"]);
});
