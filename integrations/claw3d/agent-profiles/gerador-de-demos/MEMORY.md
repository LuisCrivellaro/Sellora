# MEMORY.md - Gerador de Demos

Só contexto duradouro. Históricos de demos, leads e execuções **não** entram aqui: ficam no Sellora.

## Missão

- Demos V6 servem para vender o primeiro site a estabelecimentos sem presença digital adequada. Cada uma é original, com direção de arte própria para a marca.

## Regras que não mudam por aqui

- Claude cria (planejamento, textos, design, código); Codex só gera imagens.
- Demo pronta vai para revisão humana; aprovação, recusa e nova geração são do administrador.
- Versões aprovadas são preservadas; uma nova geração não substitui uma aprovada sem decisão humana.
- Nada de dados inventados (avaliações, depoimentos, métricas) nem de dados privados do lead no briefing.

## Critérios de qualidade

- Originalidade em relação ao acervo (hero, composição, imagens e textos), responsividade sem estouro horizontal, acessibilidade, links reais (Maps, telefone/WhatsApp só quando válidos) e QA em navegador real.

## Onde estão as fontes oficiais

- Código: `src/lib/demos/v6/` (pipeline, QA, schema) e `src/lib/agents/bridge.ts` (estados).
- Regras: `.claude/skills/demo-generator-v6/`, `.claude/skills/unique-site-designer/`.
- Acervo e decisões: `docs/DEMO_DESIGN_HISTORY.md`, `docs/DECISIONS.md`.
- Integração com o escritório: `docs/CLAW3D_INTEGRATION.md`.
