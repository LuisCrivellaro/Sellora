import { expect, it } from "vitest";
import { z } from "zod";
import { claudeVisionArgs, claudeVisionInput, parseClaudeStream } from "../claude-server";
import { briefFor, BUSINESSES, IMAGE_SET, visualReviewFixture } from "./fixtures/sites";
import { postprocessSite } from "./postprocess";
import { imagePrompt, loadV6Guide, PRESENCE_RULES, visualReviewPrompt } from "./prompts";
import { siteBriefSchema, siteBriefSchemaFor, siteQaSchema } from "./schema";
import { briefIssues, imageSetIssues, normalizeBrief } from "./generator";
import { briefForReview, reviewImages, reviewProblems, visualReviewRounds, visualReviewSchema, VISUAL_CRITERIA, VISUAL_TARGET, weightedScore } from "./visual-review";

/** Revisão de impacto visual, conjunto de imagens e chamada com imagens: tudo com fixtures, sem crédito consumido. */

const review = visualReviewFixture;

it("critérios: pesos do diagnóstico somam 100% e a média ponderada é calculada pela aplicação", () => {
  expect(VISUAL_CRITERIA.map((item) => [item.key, item.weight])).toEqual([["firstScreen", 0.25], ["composition", 0.2], ["typography", 0.15], ["imagery", 0.15], ["originality", 0.15], ["segmentFit", 0.1]]);
  expect(VISUAL_CRITERIA.reduce((sum, item) => sum + item.weight, 0)).toBeCloseTo(1, 10);
  expect(VISUAL_TARGET).toBe(8);
  expect(weightedScore(review())).toBe(8.5);
  // 0,25·6 + 0,2·7 + 0,15·8 + 0,15·9 + 0,15·5 + 0,1·10 = 7,2
  expect(weightedScore(review({ firstScreen: 6, composition: 7, typography: 8, imagery: 9, originality: 5, segmentFit: 10 }))).toBe(7.2);
  // O schema vira JSON Schema para o --json-schema do Claude Code.
  expect(() => z.toJSONSchema(visualReviewSchema, { target: "draft-7" })).not.toThrow();
});

it("avaliação genérica ou incoerente é descartada (nunca vira nota)", () => {
  expect(reviewProblems(review())).toEqual([]);
  const generic = review();
  generic.criteria.firstScreen.evidence = "O site é bonito e transmite um visual profissional e moderno para o negócio.";
  expect(reviewProblems(generic).join(" ")).toContain("Impacto da primeira tela: justificativa sem evidência visual concreta");
  const noProblem = review({ composition: 6 });
  noProblem.criteria.composition.problems = [];
  expect(reviewProblems(noProblem).join(" ")).toContain("nota 6 sem problema apontado");
  expect(reviewProblems(review({ firstScreen: 5, composition: 5 }, 0)).join(" ")).toContain("abaixo da meta sem correções");
  expect(visualReviewSchema.safeParse({ ...review(), criteria: { ...review().criteria, typography: { score: 9, evidence: "Bonito.", problems: [] } } }).success).toBe(false);
});

it("rodadas da revisão visual: 2 por padrão, 0 desliga, valores fora de 0–3 voltam ao padrão", () => {
  expect(visualReviewRounds({})).toBe(2);
  expect(visualReviewRounds({ SELLORA_DEMO_VISUAL_REVIEW_ROUNDS: "0" })).toBe(0);
  expect(visualReviewRounds({ SELLORA_DEMO_VISUAL_REVIEW_ROUNDS: "3" })).toBe(3);
  expect(visualReviewRounds({ SELLORA_DEMO_VISUAL_REVIEW_ROUNDS: "9" })).toBe(2);
  expect(visualReviewRounds({ SELLORA_DEMO_VISUAL_REVIEW_ROUNDS: "abc" })).toBe(2);
});

it("capturas reais viram imagens para o avaliador: primeira tela, fatias da página inteira e segunda página", async () => {
  const { default: sharp } = await import("sharp");
  const png = (width: number, height: number) => sharp({ create: { width, height, channels: 3, background: "#e9e1d3" } }).png().toBuffer();
  expect(await reviewImages({})).toEqual([]);
  const images = await reviewImages({
    "shot-1440.png": await png(1440, 900), "shot-390.png": await png(390, 844),
    "shot-1440-full.png": await png(720, 3600), "shot-390-full.png": await png(312, 4000), "shot-servicos-1440.png": await png(1440, 900),
  });
  expect(images.length).toBeLessThanOrEqual(9);
  expect(images[0].label).toContain("primeira tela no desktop");
  expect(images[1].label).toContain("primeira tela no celular");
  expect(images.filter((image) => image.label.startsWith("página inteira no desktop")).length).toBe(3);
  expect(images.filter((image) => image.label.startsWith("página inteira no celular")).length).toBe(2);
  expect(images.at(-1)?.label).toContain("servicos.html");
  for (const image of images) {
    expect(image.mediaType).toBe("image/jpeg");
    expect((await sharp(image.data).metadata()).format).toBe("jpeg");
  }
});

it("chamada com imagens: stream-json de entrada e saída, mesmo isolamento (sem ferramentas, sem MCP, sem sessão)", () => {
  const args = claudeVisionArgs("C:/tmp/sys.md", "medium", visualReviewSchema);
  expect(args.slice(0, 7)).toEqual(["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose", "--json-schema"]);
  for (const flag of ["--tools", "--strict-mcp-config", "--safe-mode", "--no-session-persistence", "--system-prompt-file"]) expect(args).toContain(flag);
  expect(args[args.indexOf("--tools") + 1]).toBe("");
  expect(args).not.toContain("json");
  const input = JSON.parse(claudeVisionInput("Avalie.", [{ label: "primeira tela no desktop", mediaType: "image/jpeg", data: Buffer.from("abc") }]));
  expect(input).toMatchObject({ type: "user", message: { role: "user", content: [{ type: "text", text: "Avalie." }, { type: "text", text: "Imagem: primeira tela no desktop" }, { type: "image", source: { type: "base64", media_type: "image/jpeg", data: Buffer.from("abc").toString("base64") } }] } });
  // Formato real observado no Claude Code 2.1.325 (linhas de sistema, assistente, ferramenta interna e o resultado).
  const stdout = [
    JSON.stringify({ type: "system", subtype: "init" }), JSON.stringify({ type: "assistant", message: {} }),
    JSON.stringify({ type: "user", message: { content: [{ type: "tool_result", content: "Structured output provided successfully" }] } }),
    JSON.stringify({ type: "result", subtype: "success", is_error: false, structured_output: review(), total_cost_usd: 0.0123 }),
  ].join("\n");
  const parsed = parseClaudeStream(stdout, visualReviewSchema);
  expect(parsed.estimatedUsd).toBe(0.0123);
  expect(weightedScore(parsed.value)).toBe(8.5);
  expect(() => parseClaudeStream(JSON.stringify({ type: "system" }), visualReviewSchema)).toThrow("avaliação visual");
  expect(() => parseClaudeStream(JSON.stringify({ type: "result", subtype: "error_during_execution", is_error: true, api_error_status: 429 }), visualReviewSchema)).toThrow("limite de uso");
});

it("três imagens: papéis distintos aceitos; papel repetido, cena quase igual e imagem sem seção são recusados", () => {
  const set = briefFor({ imageSet: true });
  expect(set.images.map((image) => image.id)).toEqual(["hero", "salao", "preparo"]);
  expect(imageSetIssues(set)).toEqual([]);
  expect(briefIssues(set, BUSINESSES.restaurante, { hasPhone: false })).toEqual([]);
  const sameRole = { ...set, images: [set.images[0], { ...set.images[1], role: "hero editorial" }, set.images[2]] };
  expect(imageSetIssues(sameRole).join(" ")).toContain('"hero" e "salao" repetem o mesmo papel');
  const sameScene = { ...set, images: [set.images[0], { ...set.images[1], aspect: "4:5" as const, subject: "mesa de madeira com travessa de massa", framing: "plano médio, 50 mm" }, set.images[2]] };
  expect(imageSetIssues(sameScene).join(" ")).toContain("proporção, assunto e enquadramento");
  const unused = { ...set, sections: set.sections.map((section) => (section.imageId === "preparo" ? { ...section, imageId: null } : section)) };
  expect(imageSetIssues(unused).join(" ")).toContain('"preparo" foi planejada, mas nenhuma seção a usa');
  // A imagem usada pelo hero vira a primeira (tamanho de hero e fetchpriority), mesmo que o modelo a liste depois.
  const reordered = normalizeBrief({ ...set, images: [set.images[2], set.images[1], set.images[0]] }, 3);
  expect(reordered.images[0].id).toBe("hero");
  expect(normalizeBrief(set, 2).images).toHaveLength(2);
});

it("pedido ao Codex permite pessoas ilustrativas conforme a presença planejada e mantém as restrições de veracidade", () => {
  const set = briefFor({ imageSet: true });
  const prompts = set.images.map((image) => imagePrompt(image, set));
  expect(prompts[0]).toContain(PRESENCE_RULES["sem-pessoas"]);
  expect(prompts[1]).toContain(PRESENCE_RULES.figurantes);
  expect(prompts[2]).toContain(PRESENCE_RULES.maos);
  const people = imagePrompt({ ...set.images[1], presence: "pessoas-ilustrativas" }, set);
  expect(people).toContain("pessoas fictícias em situação profissional realista");
  for (const prompt of [...prompts, people]) {
    expect(prompt).not.toContain("pessoas identificáveis");
    expect(prompt).toContain("não representa o local, a equipe, os clientes nem os produtos reais");
    expect(prompt).toContain("fachada identificável");
    expect(prompt).not.toContain(BUSINESSES.restaurante.name);
  }
  expect(new Set(prompts).size).toBe(3);
  // Briefings antigos sem `presence` continuam válidos e caem em "sem pessoas".
  const legacy = { ...set.images[0] } as Partial<(typeof set.images)[number]>;
  delete legacy.presence;
  expect(imagePrompt(legacy as (typeof set.images)[number], set)).toContain(PRESENCE_RULES["sem-pessoas"]);
});

it("aviso de imagens ilustrativas continua em toda página, inclusive com três imagens", () => {
  const site = postprocessSite({ code: { html: "<!doctype html><html><head></head><body><main></main></body></html>".padEnd(220, " "), css: "body{margin:0}".padEnd(60, " "), js: "", secondary: null, notes: "" }, business: BUSINESSES.restaurante, phone: "", assets: new Map(IMAGE_SET.map((image) => [image.id, `assets/${image.id}.webp`])) });
  expect(site.html).toContain("Demonstração não oficial criada pela Sellora para Cantina Alvorada Teste. Imagens ilustrativas;");
  // Uma correção (visual ou técnica) que tente esconder o aviso pelo CSS não consegue: a regra da aplicação vem por último.
  const hidden = postprocessSite({ code: { html: "<!doctype html><html><head></head><body><main></main></body></html>".padEnd(220, " "), css: ".sellora-demo-notice{display:none;opacity:0}".padEnd(60, " "), js: "", secondary: null, notes: "" }, business: BUSINESSES.restaurante, phone: "", assets: new Map() });
  expect(hidden.css.trimEnd()).toMatch(/\.sellora-demo-notice \{ display: block !important; visibility: visible !important; opacity: 1 !important;[^}]*\}$/);
  expect(postprocessSite({ code: { html: hidden.html, css: hidden.css, js: "", secondary: null, notes: "" }, business: BUSINESSES.restaurante, phone: "", assets: new Map() }).css.match(/aviso obrigatório/g)).toHaveLength(1);
});

it("schema: geração exige momento de assinatura e presença; leitura aceita briefings e QA antigos", () => {
  const set = briefFor({ imageSet: true, signature: "Fotografia do salão em largura total cortando a página clara." });
  expect(siteBriefSchemaFor(3).safeParse(set).success).toBe(true);
  const noSignature = briefFor({ imageSet: true });
  expect(siteBriefSchemaFor(3).safeParse(noSignature).success).toBe(false);
  expect(siteBriefSchema.safeParse(noSignature).success).toBe(true);
  expect(siteBriefSchemaFor(1).safeParse(set).success).toBe(false); // limite de imagens também vale no schema
  expect(siteQaSchema.safeParse({ status: "passed", browser: "executed", rounds: 0, issues: [] }).success).toBe(true);
  expect(siteQaSchema.safeParse({ status: "needs_review", browser: "executed", rounds: 0, issues: [], blocking: ["Textos sobrepostos em 390 px."], visual: { status: "visual_review_unavailable", target: 8, initial: null, final: null, rounds: 0, criteria: [], problems: [], fixes: [], history: [], reason: "sem capturas" } }).success).toBe(true);
});

it("guia: movimento moderado é o padrão (também em escritórios e clínicas), sem regras antigas contraditórias", async () => {
  const guide = await loadV6Guide();
  expect(guide.direction).toContain('o padrão é **"moderada"**, também para escritórios, clínicas');
  expect(guide.direction).toContain("signatureMoment");
  expect(guide.implementation).toContain("IntersectionObserver");
  expect(guide.implementation).toContain("prefers-reduced-motion: reduce");
  expect(guide.visual).toContain("| `firstScreen` · Impacto da primeira tela | 25% |");
  const all = Object.values(guide).join("\n");
  for (const stale of ["Nada de fade-in em cada seção", "Nada de animação em cada seção ao rolar", "O padrão é uma imagem por demo", "nunca expressiva. Uma página", "motion calma.", "Nunca um rosto", "sem pessoas identificáveis, logotipos"]) expect(all).not.toContain(stale);
  // Perfis sérios recebem movimento moderado, não "calma" automática.
  for (const profile of ["saude", "profissional", "oficina"]) expect(guide.segments.split(`## perfil: ${profile}`)[1].split("## perfil:")[0]).toMatch(/[Mm]ovimento moderado/);
  const clinic = briefFor({ motion: "moderada" });
  expect(briefIssues(clinic, BUSINESSES.clinica, { hasPhone: false }).join(" ")).not.toContain("Movimento");
  const prompt = visualReviewPrompt(BUSINESSES.clinica, briefForReview(clinic), guide, ["primeira tela no desktop"], 0);
  expect(prompt).toContain("REVISÃO DE IMPACTO VISUAL");
  expect(prompt).toContain("1. primeira tela no desktop");
  expect(prompt).not.toContain(BUSINESSES.clinica.name);
});
