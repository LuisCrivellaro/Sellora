---
name: demo-generator-v6
description: Gera ou revisa demos V6 da Sellora (site estático próprio por estabelecimento, uma ou duas páginas, styles.css, script.js opcional e até três imagens), em etapas de análise comercial, direção de arte, originalidade, planejamento, código, QA, revisão de impacto visual e correção. Use para mudar o gerador de Leads → Demos, revisar uma demo V6 ou ajustar os critérios de qualidade aplicados automaticamente.
---

# Demo Generator V6

Fonte de verdade das regras do gerador de demos da Sellora. A pasta canônica é `.agents/skills/demo-generator-v6/`; `.claude/skills/demo-generator-v6/` é um espelho idêntico (um teste compara os dois) e o `desktop/build.mjs` empacota a canônica no executável Windows. Mudou a regra aqui, mudou o gerador: o app relê as referências a cada geração (`src/lib/demos/v6/prompts.ts`).

O gerador funciona sozinho depois do clique em **Gerar demo**. Ele não chama skills interativas (`/impeccable`, `/humanizer`, `/review-animations`…): as regras úteis dessas skills foram incorporadas às referências abaixo e, quando dá para medir, viraram verificações em código. Ver `references/regras-incorporadas.md`.

## Quem faz o quê

- **Claude** (conta dedicada às demos ou perfil padrão, sem ferramentas): análise, direção de arte, textos, especificação fotográfica, HTML/CSS/JS, correções e avaliação das capturas (revisão de impacto visual).
- **Codex** (conta ChatGPT do computador): só as imagens (até três por demo), a partir das especificações fotográficas do Claude. Sem Codex, entra uma composição SVG gratuita e a demo fica **pendente de revisão**.
- **Aplicação**: validação, originalidade, pós-processamento (contatos, aviso de demonstração), QA estático e em navegador real, correções direcionadas, gravação imutável e relatório.

## Referências e quando cada uma é enviada

| Arquivo | Etapa | Vai para |
| --- | --- | --- |
| `references/guia-de-criacao.md` | todas | instrução de sistema (verdade, papéis, limite de páginas, texto) |
| `references/direcao-de-arte.md` | briefing (etapas 2–5) | pedido do briefing |
| `references/segmentos.md` | briefing | só o perfil do segmento detectado (`## perfil: <id>`) |
| `references/implementacao.md` | produção (etapa 6) | pedido do código |
| `references/revisao.md` | correções (etapas 9 e 10b) | pedido de correção técnica e visual |
| `references/avaliacao-visual.md` | revisão de impacto visual (etapa 10b) | pedido de avaliação, junto com as capturas |
| `references/regras-incorporadas.md` | — | documentação (não vai ao modelo) |

## Etapas reais (`src/lib/demos/v6/generator.ts`)

1. **Validação do cadastro**: nome, cidade e UF obrigatórios; telefone só conta se vira link válido; categoria ausente fica registrada.
2–5. **Análise, direção de arte, originalidade e planejamento**: uma chamada estruturada (`siteBriefSchemaFor`) com decisões justificadas, uma ou duas páginas, seções com função, textos-chave e especificação fotográfica. A aplicação confere estrutura, contraste, textos proibidos e a identidade visual contra o histórico (`identity.ts`) e pede até **duas** revisões, **revalidando depois de cada uma**. O que persistir vai para a revisão humana.
6. **Produção**: Claude escreve o código enquanto o Codex gera as imagens planejadas (até três, cada uma com papel próprio; recortadas para a proporção planejada e convertidas para WebP).
7. **Validação estrutural** (`qa-static.ts`): HTML, links entre páginas, arquivos, recursos externos, textos genéricos, fatos não confirmados, tipografia carregada, movimento, contraste da paleta, botões sem ação.
8. **QA em navegador real** (`qa-browser.ts`): 1440, 1024, 768, 390 e 360 px em cada página, depois de rolar a página inteira (revelações ao rolar disparadas); rolagem horizontal, sobreposição, títulos cortados, conteúdo que continua invisível, imagens quebradas/distorcidas, contraste medido, alvos de toque, menu do celular por toque, foco do teclado com Tab, página sem JavaScript, movimento reduzido, fontes carregadas, erros de JavaScript.
9–10. **Correções direcionadas e revalidação**: até duas rodadas com só os problemas medidos, bloqueantes primeiro; correções que trocam título, fontes, seções ou páginas são descartadas, e a melhor versão é preservada.
10b. **Revisão de impacto visual** (`visual-review.ts`): o Claude avalia as capturas reais em seis critérios ponderados (meta 8/10); abaixo da meta, até duas rodadas (`SELLORA_DEMO_VISUAL_REVIEW_ROUNDS`) de correção direcionada → QA técnico completo → reavaliação; só entra a versão que melhora a nota sem criar problema técnico. Imagens nunca são regeradas aqui. Sem capturas ou sem avaliador: `visual_review_unavailable`, sem nota inventada.
11. **Entrega**: arquivos imutáveis por id, capturas, `qa.json` (com `blocking` e `visual`), `visual-review.json` e `diagnostics.json` (tentativas, rodadas, problemas restantes, geradores, originalidade, revisão visual com chamadas e custo separados, duração).

Críticos impedem a entrega (falha recuperável com checkpoint, até três tentativas). Corrigíveis não resolvidos (os **bloqueantes**, como sobreposição e corte de texto, ficam listados à parte), originalidade pendente, imagem substituída ou impacto visual abaixo da meta resultam em **pendente de revisão**, nunca em sucesso genérico: os arquivos e o histórico ficam salvos.

## Ao mudar o gerador

- Mantenha as duas pastas idênticas e rode `npx vitest run src/lib/demos/v6`.
- Regra nova que dá para medir: implemente a verificação e um teste com fixture (sem gerar demos reais). Regra subjetiva: escreva na referência da etapa e registre em `regras-incorporadas.md` como revisão humana.
- Não acrescente bibliotecas ao site gerado e não amplie os recursos externos permitidos. O limite de imagens é 3 (padrão) e só diminui por configuração (`SELLORA_DEMO_MAX_IMAGES` de 1 a 3); a revisão visual vai de 0 (desligada) a 3 rodadas (`SELLORA_DEMO_VISUAL_REVIEW_ROUNDS`, padrão 2).
