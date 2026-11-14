import { siteBriefSchema, type SiteBrief, type SiteCode } from "../schema";
import { VISUAL_CRITERIA, VISUAL_TARGET, type VisualReview } from "../visual-review";

/**
 * Fixtures dos testes do V6: negócios fictícios e código escrito à mão (nenhuma geração real, nenhum crédito consumido).
 * `briefFor` monta um briefing válido; `goodSite` é um site que passa nas verificações; `brokenSite` concentra problemas
 * que só aparecem renderizados (sobreposição, rolagem horizontal, conteúdo dependente de JS, foco invisível…).
 */

export const BUSINESSES = {
  restaurante: { name: "Cantina Alvorada Teste", city: "Ribeirão Preto", uf: "SP", segment: "restaurantes", category: "Restaurante" },
  restaurante2: { name: "Bistrô Paineira Teste", city: "Ribeirão Preto", uf: "SP", segment: "restaurantes", category: "Restaurante" },
  clinica: { name: "Clínica Sorriso Claro Teste", city: "Sorocaba", uf: "SP", segment: "saude", category: "Dentista" },
  oficina: { name: "Oficina Engrenagem Teste", city: "Sumaré", uf: "SP", segment: "servicos", category: "Oficina mecânica" },
  loja: { name: "Armarinho Linha Fina Teste", city: "Bauru", uf: "SP", segment: "comercio", category: "Armarinho" },
} as const;

/** Conjunto de três imagens com papéis, cenas e presença humana diferentes (fixture, nenhuma imagem real gerada). */
export const IMAGE_SET: SiteBrief["images"] = [
  { id: "hero", role: "hero editorial", aspect: "4:5", placement: "coluna direita do hero", subject: "mesa de madeira com travessa de massa", context: "salão de cantina", style: "fotografia editorial", light: "luz lateral quente de janela", framing: "plano médio, 50 mm", depth: "profundidade rasa", textSpace: "nenhuma", dominantColors: "terracota e creme", restrictions: "sem logotipos, sem texto", prompt: "Fotografia editorial de uma mesa de madeira de cantina com uma travessa de massa, luz lateral quente de janela.", alt: "Mesa de madeira com travessa de massa", presence: "sem-pessoas" },
  { id: "salao", role: "ambiente com clientes", aspect: "16:9", placement: "seção da cozinha, largura total", subject: "salão cheio no fim de tarde com clientes conversando", context: "cantina de bairro", style: "fotografia documental", light: "luz dourada de fim de tarde", framing: "plano aberto, 28 mm", depth: "profundidade média", textSpace: "nenhuma", dominantColors: "âmbar e vinho", restrictions: "sem logotipos, sem placas, sem fachada", prompt: "Fotografia documental de um salão de cantina cheio, clientes fictícios conversando à mesa, desfocados.", alt: "Salão de cantina com pessoas à mesa", presence: "figurantes" },
  { id: "preparo", role: "detalhe do ofício", aspect: "1:1", placement: "seção da visita, ao lado do texto", subject: "mãos abrindo massa fresca sobre farinha", context: "bancada de cozinha", style: "fotografia de detalhe", light: "luz difusa de cima", framing: "close, 85 mm", depth: "profundidade rasa", textSpace: "nenhuma", dominantColors: "creme e farinha", restrictions: "sem rosto, sem marcas", prompt: "Close de mãos abrindo massa fresca sobre farinha numa bancada de madeira.", alt: "Mãos abrindo massa fresca", presence: "maos" },
];

type Overrides = { displayFont?: string; displayCategory?: SiteBrief["direction"]["displayCategory"]; bodyFont?: string; hero?: SiteBrief["direction"]["heroArchetype"]; sections?: [string, SiteBrief["sections"][number]["function"]][]; background?: string; accent?: string; twoPages?: boolean; headline?: string; aspect?: SiteBrief["images"][number]["aspect"]; motion?: SiteBrief["direction"]["motion"]; signature?: string; imageSet?: boolean };

export function briefFor(o: Overrides = {}): SiteBrief {
  const imageFor = (index: number) => (index === 0 ? "hero" : o.imageSet && index === 1 ? "salao" : o.imageSet && index === 2 ? "preparo" : null);
  const sections = (o.sections ?? [["inicio", "hero"], ["cozinha", "oferta"], ["visita", "localizacao"], ["contato", "contato"]]).map(([id, fn], index) => ({ id, function: fn, purpose: `Seção ${id}`, composition: `Composição ${index}`, imageId: imageFor(index) }));
  return siteBriefSchema.parse({
    analysis: { businessType: "lugar", specificSegment: "restaurante de bairro", confirmed: ["Nome, cidade e categoria"], unknown: ["Horários", "Cardápio"], audienceInference: "Inferência: moradores da região.", commercialGoal: "Levar a pessoa a ver como chegar.", visitorGoal: "Saber se é perto e como chegar.", firstInformation: ["Categoria e cidade", "Como chegar"] },
    direction: {
      concept: "Cantina de bairro com mesa de madeira e luz de fim de tarde", mood: "caloroso", personality: "acolhedora e direta",
      displayFont: o.displayFont ?? "Fraunces", displayCategory: o.displayCategory ?? "serifa", bodyFont: o.bodyFont ?? "Work Sans", typographyReason: "Serifa calorosa para o nome e leitura neutra.",
      typeScale: "1,25 no celular e 1,333 no desktop; h1 clamp(2.4rem, 6vw, 5.5rem)",
      palette: { background: o.background ?? "#f6f1e7", surface: "#ece3d2", ink: "#1f1a14", muted: "#5b5146", accent: o.accent ?? "#8a2f1c", accentInk: "#ffffff" }, paletteReason: "Madeira, tijolo e toalha de linho.",
      imageStyle: "fotografia quente de mesa em luz natural lateral", motion: o.motion ?? "calma", motionPlan: "Entrada do hero ao carregar e respostas ao toque.", tone: "direto e caloroso", primaryAction: "Ver como chegar",
      heroArchetype: o.hero ?? "colunas", heroComposition: "Texto à esquerda em 5 colunas, foto 4:5 à direita em 7 colunas.", ...(o.signature ? { signatureMoment: o.signature } : {}), mobileComposition: "Título, ação em largura total e foto abaixo.", conversionPath: "Hero → Ver como chegar.",
      rationale: { firstScreen: "Categoria e cidade primeiro.", hero: "A foto mostra o tipo de comida.", photography: "Mesa sem pessoas.", motion: "Calma combina com a visita.", mobile: "Ação no polegar.", conversion: "Sem telefone, a ação é chegar." },
    },
    copy: { headline: o.headline ?? "Comida de cantina no centro de Ribeirão Preto", subheadline: "Massas e pratos de forno numa mesa de bairro.", primaryCta: "Ver como chegar", secondaryCta: null },
    pages: o.twoPages ? { count: 2, reason: "A categoria tem várias frentes.", secondary: { file: "servicos.html", navLabel: "Serviços", title: "Serviços", purpose: "Detalhar as frentes da categoria.", sections: [{ id: "frentes", function: "oferta", purpose: "Frentes", composition: "Lista", imageId: null }, { id: "contato", function: "contato", purpose: "Contato", composition: "Faixa", imageId: null }] } } : { count: 1, reason: "Uma página basta.", secondary: null },
    sections,
    images: o.imageSet ? IMAGE_SET : [{ id: "hero", role: "hero", aspect: o.aspect ?? "4:5", placement: "coluna direita do hero", subject: "mesa de madeira com travessa de massa", context: "salão de cantina", style: "fotografia documental", light: "luz lateral quente de janela", framing: "plano médio, 50 mm", depth: "profundidade rasa", textSpace: "nenhuma", dominantColors: "terracota e creme", restrictions: "sem pessoas, sem logotipos, sem texto", prompt: "Fotografia documental de uma mesa de madeira de cantina com uma travessa de massa, luz lateral quente de janela.", alt: "Mesa de madeira com travessa de massa" }],
    differentiation: "Primeira demo do segmento com hero em colunas.", message: "Olá! Preparei uma demonstração não oficial de site para a cantina. Nada foi publicado. Posso enviar o link?",
  });
}

const head = (title: string, fonts = "family=Fraunces:wght@600&family=Work+Sans:wght@400;600") => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><meta name="description" content="Demonstração"><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fonts}&display=swap"><link rel="stylesheet" href="styles.css"></head>`;
const nav = (extra = "") => `<header class="topo"><a class="marca" href="index.html">Cantina Alvorada</a><button class="menu" type="button" aria-expanded="false" aria-controls="menu">Menu</button><nav id="menu" class="nav"><a href="#cozinha">Cozinha</a><a href="#visita">Visita</a>${extra}</nav></header>`;

export function goodSite(o: { twoPages?: boolean; phone?: boolean; imageSet?: boolean } = {}): SiteCode {
  const cta = o.phone ? `<a class="btn" href="{{WHATSAPP_LINK}}" target="_blank" rel="noopener">Chamar no WhatsApp</a>` : `<a class="btn" href="{{MAPS_LINK}}" target="_blank" rel="noopener">Ver como chegar</a>`;
  const html = `${head("Cantina em Ribeirão Preto")}<body>${nav(o.twoPages ? '<a href="servicos.html">Serviços</a>' : "")}<main>
<section id="inicio" class="hero"><div class="hero-texto"><h1>Comida de cantina no centro de Ribeirão Preto</h1><p>Massas e pratos de forno numa mesa de bairro, para quem quer comer sem pressa.</p>${cta}</div><img src="assets/hero.webp" alt="Mesa de madeira com travessa de massa" width="800" height="1000" fetchpriority="high"></section>
<section id="cozinha"><h2>A cozinha</h2><p>Uma cantina serve massas, molhos de panela e pratos de forno. Pergunte o que sai hoje quando chegar.</p>${o.imageSet ? '<img src="assets/salao.webp" alt="Salão de cantina com pessoas à mesa" width="1600" height="900" loading="lazy" decoding="async">' : ""}</section>
<section id="visita"><h2>Como é a visita</h2><p>Chegue, escolha a mesa e peça. Para combinar algo antes, use o contato abaixo.</p>${o.imageSet ? '<img src="assets/preparo.webp" alt="Mãos abrindo massa fresca" width="1200" height="1200" loading="lazy" decoding="async">' : ""}</section>
<section id="contato"><h2>Contato</h2><p>${o.phone ? "Fale pelo WhatsApp: {{PHONE_DISPLAY}}." : "Veja o caminho no mapa."}</p>${cta}</section>
</main><footer><p>Cantina Alvorada · Ribeirão Preto, SP</p></footer></body></html>`;
  const secondary = o.twoPages ? { file: "servicos.html", html: `${head("Serviços da cantina em Ribeirão Preto")}<body>${nav('<a href="servicos.html">Serviços</a>').replace(/href="#/g, 'href="index.html#')}<main><section id="frentes"><h1>O que uma cantina serve</h1><p>Massas, molhos e pratos de forno, servidos à mesa.</p></section><section id="contato"><h2>Contato</h2><a class="btn" href="index.html#contato">Voltar ao contato</a></section></main><footer><p>Cantina Alvorada · Ribeirão Preto, SP</p></footer></body></html>` } : null;
  const css = `:root{--bg:#f6f1e7;--ink:#1f1a14;--accent:#8a2f1c;--accent-ink:#fff;--ease:cubic-bezier(0.23,1,0.32,1)}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:400 1.0625rem/1.6 "Work Sans",sans-serif}
h1,h2{font-family:"Fraunces",serif;line-height:1.08;text-wrap:balance;margin:0 0 .5em}h1{font-size:clamp(2.2rem,6vw,5rem)}
p{max-width:65ch;text-wrap:pretty}main img{max-width:100%;height:auto;object-fit:cover}main section,.topo,footer{padding:3rem clamp(1rem,4vw,4rem)}
.topo{display:flex;justify-content:space-between;align-items:center;gap:1rem;padding-block:1rem}.nav{display:flex;gap:1.5rem}.nav a,.marca{color:var(--ink);min-height:44px;display:inline-flex;align-items:center}
.menu{display:none;min-height:44px;padding:0 1rem;font:inherit;background:transparent;border:1px solid var(--ink);border-radius:8px;color:var(--ink)}
.hero{display:grid;grid-template-columns:5fr 7fr;gap:2rem;align-items:center;min-height:80svh}.hero img{width:100%;height:auto;aspect-ratio:4/5;object-fit:cover;max-height:80svh}
.btn{display:inline-flex;align-items:center;min-height:48px;padding:0 1.4rem;background:var(--accent);color:var(--accent-ink);border-radius:8px;text-decoration:none;font-weight:600;transition:transform 160ms var(--ease)}
.btn:active{transform:scale(.97)}a:focus-visible,button:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
@media (hover:hover) and (pointer:fine){.btn:hover{transform:translateY(-1px)}}
@media (max-width:760px){.hero{grid-template-columns:1fr;min-height:auto}.menu{display:inline-flex;align-items:center}.nav{display:none;position:absolute;top:4rem;left:1rem;right:1rem;flex-direction:column;background:var(--bg);padding:1rem;border:1px solid var(--ink)}.nav.aberto{display:flex}.btn{width:100%;justify-content:center}}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}`;
  const js = `const b=document.querySelector('.menu'),n=document.getElementById('menu');if(b&&n){b.addEventListener('click',()=>{const o=n.classList.toggle('aberto');b.setAttribute('aria-expanded',String(o))});n.addEventListener('click',(e)=>{if(e.target.closest('a')){n.classList.remove('aberto');b.setAttribute('aria-expanded','false')}})}`;
  return { html, css, js, secondary, notes: "fixture" };
}

/** Site com problemas visíveis só no navegador (o QA estático não pega tudo isso). */
export function brokenSite(): SiteCode {
  const html = `${head("Cantina em Ribeirão Preto")}<body><header class="topo"><a class="marca" href="index.html">Cantina</a><nav class="nav"><a href="#cozinha">Cozinha</a><a href="#contato">Contato</a></nav></header><main>
<section id="inicio" class="hero"><h1 class="reveal">Comida de cantina no centro de Ribeirão Preto</h1><p class="sobre">Texto que fica por cima do título no celular.</p><div class="largo">faixa larga</div><img src="assets/hero.webp" alt="Mesa" width="800" height="1000"><a class="btn" href="{{MAPS_LINK}}" target="_blank" rel="noopener">Ver como chegar</a></section>
<section id="cozinha"><h2>A cozinha</h2><p>Massas e pratos de forno.</p></section><section id="contato"><h2>Contato</h2><p>Veja o caminho no mapa.</p></section></main><footer><p>Cantina</p></footer></body></html>`;
  const css = `body{margin:0;font:400 1rem/1.5 "Work Sans",sans-serif;background:#f6f1e7;color:#1f1a14}h1{font-family:"Fraunces",serif;font-size:3rem;position:relative}
.reveal{opacity:0}.reveal.visivel{opacity:1}a,button{outline:none}a:focus-visible{outline:none}
.sobre{position:relative;top:-4.2rem}.largo{width:1600px;height:20px;background:#8a2f1c}.hero img{width:300px;height:100px}
.btn{display:inline-block;padding:2px 6px;background:#8a2f1c;color:#fff;animation:pulsa 1s infinite}@keyframes pulsa{50%{transform:scale(1.05)}}
@media (max-width:760px){.nav{display:none}}`;
  const js = `document.querySelector('.reveal').classList.add('visivel');`;
  return { html, css, js, secondary: null, notes: "fixture quebrada" };
}

/** PNG mínimo válido 4x5 (para os testes que gravam imagens sem gerar nada). */
export function tinyPng(width = 400, height = 500): Buffer {
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); ihdr.write("IHDR", 4); ihdr.writeUInt32BE(width, 8); ihdr.writeUInt32BE(height, 12);
  return Buffer.concat([header, ihdr, Buffer.alloc(30)]);
}

/**
 * Movimento moderado bem feito: entrada do hero + revelação ao rolar com IntersectionObserver, estado inicial sob .js e
 * tudo visível com movimento reduzido. `broken` não revela nada ao rolar e esquece o movimento reduzido.
 */
export function revealSite(o: { broken?: boolean } = {}): SiteCode {
  const base = goodSite();
  const html = base.html.replace(/<section id="(cozinha|visita|contato)">/g, '<section id="$1" class="reveal">');
  const reduced = o.broken ? "" : ".js .reveal{opacity:1;transform:none}";
  const css = base.css.replace("@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}", "")
    + `.js .hero-texto{animation:entra 700ms var(--ease) both}@keyframes entra{from{opacity:0;transform:translateY(16px)}}
.js .reveal{opacity:0;transform:translateY(24px);transition:opacity 600ms var(--ease),transform 600ms var(--ease)}.js .reveal.is-in{opacity:1;transform:none}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}${reduced}}`;
  const observe = o.broken ? ".nunca-existe" : ".reveal";
  const js = `document.documentElement.classList.add('js');${base.js};const io=new IntersectionObserver((es)=>{for(const e of es){if(e.isIntersecting){e.target.classList.add('is-in');io.unobserve(e.target)}}},{threshold:0.15});document.querySelectorAll('${observe}').forEach((el)=>io.observe(el));`;
  return { ...base, html, css, js, notes: o.broken ? "revelação quebrada" : "revelação ao rolar" };
}

/**
 * Regressão da demo AJ Santos (2026-11-14): perguntas em <details> fechados e um link que quebra linha dentro de um
 * parágrafo. Nada aqui se sobrepõe de verdade; o QA antigo acusava "p × p" em todas as larguras.
 */
export function faqSite(): SiteCode {
  const base = goodSite();
  const faq = `<section id="duvidas"><h2>Dúvidas de quem vem pela primeira vez</h2><div class="faq">${[
    ["Precisa reservar?", "Não é preciso. Se quiser combinar algo antes, use o contato da página."],
    ["Dá para levar crianças?", "Pergunte no contato como funciona o espaço para famílias."],
    ["Tem opção sem glúten?", "Uma cantina costuma trabalhar com massas de trigo; confirme as opções no contato."],
    ["Como chegar?", "O link de mapa no fim da página abre o caminho a partir de onde você está."],
  ].map(([q, a]) => `<details><summary>${q}</summary><div class="resp"><p>${a}</p></div></details>`).join("")}</div>
<p class="nota">Para combinar uma mesa grande, <strong>escreva antes</strong> e <a href="#contato">veja os canais de contato no fim desta página, que abrem direto no aplicativo</a> com o seu pedido.</p></section>`;
  const html = base.html.replace('<section id="contato">', `${faq}<section id="contato">`);
  const css = base.css + `.faq details{border-top:1px solid var(--ink)}.faq summary{display:flex;justify-content:space-between;min-height:3.5rem;align-items:center;font-weight:700;cursor:pointer;list-style:none}.faq .resp{padding-bottom:1rem}.nota{max-width:28ch}`;
  return { ...base, html, css, notes: "faq recolhido" };
}

/** Avaliação visual de exemplo (notas por critério, evidência concreta e correções priorizadas). */
export function visualReviewFixture(scores: Partial<Record<(typeof VISUAL_CRITERIA)[number]["key"], number>> = {}, fixes = 2): VisualReview {
  const criteria = Object.fromEntries(VISUAL_CRITERIA.map((item) => {
    const score = scores[item.key] ?? 8.5;
    return [item.key, { score, evidence: `O h1 em serifa ocupa metade da primeira tela no desktop e a fotografia 4:5 do hero sangra à direita (${item.label}), com o botão principal visível logo abaixo.`, problems: score < VISUAL_TARGET ? [`A seção de contato repete o fundo liso do início sem contraste (${item.key}).`] : [] }];
  })) as VisualReview["criteria"];
  return {
    criteria, preserve: ["A combinação de serifa editorial com o fundo creme no hero."],
    fixes: Array.from({ length: fixes }, (_, index) => ({ priority: index + 1, area: "hero" as const, target: "seção inicio", instruction: "Recompor o hero em 7/5 com a fotografia sangrando à direita e o título sobre faixa da superfície." })),
  };
}
