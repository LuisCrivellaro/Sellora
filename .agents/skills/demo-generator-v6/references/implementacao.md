# Implementação (etapa de produção)

Enviada só na chamada que escreve o código. Siga exatamente o briefing aprovado: fontes, paleta, arquétipo do hero, momento de assinatura, seções e composições, textos planejados, imagens e plano de movimento. Não invente fatos novos ao escrever. O objetivo é um site que pareça feito por um estúdio: composição com intenção, tipografia com personalidade, fotografia integrada ao layout e movimento elegante, sem sacrificar acessibilidade e desempenho.

## 1. Contrato técnico (a aplicação rejeita o que fugir dele)

- Arquivos: `index.html`, `styles.css`, `script.js` opcional e, quando o briefing tiver duas páginas, a segunda página no arquivo indicado (`secondary.file`). As duas páginas usam o mesmo `styles.css` e o mesmo `script.js`.
- Cada página: `<!doctype html>`, `<html lang="pt-BR">`, `<meta charset="utf-8">`, `<meta name="viewport" content="width=device-width, initial-scale=1">`, `<title>` próprio, `<meta name="description">`, `<link rel="stylesheet" href="styles.css">`, um único `h1`, títulos em ordem (h1 → h2 → h3, sem pular nível), `header` com o nome e a navegação, `main` com `section` de `id` próprio, `footer` com o nome e a cidade.
- Navegação: âncoras só para seções que existem na mesma página (`#contato`) ou na outra (`servicos.html#atendimentos`, `index.html#contato`). Na segunda página, o nome do negócio leva a `index.html`. Nunca link para página que não existe.
- Recursos externos permitidos: só o `<link>` do Google Fonts (`fonts.googleapis.com`, com `display=swap` e só os pesos usados) e os links de contato. Nada de CDN, biblioteca, iframe, mapa incorporado, vídeo, formulário, `fetch`, armazenamento ou rastreador.
- JavaScript: nenhum `<script>` inline nem atributo de evento (`onclick`…). `script.js` é melhoria progressiva: menu do celular, entrada do hero, revelações ao rolar e microinterações. A página precisa funcionar e mostrar todo o conteúdo com o JavaScript desligado: nada nasce com `opacity: 0` ou fora da tela esperando o script. O primeiro comando do script é `document.documentElement.classList.add('js')`, e todo estado inicial de animação fica sob `.js` (ex.: `.js .reveal { opacity: 0; transform: translateY(24px) }`).
- Imagens: só os caminhos de `assets/` listados, todas usadas, com `alt`, `width` e `height` reais da proporção e `object-fit: cover`. A imagem da primeira tela leva `fetchpriority="high"` e nunca `loading="lazy"`; as demais levam `loading="lazy"` e `decoding="async"`. Ícones, se precisar, em SVG inline simples com `aria-hidden="true"` e o mesmo traço.
- Contato: com telefone, use exatamente `{{PHONE_DISPLAY}}` (texto), `{{PHONE_LINK}}` (href tel) e `{{WHATSAPP_LINK}}` (href do WhatsApp). Sem telefone, não escreva nenhum telefone, nem "Ligar"; use `{{MAPS_LINK}}` para "Ver como chegar". Links externos com `target="_blank" rel="noopener"`.
- Não escreva o aviso de demonstração nem legendas sobre as imagens: a aplicação insere uma faixa no topo de cada página dizendo que é demonstração e que as imagens são ilustrativas. Sem texto de preenchimento (lorem ipsum, "Seu texto aqui", colchetes, TODO).
- Todo botão (`<button>`) tem uma ação real em `script.js` (ex.: abrir o menu com `aria-expanded`) e `type="button"`; todo link tem destino real. Nada de `href="#"`.

## 2. Composição e CSS

- Variáveis em `:root` para a paleta (`--bg`, `--surface`, `--ink`, `--muted`, `--accent`, `--accent-ink`), as fontes, a escala de tipo, os espaços e as curvas. Um container comum (`max-width` + `padding-inline` iguais dos dois lados); seções de impacto podem sangrar até a borda (imagem ou faixa de cor de largura total).
- Realize o momento de assinatura com cuidado: é a parte da página que recebe mais atenção de design. Use CSS Grid para composições assimétricas, sobreposições intencionais entre imagem e texto (com contraste garantido por painel ou área livre da foto), imagens em formatos diferentes, faixas de contraste e espaço negativo deliberado.
- Tipografia: escala do briefing; h1 com `clamp()`; `text-wrap: balance` em títulos e `text-wrap: pretty` em parágrafos; destaque de palavra com peso, itálico ou cor (`<em>`/`<strong>` estilizados, nunca gradiente); corpo ≥ 1rem com `max-width` de 60–75ch; `font-variant-numeric: tabular-nums` em números alinhados; nenhum texto de interface abaixo de 12px.
- Ritmo: escala de espaçamento com degraus claros (ex.: 0.5/1/1.5/2.5/4/6.5/9rem), mais espaço acima de um título que abaixo, seções com respiro proporcional à importância. Alterne fundos e composições como o briefing planejou; nada de metade da seção vazia sem intenção ou de bloco solto num lado.
- Um sistema: um estilo de botão principal e um secundário, um raio de borda, um estilo de link (sublinhado com `text-underline-offset`).
- Superfícies do navegador também têm design: `::selection`, `accent-color`, `caret-color`, cor da barra de rolagem e foco visível (`:focus-visible` com contorno de 2–3px da paleta e `outline-offset`).

## 3. Responsividade real (1440, 1024, 768, 390 e 360 px)

- Projete o celular, não encolha o desktop: em 390 px uma coluna, o hero recomposto como em `mobileComposition`, o momento de assinatura adaptado (não removido), botões com pelo menos 44px de altura (de preferência largura total no hero), menu acessível com botão `aria-expanded` e `aria-controls`, nada passando da largura (palavras longas com `overflow-wrap: anywhere` no h1 se preciso).
- `100svh`/`100dvh` em vez de só `100vh`; `-webkit-tap-highlight-color: transparent`; `touch-action: manipulation` em botões.
- Em 1024 e 768 a composição muda onde precisa (colunas que viram uma, imagem que muda de lado ou de proporção), não só a largura.
- Elementos nunca se sobrepõem sem intenção. Texto sobre imagem só onde o briefing pede, com contraste garantido; posições absolutas e margens negativas só com a sobreposição prevista em todas as larguras. A aplicação mede sobreposição de texto, cortes e rolagem horizontal em cada largura; esses defeitos impedem a aprovação.
- Perguntas com `<details>`/`<summary>` são bem-vindas quando a seção existe: acessíveis por padrão e sem JavaScript.

## 4. Movimento e microinterações (Emil Kowalski)

- Anime só `transform`, `opacity` e, com cuidado, `clip-path`. Nunca `transition: all` nem `width/height/top/left/margin/padding`.
- Curva padrão `cubic-bezier(0.23, 1, 0.32, 1)`; respostas de interface entre 150 e 300 ms; entradas e revelações entre 500 e 900 ms; nunca `ease-in` em interface. Botões: `:active { transform: scale(0.97) }` em 160 ms. Nada surge de `scale(0)`: comece em 0.95 ou mais, com opacidade.
- Entrada do hero: uma vez ao carregar, coreografada (título, texto, CTA e imagem com escalonamento curto de 60–120 ms; imagem pode se revelar por `clip-path` ou escala de 1.06 para 1).
- Revelação ao rolar (movimento "moderada" ou "expressiva"): `IntersectionObserver` em `script.js` adiciona uma classe quando o bloco entra na tela (limiar ~0.15) e para de observar; o estado inicial fica sob `.js`; deslocamento curto (16–32px) e opacidade; escalonamento leve entre itens irmãos. Nada fica escondido depois de revelado, e todo conteúdo termina visível depois de rolar a página inteira (a aplicação confere).
- Microinterações: hover só em `@media (hover: hover) and (pointer: fine)`: botão muda de tom ou eleva levemente, imagem com link aproxima 1.02–1.04 dentro da moldura, sublinhado desenha da esquerda para a direita. Menu do celular abre com transição curta de `opacity`/`transform` e fecha ao escolher um link.
- Profundidade leve é permitida (camadas que se deslocam poucos pixels em relação à imagem), nunca em texto corrido e nunca sequestrando a rolagem. Em telas pequenas, reduza distâncias e durações.
- Loop só em elemento gráfico decorativo, lento e sutil, nunca em texto ou botão.
- `@media (prefers-reduced-motion: reduce)`: tudo parado e visível (sem transformações iniciais, sem loops, revelações já concluídas).

## 5. Performance e metadados

- HTML semântico, CSS sem regras mortas, JavaScript enxuto (menos de 5 KB costuma bastar para menu, entrada e revelações). Sem bibliotecas.
- `<link rel="preconnect">` para `fonts.googleapis.com` e `fonts.gstatic.com` (crossorigin) antes da folha de fontes.
- Imagens com dimensões explícitas para o layout não pular; só a do hero sem `loading="lazy"`.
