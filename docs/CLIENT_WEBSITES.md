# Playbook de sites de clientes

Como a Sellora concebe, constrói e entrega o produto que vende: **sites profissionais para estabelecimentos**. Complementa `docs/FRONTEND_PLAYBOOK.md` (princípios técnicos) e é a referência da skill `website-builder`.

Status: conhecimento de referência. Nenhum site de cliente existe ainda neste repositório. Local de código de sites de clientes: **pendente de decisão** (ver `docs/DECISIONS.md`).

---

## 1. Fluxo de produção

1. **Briefing aprovado** — objetivo, público, oferta, diferenciais, tom, conteúdo, fotos, contatos, horários, endereço. Marcar confirmado / inferido / pendente / opcional.
2. **Direitos** — logo, fotos, textos, depoimentos e marcas com autorização registrada.
3. **Ficha de direção criativa** (§2) — uma direção, justificada.
4. **Sitemap + CTA principal** — cada página com objetivo e ação.
5. **Storyboard** (§3) — sequência de cenas, motion especificado (FRONTEND_PLAYBOOK §8.2).
6. **Construção** — tokens → componentes → páginas; desktop e mobile recompostos.
7. **QA** — skill `quality-assurance` + checklist pré-publicação (§6).
8. **Preview** — URL de preview; nunca produção sem aprovação.
9. **Aprovação do cliente** documentada → publicação autorizada por humano.

## 2. Ficha de direção criativa (template)

```
Cliente / segmento:
Objetivo de negócio e CTA principal:
Conceito (1 frase):
Por que combina com este cliente:
Paleta (tokens semânticos + valores):
Tipografia (display / corpo / números; licença):
Fotografia (luz, crop, atmosfera; origem):
Grid e composição:
Componentes-chave:
Linguagem de motion (o que move, por quê, intensidade):
Navegação mobile:
O que NÃO fazer neste projeto:
Pendências:
```

Cada cliente recebe direção **singular**: nunca reaplicar template, gradiente ou tipografia de outro cliente por padrão.

## 3. Storytelling web

Um site é uma sequência de decisões, não uma pilha de seções.

| Ato | Função | Exemplo em negócio local |
|---|---|---|
| 1. Impacto inicial | Atmosfera + proposta legível | Prato assinatura, fachada, equipe |
| 2. Contexto / problema | Necessidade ou universo da marca | "Café da manhã sem pressa no centro" |
| 3. Descoberta | Diferencial mostrado, não declarado | Ingredientes, processo, ambiente |
| 4. Demonstração | Serviço em uso, cardápio, tratamentos | Cardápio escaneável, antes/depois autorizado |
| 5. Confiança | Provas **reais** | Avaliações autorizadas, anos de casa, equipe |
| 6. Conversão | CTA claro e contínuo | WhatsApp, reserva, rota, orçamento |

- Ritmo: alternar impacto, explicação e respiro; nem toda seção tem efeito.
- Cena = objetivo + composição + texto + movimento + transição.
- Transformações concretas valem como motion narrativo: ingrediente → prato, material → objeto, antes → depois (somente autorizado e real).
- Decidir conscientemente: **cinematográfico contido** ou **expressivo/maximalista**.
- Storytelling nunca dispensa navegação simples, menu, CTA, acessibilidade e dados reais.

## 4. Ambição por pacote (recomendação — validar com o fundador)

Inferência a partir das referências de preço em `docs/PRODUCT_CONTEXT.md`. Serve para não entregar motion de R$ 5.000 por R$ 590 nem prometer o que o prazo não comporta.

| Pacote | Escopo típico | Motion / técnica | Evitar |
|---|---|---|---|
| Essencial (ref. R$ 590) | Landing de uma página, CTA único | CSS transitions, reveals leves com IntersectionObserver | WebGL, GSAP, sequências de imagem |
| Profissional (ref. R$ 990) | Institucional multipágina, SEO local | + Motion em microinterações, 1 momento narrativo | 3D, scroll-jacking |
| Personalizado (a partir de R$ 1.490) | Escopo sob medida | Storytelling avançado, GSAP/3D **se** justificado e orçado | Efeito sem função |

## 5. Padrões por segmento

| Segmento | Prioridades | Motion adequado | Nunca |
|---|---|---|---|
| Restaurantes, cafés, food | Foto apetitiva, produto herói, cardápio escaneável, preços corretos, reserva/pedido, horários e unidades reais | Preparo, ingredientes, embalagem, seleção | Preço ou horário não confirmado |
| Comércio / e-commerce local | Atributos, variantes, preço, frete, políticas visíveis | Galerias, swatches, detalhes por scroll | Chamar demo de checkout real |
| Saúde, odontologia, estética, veterinária | Credibilidade, tratamentos por necessidade do paciente, equipe com credenciais confirmadas, agendamento claro | Contido, acolhedor | Depoimento/resultado inventado; antes/depois sem autorização; expor dados sensíveis |
| Serviços locais (oficinas, salões, reformas, advocacia) | O que faz, área atendida, prova de trabalho, contato imediato | Mínimo; antes/depois real | Selos/avaliações fictícios |
| Imóveis, arquitetura, turismo | Imagens grandes coerentes, storytelling do lugar, localização verificável, atributos objetivos | Parallax moderado, hotspots, comparativos | Localização imprecisa |
| Portfólios e serviços criativos | Hero autoral, cases contexto → solução → resultado verificável, contato evidente | Expressivo se a marca pede | Motion mascarando ausência de trabalhos |
| Fitness / wellness | Energia ou calma conforme marca, horários e planos legíveis, CTA para aula | Ritmo coerente com a marca | Calculadora sem fundamento |
| SaaS / dashboards | Métricas com unidade e período, estados, filtros | Funcional | Dados fictícios sem rótulo |

## 6. Checklist pré-publicação (contextual)

- [ ] CTA principal funciona em mobile e desktop (WhatsApp/telefone/form testados).
- [ ] Formulário com confirmação real e página/estado de sucesso honesto.
- [ ] Horários, endereço, mapa, preços e prazos **confirmados pelo cliente**.
- [ ] Imagens, fontes e scripts com licença registrada; nenhum asset de referência copiado.
- [ ] Título/meta únicos, Open Graph, favicon, canonical, sitemap se multipágina, dados estruturados verdadeiros.
- [ ] Página 404; links internos e externos válidos.
- [ ] Políticas legais adequadas (privacidade/LGPD se coleta dados); tracking só com consentimento aplicável.
- [ ] 360 / 768 / 1440 px sem scroll horizontal; teclado; foco; contraste medido; reduced-motion.
- [ ] Lighthouse/CWV executados e registrados (ambiente e data), sem inventar scores.
- [ ] Preview aprovado pelo cliente por escrito antes de publicar.

## 7. Conteúdo e escrita

- Direta, concreta, contemporânea: o que o negócio faz, para quem, como funciona, como contatar.
- Evitar "revolucionário", "experiência única", "não é apenas X, é Y", buzzwords e emojis como substituto de conteúdo. Revisar com a skill `humanizer` quando o texto soar artificial.
- Nunca inventar avaliações, métricas, prêmios, licenças, depoimentos ou features.

## 8. Divulgação e portfólio

- Mostrar recursos que existem; uma ideia por quadro; legível em tela pequena; margens seguras.
- Carrossel: capa → contexto → visão geral → recurso → recurso → prova → CTA. Stories/reels 9:16 com texto em área segura e roteiro por cena. LinkedIn: contexto → solução → evidência.
- Conceitos/demos rotulados como **conceito** (`portfolio_items.is_concept`), nunca como cliente real.
- Prompts de imagem: proporção, composição, estilo, luz, materialidade, fundo, preservações e exclusões; não alterar logo/embalagem sem pedido; transparência real exige canal alfa.

## 9. Repertório de ferramentas e componentes

Referências metodológicas (não presumir instaladas — ver `docs/SKILLS_SETUP.md`): Frontend Design (Anthropic), UI UX Pro Max, Impeccable, Taste, Web Design Guidelines, Humanizer.

Bibliotecas e recursos visuais — verificar licença, compatibilidade, acessibilidade, custo e aderência ao design system **antes** de usar:
- Componentes/motion: [React Bits](https://reactbits.dev/), [Aceternity UI](https://ui.aceternity.com/), [21st.dev](https://21st.dev/), [Motion](https://motion.dev/), [Uiverse](https://uiverse.io/); também Hover.dev, Magic UI, Motion Primitives, Animate UI.
- Fontes e cor: [Fontshare](https://www.fontshare.com/), [Realtime Colors](https://www.realtimecolors.com/).
- Formas e mídia: [Haikei](https://haikei.app/), [Pexels Videos](https://www.pexels.com/videos/).

Componentes como Focus Cards, Profile Card, Lanyard, Morphing Navbar, Ghost Fibers, Holo Card, Magnetic CTA e Magic Bento são ideias de interação a reinterpretar, não peças a copiar.

## 10. Biblioteca de referências — estudar a ideia, não a aparência

Rótulos são direções criativas registradas no material de origem, **não** auditoria do código nem garantia de que o efeito ainda exista. Antes de instruir reprodução, verificar a versão atual e separar observado / documentado / hipótese. Não transferir nomes, marcas, imagens, layouts ou componentes.

**Narrativa imersiva, 3D, automotivo e tecnologia**
- agrumeafarm.it/en — food storytelling, produto e profundidade 3D.
- forgeautomotive.co.uk — fotografia automotiva cinematográfica, luxo editorial.
- heronaiapp.com — design técnico; interação como demonstração do produto.
- era-residence.com — storytelling imobiliário mediterrâneo, galerias, atmosfera.
- thewatch.60fps.fr — 3D de relógio integrado à narrativa.
- jeffbrokaw.com — portfólio com cases, autoridade, métricas, controle de movimento.
- smirnov-artur.github.io/demo/lustre-detailing — carro 3D persistente com câmera e luz guiadas pelo scroll (autor relata Three.js + Lenis). Referência prioritária para storytelling 3D.
- askairank.com — narrativa SaaS ligada a dashboards e métricas.
- viture.com/luma — hardware premium, closes, comparativo de modelos.
- darkroom.au — mockups premium, tipografia e produto protagonista.

**Food, bebidas, perfumaria e e-commerce de marca**
- cravburgers.shop — smashed burgers, editorial expressivo.
- buckssauce.com — molhos, ingredientes animados, bundles.
- eathungrytiger.com — maximalismo gastronômico pop.
- palmo.co.in — água de coco conceitual, narrativa tropical (WebGL/GSAP relatados).
- yoin-fragrance.netlify.app — perfume em capítulos sensoriais.
- sundaycrumb.framer.website — bakery lúdica, stickers, hover de marca.
- palazzo.framer.website — restaurante premium; mesa giratória, drag/scroll, revelação de janela embaçada (segundo material do template).
- slice-town-wbs.framer.website — pizza pop, produto monumental no hero.
- sofra.framer.website — restaurante premium, verde escuro, serifada, fotografia.
- lunarossa.framer.website — confeitaria, processo narrado e conversão.
- deuxbakery.framer.website — bakery editorial, aparições sutis.
- sora-template.framer.website — fusão, história cultural, reservas.
- machi-coffee.framer.website — cold brew, objetos flutuantes, marquee.
- fereacafe.framer.website — café editorial com scroll effects.
- mornibali.framer.website — brunch retrô, cardápio CMS, info nutricional.
- gribble.framer.website — smash burger urbano, elementos de recibo.
- perfuma.framer.website — perfume de produto único (não presumir carrinho).
- chalant.framer.website — skincare, ingredientes, grade comercial.

**Imóveis, saúde, serviços, portfólios, fitness e produto**
- badgefolio.framer.website — portfólio modular com identidade de crachá.
- haven.framer.media — imobiliário de luxo editorial.
- scary-aside-764750.framer.app — "DeNest", imóveis com galerias e filtros.
- meddocx.framer.ai — estrutura de serviços médicos.
- dentelle.framer.website — odontologia organizada por problema do paciente.
- thresholdtemplate.framer.website — fitness com zonas cardíacas e dados.
- forge-x.framer.website — fitness cinematográfico, reveals, contadores.
- norafurniture.framer.website — reveal de hero, preview no hover, anatomia do móvel no scroll (pedido abre e-mail, sem checkout).
- pilate.framer.website — wellness calmo, aulas e preços (sem booking funcional).
- vetcare.framer.website — clínica veterinária, jornada de atendimento.
- sneako.framer.website — sneakers, coleções, catálogo expressivo.

Templates Framer: Remix permite edição visual, não exportação de código. Reimplementar em código original.
