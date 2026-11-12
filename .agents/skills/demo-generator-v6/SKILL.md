---
name: demo-generator-v6
description: Gera ou revisa demos V6 da Sellora (site estático próprio por estabelecimento, com index.html, styles.css, script.js opcional e assets), em etapas de análise, direção de arte, planejamento, código, revisão e testes. Use para mudar o gerador de Leads → Demos, revisar uma demo V6 ou ajustar os critérios de qualidade aplicados pelo agente.
---

# Demo Generator V6

Fonte canônica do gerador de demos da Sellora. O aplicativo lê `references/guia-de-criacao.md` a cada geração e o envia ao modelo como instruções de sistema (`src/lib/demos/v6/prompts.ts`). Mudou a regra aqui, mudou o gerador.

## Etapas reais (src/lib/demos/v6/generator.ts)

1. **Análise, direção de arte e planejamento**: uma chamada estruturada (`siteBriefSchema`) com o cadastro público e o histórico de demos do mesmo segmento. O app compara a direção com o histórico (fonte de destaque, sequência de seções, textos) e pede uma correção, se repetir.
2. **Imagens**: em paralelo com o código. Codex (assinatura ChatGPT) gera cada imagem do plano; sem gerador disponível, entra uma composição SVG gratuita da paleta. Nenhuma API paga é chamada sem configuração explícita.
3. **Implementação**: uma chamada estruturada (`siteCodeSchema`) que devolve HTML, CSS e JS completos a partir do briefing.
4. **Revisão e testes**: o app aplica pós-processamento (aviso de demonstração, contatos, caminhos), checagens estáticas e, quando há Edge/Chrome, auditoria em navegador real em 1440, 1024, 768 e 390 px com capturas. Problemas corrigíveis voltam ao modelo uma vez (esforço médio).
5. **Entrega**: os arquivos vão para um diretório imutável por id; o lead guarda só a referência e o resumo.

## Origem das regras

`references/guia-de-criacao.md` adapta, com atribuição, regras de quatro skills instaladas em `.claude/skills`:

- **Taste** (`design-taste-frontend`, leonxlnx/taste-skill, MIT): o tipo de negócio decide a página, fotografia lidera em negócios locais, uma ideia por tela, bordas iguais, sem legenda sob imagem, sem efeitos de tecnologia em comércio local.
- **Impeccable** (pbakaus/impeccable, Apache-2.0): piso de qualidade (contraste, medida, escala, espaçamento, estados, superfícies do navegador) e padrões recusados.
- **Emil Kowalski** (emilkowalski/skills, MIT): curvas, durações, resposta ao toque, movimento só em transform/opacity, movimento reduzido, ajustes de celular.
- **Humanizer** (blader/humanizer, MIT): padrões de texto de IA a evitar, aplicados em português.

O gerador não executa os scripts dessas skills (checker do Taste, CLI do Impeccable): ele roda sem ferramentas. Os critérios equivalentes que o app consegue medir estão em `src/lib/demos/v6/qa-static.ts` e `qa-browser.ts`.
