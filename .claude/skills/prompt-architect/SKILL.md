---
name: prompt-architect
description: Escrever, consolidar ou revisar prompts para agentes de desenvolvimento (Claude Code, Lovable, outros) no padrão Sellora — missão, contexto confirmado, escopo, intocáveis, requisitos, plano, testes, critérios de aceite e relatório. Usar quando o usuário pedir um prompt, um prompt mestre ou a consolidação de correções acumuladas.
---

# prompt-architect

## Ler antes
`docs/WORKFLOW.md` §2–4 (classificação da informação, integração e acúmulo de correções, estrutura do prompt), `CLAUDE.md` e os docs da área do prompt (ex.: `docs/DASHBOARD_SPEC.md`, `docs/CLIENT_WEBSITES.md`).

## Processo
1. Identificar o tipo de missão e o agente-alvo (Claude Code, Lovable, outro) e adaptar ao fluxo dele.
2. Levantar o contexto **confirmado** a partir do repositório e da conversa; rotular inferências; listar o que falta.
3. Com várias correções acumuladas: deduplicar, preservar todas, resolver conflitos pela instrução mais recente e registrar a resolução.
4. Redigir nas seções de `docs/WORKFLOW.md` §4, omitindo só as não aplicáveis.
5. Escrever critérios de aceite observáveis e testes concretos; nada de adjetivos vagos.
6. Incluir travas: sem commit/push/deploy/migração destrutiva/compra sem autorização; não refazer tudo para corrigir algo pontual; relatório distinguindo solicitado/planejado/implementado/testado/pendente.
7. Selecionar do playbook só o conhecimento pertinente; não despejar o manual inteiro no prompt.

## Saída
Prompt pronto para colar, seguido de premissas inferidas, pendências e riscos. Não executar o prompt.
