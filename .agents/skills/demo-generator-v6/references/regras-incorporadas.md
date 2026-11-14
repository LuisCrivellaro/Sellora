# Regras incorporadas ao gerador V6

Documentação para quem mantém o gerador (não é enviada ao modelo). Mostra de onde veio cada regra, onde ela entra no pipeline e como é verificada. As skills externas foram **lidas como referência**; nenhuma delas é executada pelo app, e nenhum script, CLI ou hook delas roda na geração.

Legenda: **P** = instrução no prompt da etapa · **C** = verificação determinística em código (com teste) · **N** = verificação no navegador real · **H** = revisão humana (sem prova automática suficiente).

## Origem

| Skill (pasta em `.claude/skills`) | Licença | O que foi aproveitado |
| --- | --- | --- |
| design-taste-frontend (leonxlnx/taste-skill) | MIT | tipo de negócio decide a página; fotografia lidera em negócio local; um hero por primeira tela; bordas iguais; sem legenda sob imagem; sem efeitos de tecnologia em comércio; uma ação principal; botões verbo + objeto; menu do celular com estado; 44 px de toque |
| impeccable (pbakaus/impeccable) | Apache-2.0 | piso de qualidade (contraste, medida 65–75ch, display ≤ 6rem, tracking, mais espaço acima do título); `text-wrap: balance/pretty`; superfícies do navegador (seleção, foco, barra de rolagem); padrões recusados (cards de ícone, eyebrow, números de seção, texto com gradiente, borda lateral grossa, sombra dura); claro/escuro pela cena de uso |
| emil-design-eng, animate, animation-performance, mobile-native (emilkowalski/skills) | MIT | só transform/opacity; ease-out forte; 150–300 ms; `:active` 0.97; nada de `scale(0)`; hover só com ponteiro fino; movimento reduzido; `100svh`; tap highlight; `touch-action` |
| humanizer (blader/humanizer) | MIT | padrões de texto de IA (contraste falso, trios forçados, travessões, frases de efeito, palavras infladas), adaptados ao português |
| web-design-guidelines / ui-ux-pro-max | (catálogo da conta) | ordem de títulos, nomes acessíveis, links externos seguros, metadados, imagens com dimensões, lazy loading |
| unique-site-designer (skill do projeto) | — | comparação com o histórico antes de criar; trocar só a cor não diferencia; eixos de comparação; imagem própria por demo; cobertura do histórico declarada |

Legenda extra: **V** = revisão de impacto visual (`src/lib/demos/v6/visual-review.ts`, critérios em `avaliacao-visual.md`). É um sinal auxiliar dado pelo próprio modelo: nota ≥ 8 não substitui o QA técnico nem a revisão humana.

## Matriz

| Regra | Onde | Como |
| --- | --- | --- |
| Não inventar fatos (anos, prêmios, avaliações, depoimentos, preços, horários, endereço, equipe, registros, condições) | núcleo, revisão | P + C (`INVENTED_FACTS` no briefing e no HTML, `<blockquote>`) + H |
| Textos proibidos e clichês de marketing | núcleo | P + C (`STOCK_PHRASES`, palavras inteiras) + H para o tom |
| Travessões em excesso | núcleo | P + C (> 3) |
| 1 ou 2 páginas; links entre páginas existentes | núcleo, implementação | P + C (página inexistente é crítico; âncora em outra página) |
| Sem telefone válido não há WhatsApp/ligação | direção, implementação | P + C (briefing) + pós-processamento |
| Decisões justificadas (hero, fotografia, movimento, celular, conversão) | direção | P + C (campos obrigatórios do schema) + H |
| Arquétipo do hero não repete as duas demos mais recentes | direção | P + C (`originalityReport`) |
| Fonte de destaque fora das quatro mais recentes e do segmento; fonte de leitura não dominante | direção | P + C |
| Esqueleto de funções de seção não recorrente | direção | P + C |
| Semelhança estrutural (hero, seções, tipografia, imagem > cor) | direção | C (`compareIdentity`, pesos calibrados) + H acima de "parecida" |
| Paleta com contraste (fundo/texto, superfície/texto, secundário, destaque) | direção | P + C (briefing e HTML) + N (contraste medido no DOM) |
| Fonte genérica como voz principal | direção | P + C |
| Duas famílias no máximo, carregadas pelo Google Fonts | implementação | P + C (famílias do link) + N (`document.fonts.check`) |
| Escala tipográfica, medida, `text-wrap` | implementação | P + H (capturas) |
| Cards de ícone como estrutura, eyebrow, números de seção, texto com gradiente | direção, implementação | P + C (grade de ícones em 2+ seções é corrigível; demais são aviso) |
| Movimento moderado por padrão (entrada do hero + revelação ao rolar + microinterações), inclusive em escritórios e clínicas; expressivo nunca em saúde/profissional | direção, segmentos, implementação | P + C (briefing recusa "expressiva" em saúde/profissional; código com plano "moderada"/"expressiva" sem `IntersectionObserver` ou entrada coreografada é corrigível) |
| Movimento só em transform/opacity/clip-path, sem `transition: all`; loop só decorativo e parado com movimento reduzido | implementação | P + C (loop sem `prefers-reduced-motion` é corrigível; com ele, aviso) + N (animações infinitas em movimento reduzido) |
| Revelação ao rolar nunca deixa conteúdo escondido | implementação, revisão | P + N (a auditoria rola a página inteira antes de medir; conteúdo ainda invisível é **bloqueante**) |
| `prefers-reduced-motion` | implementação | P + C + N (nada escondido nem animando sem fim) |
| Conteúdo visível sem JavaScript | implementação | P + C (aviso) + N (cópia sem scripts, bloqueante) |
| Hover só com ponteiro fino | implementação | P + C (aviso) |
| Foco visível | implementação | P + C (`:focus-visible`) + N (Tab real) |
| Menu do celular com `aria-expanded` funcionando por toque | implementação | P + N (toque emulado em 390 px) |
| Alvos de toque ≥ 40–44 px | implementação | P + N |
| Sem rolagem horizontal, sobreposição ou título cortado | implementação | P + N (5 larguras, cada página; caixas de linha, conteúdo não renderizado como `<details>` fechado fica de fora; rótulo com trecho do texto e posição; **bloqueante**: a demo nunca aparece aprovada com o defeito) |
| Imagem com `alt`, `width`/`height`, `object-fit`, lazy fora da primeira tela | implementação | P + C + N (distorção, ampliação) |
| Recursos externos só Google Fonts; sem script externo, iframe, formulário, rede | implementação | P + C (crítico/corrigível) + CSP da prévia |
| Botões com ação real; sem `href="#"` | implementação | P + C |
| `target="_blank"` com `rel="noopener"` | implementação | P + C |
| HTML semântico (`header`, `main`, `footer`, um h1, títulos em ordem, ids únicos, seções sem título repetido) | implementação | P + C |
| Correções sem destruir a direção | revisão | P + C (`regressions`: título, seções, fontes, páginas) |
| Especificação fotográfica completa e coerente | direção | P + C (schema, inclusive `presence`) + H (resultado da imagem) |
| Até 3 imagens por demo, cada uma com papel próprio e usada por uma seção | direção | P + C (`imageSetIssues`: papel repetido, cena quase igual, imagem sem seção) + configuração `SELLORA_DEMO_MAX_IMAGES` |
| Pessoas fictícias permitidas como ilustração; nunca apresentadas como equipe, clientes ou local reais; sem texto, logotipos, fachada identificável ou credenciais | direção, segmentos, núcleo | P (prompt do Codex com regra de `presence`) + aviso fixo de imagens ilustrativas + H |
| Momento visual de assinatura | direção | P + C (campo obrigatório `signatureMoment`) + avaliação visual (impacto da primeira tela e originalidade) |
| Sem FAQ genérico como recheio; menos seções bem resolvidas quando faltam dados | núcleo, direção | P + avaliação visual + H |
| Qualidade estética geral, hierarquia, ritmo e acabamento | avaliação visual | Revisão de impacto visual (Claude com capturas reais, 6 critérios ponderados, meta 8, até 2 rodadas de correção) + H (capturas no relatório) |
