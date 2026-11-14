import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { brokenSite, faqSite, goodSite, revealSite } from "./fixtures/sites";
import { postprocessSite } from "./postprocess";
import { browserQa, findBrowser } from "./qa-browser";

/**
 * Auditoria em navegador real com sites escritos à mão (sem geração, sem crédito). Roda quando há Edge/Chrome
 * instalado; SELLORA_SKIP_BROWSER_TESTS=1 pula (ex.: máquina sem navegador ou CI mínimo).
 */
const root = path.join(process.cwd(), "test-results", "v6-browser", randomUUID());
const browser = process.env.SELLORA_SKIP_BROWSER_TESTS ? null : await findBrowser();

async function writeFixture(name: string, code: ReturnType<typeof goodSite>) {
  const dir = path.join(root, name);
  await mkdir(path.join(dir, "assets"), { recursive: true });
  const site = postprocessSite({ code, business: { name: "Cantina Alvorada Teste", city: "Ribeirão Preto", uf: "SP" }, phone: "", assets: new Map([["hero", "assets/hero.webp"]]) });
  for (const page of site.pages) await writeFile(path.join(dir, page.file), page.html);
  await writeFile(path.join(dir, "styles.css"), site.css);
  if (site.js) await writeFile(path.join(dir, "script.js"), site.js);
  const { default: sharp } = await import("sharp");
  await writeFile(path.join(dir, "assets", "hero.webp"), await sharp({ create: { width: 800, height: 1000, channels: 3, background: "#b98a5e" } }).webp().toBuffer());
  return { dir, pages: site.pages.map((page) => page.file) };
}

afterAll(async () => { await rm(root, { recursive: true, force: true }).catch(() => {}); });

describe.skipIf(!browser)("auditoria em navegador real (fixtures)", () => {
  it("site bem feito de duas páginas passa: navegação por toque, foco, sem JS e movimento reduzido", async () => {
    const { dir, pages } = await writeFixture("bom", goodSite({ twoPages: true }));
    const qa = await browserQa(dir, { pages, fonts: ["Fraunces", "Work Sans"] });
    expect(qa.reason ?? "").toBe("");
    expect(qa.executed).toBe(true);
    expect(qa.fixable).toEqual([]);
    expect(qa.viewports).toEqual([1440, 1024, 768, 390, 360]);
    expect(qa.checks.join(" | ")).toMatch(/menu do celular por toque \(index\.html\).*menu do celular por toque \(servicos\.html\)/);
    expect(qa.checks).toEqual(expect.arrayContaining(["foco do teclado (Tab)", "página sem JavaScript", "movimento reduzido"]));
    expect(Object.keys(qa.shots)).toEqual(expect.arrayContaining(["shot-1440.png", "shot-390.png", "shot-1440-full.png", "shot-servicos-1440.png"]));
  }, 180_000);

  it("site com problemas de renderização é reprovado com mensagens específicas", async () => {
    const { dir, pages } = await writeFixture("quebrado", brokenSite());
    const qa = await browserQa(dir, { pages });
    const all = qa.fixable.join(" | ");
    for (const expected of ["Rolagem horizontal", "Textos sobrepostos", "Imagem distorcida", "foco do teclado não fica visível", "Sem JavaScript", "navegação de index.html some", "animação(ões) infinita"]) expect(all).toContain(expected);
    // Sobreposição real: bloqueante, com trecho do texto e posição (a correção consegue achar o elemento).
    const overlap = qa.blocking.find((issue) => issue.startsWith("Textos sobrepostos"));
    expect(overlap).toMatch(/"Texto que fica por cima|"Comida de cantina/);
    expect(overlap).toMatch(/\d+×\d+ px, a \d+ px do topo/);
    for (const expected of ["Rolagem horizontal", "Sem JavaScript", "navegação de index.html some"]) expect(qa.blocking.join(" | ")).toContain(expected);
    // Foco invisível e animação infinita são corrigíveis, mas não bloqueiam a leitura.
    expect(qa.blocking.join(" | ")).not.toContain("foco do teclado");
    for (const issue of qa.blocking) expect(qa.fixable).toContain(issue);
  }, 180_000);

  it("regressão AJ Santos: <details> fechado e link que quebra linha não são sobreposição", async () => {
    const { dir, pages } = await writeFixture("faq", faqSite());
    const qa = await browserQa(dir, { pages });
    expect(qa.executed).toBe(true);
    expect(qa.fixable.filter((issue) => issue.startsWith("Textos sobrepostos"))).toEqual([]);
    expect(qa.blocking).toEqual([]);
  }, 180_000);

  it("revelação ao rolar bem feita termina visível em todas as larguras, sem JS e com movimento reduzido", async () => {
    const { dir, pages } = await writeFixture("revela", revealSite());
    const qa = await browserQa(dir, { pages });
    expect(qa.fixable).toEqual([]);
    expect(qa.blocking).toEqual([]);
    expect(qa.checks).toEqual(expect.arrayContaining(["página sem JavaScript", "movimento reduzido"]));
  }, 180_000);

  it("revelação que nunca dispara ou ignora o movimento reduzido deixa conteúdo escondido: bloqueante", async () => {
    const { dir, pages } = await writeFixture("revela-quebrada", revealSite({ broken: true }));
    const qa = await browserQa(dir, { pages });
    const blocking = qa.blocking.join(" | ");
    expect(blocking).toContain("Conteúdo continua invisível depois de rolar a página inteira");
    expect(blocking).toContain("Com movimento reduzido");
    expect(blocking).not.toContain("Sem JavaScript"); // o estado inicial está sob .js: sem script, tudo aparece
  }, 180_000);
});
