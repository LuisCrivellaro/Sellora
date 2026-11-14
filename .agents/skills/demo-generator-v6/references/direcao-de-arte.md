# Direção de arte e planejamento (etapas 2 a 5)

Enviada só na chamada do briefing, junto com o perfil do segmento (`segmentos.md`). Antes de qualquer código, cada decisão abaixo precisa de uma justificativa curta e concreta, ligada ao negócio, à cidade ou ao visitante. "Para parecer moderno" ou "para ser diferente" não é justificativa.

A mentalidade é **sofisticado, expressivo, memorável e adequado ao segmento**, não "seguro, discreto e simples". Um setor sério pede tom contido, não uma página estática e sem imagem.

## 1. Análise comercial

- Tipo de negócio: **lugar** (as pessoas vão até ele), **serviço** (as pessoas contratam) ou **produto/loja** (as pessoas compram). Escreva o segmento específico.
- `confirmed`: só o que está no cadastro. `unknown`: o que falta e que a página não vai fingir saber.
- `visitorGoal`: o que o visitante quer resolver ao abrir a página (saber se é perto, se faz o que ele precisa, como falar).
- `firstInformation`: de 1 a 4 itens que precisam aparecer primeiro, em ordem.
- `commercialGoal` e `conversionPath`: a ação principal possível com os canais existentes (com telefone válido: WhatsApp ou ligação; sem telefone: "Ver como chegar"), e o caminho da primeira tela até ela.

## 2. Personalidade e conceito

- `concept`: uma frase concreta que outra pessoa conseguiria desenhar ("oficina de bairro com bancada à vista e ordem de serviço clara"), nunca um adjetivo solto.
- `personality` e `mood`: o caráter visual (editorial, caloroso, técnico, artesanal, cinematográfico, gráfico…) escolhido pelo segmento e pela cena de uso, não por gosto genérico.

## 3. Hero (primeira tela) e momento de assinatura

A primeira tela diz o que é, onde fica e qual a ação principal, sustenta sozinha a identidade e precisa causar impressão. Escolha `heroArchetype` pela necessidade do negócio e descreva a variação concreta em `heroComposition` (proporção texto/imagem, alinhamento, sobreposições intencionais, onde ficam nome, cidade e CTA):

- `foto-painel`: fotografia de ponta a ponta com painel ou faixa de texto sobreposta. Bom quando a imagem carrega o lugar.
- `colunas`: colunas assimétricas (por exemplo 5/7), texto de um lado, imagem recortada do outro.
- `tipografico`: nome ou título em escala muito grande ocupando a largura; imagem em faixa abaixo ou ao lado.
- `moldura`: imagem dentro de uma forma deliberada (arco, retângulo alto, recorte) ao lado de texto editorial.
- `grade`: grade editorial em que título, imagens de formatos diferentes e dados de contato ocupam módulos da mesma grade.
- `cor-solida`: fundo de cor plana e forte com título e dados de contato; a imagem entra logo na sequência.
- `faixa-panoramica`: título e ação no topo, faixa panorâmica (21:9) de largura total fechando a primeira tela.
- `indice`: o que o estabelecimento faz (em termos da categoria) é o elemento principal da primeira tela, como um índice tipográfico; imagem secundária. Bom para oficinas, clínicas e prestadores.

`signatureMoment`: o momento visual de assinatura da demo, aquele que o dono vai lembrar. Diga o que é, onde fica e por que serve a este negócio. Exemplos: hero editorial em tela cheia com título sobre a fotografia; composição tipográfica assimétrica com uma palavra em destaque; faixa de contraste forte entre duas seções claras; composição de imagens em formatos diferentes; elemento gráfico próprio do segmento (régua, carimbo, traço de planta, textura do material); transição sofisticada entre seções. Precisa ser intencional e coerente com o conceito, nunca um efeito solto para cumprir regra.

A aplicação recusa o arquétipo das duas demos mais recentes e compara o restante com o histórico. Novas variações dentro de um arquétipo são bem-vindas quando têm motivo; registre o motivo em `rationale.hero`. `mobileComposition` descreve como o hero se recompõe a 390 px (o que sobe, o que sai, onde fica o CTA, como o momento de assinatura sobrevive), não "empilha".

## 4. Tipografia (Impeccable e Taste)

- Duas famílias do Google Fonts no máximo: uma de destaque (`displayFont`, com `displayCategory`) e uma de leitura (`bodyFont`). Uma família só também é válida, com contraste de pesos.
- A tipografia carrega personalidade, não só tamanho: combine família, peso, caixa, itálico e espaçamento; destaque uma palavra ou trecho do título quando isso ajudar a leitura (peso, itálico ou cor de destaque, nunca gradiente); planeje quebras de linha que formem desenho no desktop e continuem legíveis no celular. Título grande sozinho não é direção de arte.
- Escolha pelo caráter do negócio e justifique em `typographyReason`. Não escolha por popularidade: evite como voz principal Inter, Roboto, Open Sans, Montserrat, Poppins, Lato, Arial e fontes de sistema. Varie categoria e família entre demos; a aplicação recusa a fonte de destaque das quatro demos mais recentes e a fonte de leitura que já domina o acervo.
- Repertório para começar (não é lista fechada): serifas editoriais (Fraunces, Newsreader, Spectral, Libre Caslon Text, Instrument Serif, Gloock, Cormorant Garamond, Playfair Display), serifas de cartaz (DM Serif Display, Young Serif, Abril Fatface), grotescas com caráter (Bricolage Grotesque, Familjen Grotesk, Schibsted Grotesk, Hanken Grotesk, Onest, Geologica, Syne), condensadas (Big Shoulders Display, Antonio, Barlow Condensed, Saira Condensed, Oswald), slab (Zilla Slab, Roboto Slab só como leitura técnica), geométricas (Outfit, Lexend, Urbanist), leitura (Source Serif 4, Literata, Figtree, Work Sans, Atkinson Hyperlegible, Public Sans, IBM Plex Sans).
- `typeScale`: escala com razão declarada (ex.: 1,25 no celular e 1,414 no desktop), h1 com `clamp()`, título de destaque até 7rem quando a composição pede, corpo ≥ 16px, medida de 60–75 caracteres, altura de linha do corpo 1,5–1,7 e dos títulos 0,95–1,15, tracking dos títulos grandes entre -0,02em e -0,045em.

## 5. Paleta

- Seis cores (fundo, superfície, texto, texto secundário, destaque, texto sobre destaque) com contraste ≥ 4,5:1 para texto e ≥ 3:1 para títulos grandes. Texto secundário em superfície colorida puxa o tom da superfície, nunca cinza neutro.
- Claro ou escuro pela cena de uso (quem, onde, que luz), não pela categoria. Use a superfície e o destaque para criar **seções de contraste** (faixa escura numa página clara, bloco na cor de destaque) em vez de repetir o mesmo fundo liso do começo ao fim sem decisão estética.
- Nada de violeta ou lilás como cor própria, nada de gradiente decorativo em negócio local. `paletteReason` liga as cores a algo do negócio (material, luz, cidade, ofício).

## 6. Fotografia e especificação de imagem (para o Codex)

O pedido informa quantas imagens cabem (até três). **Planeje o conjunto antes de especificar cada uma**: as imagens formam uma série coerente (mesma luz e tratamento) sem se repetir. Cada imagem tem função própria no layout, é usada por uma seção (`imageId`) e difere das outras em assunto, enquadramento e proporção. Exemplo para um escritório de advocacia: (1) hero: fotografia editorial de um ambiente jurídico contemporâneo com presença humana ilustrativa; (2) seção institucional: profissionais em reunião, sem sugerir que são a equipe real; (3) seção complementar: detalhe do atendimento ou do ambiente de trabalho. Use menos imagens só quando o design ficar melhor assim (por exemplo, hero tipográfico com uma imagem forte logo abaixo) e diga por quê em `rationale.photography`. A aplicação recusa imagens com o mesmo papel, imagens com assunto, enquadramento e proporção quase iguais, e imagens que nenhuma seção usa.

Para cada imagem preencha todos os campos, específicos o bastante para outra pessoa fotografar a cena:

- `role` (função no layout) e `placement` (onde entra), `subject` (assunto principal), `context` (onde, que tipo de lugar, sem identificar o estabelecimento), `style` (editorial, documental, retrato ambiental, natureza-morta…), `light` (direção, temperatura, hora), `framing` (plano, ângulo, lente equivalente), `depth` (profundidade de campo), `aspect`, `textSpace` (área livre para texto quando o título vai sobre a imagem, ou "nenhuma"), `dominantColors` (em harmonia com a paleta).
- `presence`: quem aparece. `sem-pessoas`; `maos` (mãos e antebraços em ação, sem rosto); `figurantes` (pessoas como parte natural do ambiente, de costas, de perfil ou em plano aberto); `pessoas-ilustrativas` (pessoas fictícias em situação profissional realista: atendendo, conversando, trabalhando). Pessoas trazem vida e escala à página: use-as quando a cena pede, variando a presença dentro do conjunto.
- `restrictions`: o que não pode aparecer nesta imagem (texto legível, logotipos, placas, fachada identificável, preços, produtos de marca, uniforme com nome, diploma ou documento legível, qualquer coisa que sugira credencial, resultado ou serviço não confirmado).
- `prompt`: o pedido completo em prosa, coerente com os campos acima, como um briefing de fotógrafo. Nunca genérico ("imagem bonita de escritório"). Peça fotografia realista e editorial, sem aparência de banco de imagens.
- `alt`: descreve o que se vê, sem dizer que é o local, a equipe ou os clientes reais.
- Varie o tipo de cena entre demos do mesmo segmento (ambiente amplo × pessoas em atendimento × detalhe do ofício × mãos trabalhando × natureza-morta).

## 7. Movimento (Emil Kowalski)

- `motion`: o padrão é **"moderada"**, também para escritórios, clínicas, consultórios, arquitetura, serviços e negócios corporativos. "calma" só quando a cena de uso pede quietude (explique em `rationale.motion`); "expressiva" para negócios de personalidade forte (barbearia, tatuagem, academia, bar), nunca para saúde e serviços profissionais.
- "moderada" = entrada coreografada do hero ao carregar + revelação suave das seções ao rolar (uma vez, curta, com escalonamento leve) + microinterações (botões, links, imagens com link, menu) + um movimento de destaque no momento de assinatura (ex.: imagem que se revela por `clip-path`, título que entra por linhas, leve profundidade entre imagem e texto).
- `motionPlan` diz o que se move, quando, por quê e como fica com movimento reduzido. Proibido: rolagem sequestrada, parallax em texto, animação que atrapalha a leitura, conteúdo que só aparece com JavaScript, piscadas e loops chamativos.

## 8. Páginas, seções e composição

- `pages.count` 1 ou 2, com `reason`. Com 2, `pages.secondary` traz o arquivo (ex.: `servicos.html`), o rótulo de navegação, o propósito e as seções próprias, sem repetir as do início.
- Planeje uma **sequência visual**, não uma lista de blocos de texto. Seções em ordem, cada uma com `function` (hero, apresentacao, oferta, processo, espaco, galeria, diferenciais, perguntas, localizacao, contato, chamada, rodape), propósito e `composition` concreta (editorial com fotografia grande, colunas assimétricas, faixa de contraste, composição de imagens em formatos diferentes, lista tipográfica de serviços, chamada comercial de largura total…).
- Varie o ritmo: alterne seções com imagem e seções tipográficas, claras e de contraste, largas e estreitas. Duas seções vizinhas não repetem a mesma composição, e a página não pode ser hero simples → bloco de texto → lista → perguntas → rodapé.
- `perguntas` só com dúvidas reais que a categoria implica, no máximo uma vez, nunca como recheio. Com pouco dado, prefira menos seções bem resolvidas.
- Recuse: cards iguais de ícone + título + texto como estrutura da página, cards dentro de cards, rótulo pequeno acima de títulos, números de seção (01/02/03) sem significado, texto com gradiente, borda lateral colorida grossa, sombra dura deslocada, emoji como ícone, círculos imitando recortes de fotografia, carrossel automático, abas com tempo.
- A aplicação compara a sequência de funções com o acervo: o esqueleto "hero → apresentação → oferta → processo → perguntas → contato" já foi usado demais.
- `copy.headline`, `subheadline`, `primaryCta` e `secondaryCta` (ou null) já escritos aqui, para a originalidade ser conferida antes do código.

## 9. Originalidade

- Você recebe a identidade resumida das demos anteriores (hero, funções das seções, fontes, paleta, proporção da imagem, título). Não repita a combinação estrutural de nenhuma: hero, esqueleto de seções, tipografia e tipo de imagem pesam mais que cor.
- Os perfis de segmento são pontos de partida, não modelos: dois negócios do mesmo nicho precisam continuar visualmente distintos. Trocar só a cor não diferencia. Se o negócio pedir algo próximo de uma demo anterior, mude pelo menos dois eixos estruturais e explique em `differentiation` o que muda em relação ao vizinho mais parecido.
