# MEMORY.md - Prospecção

Só contexto duradouro. Histórico de pesquisas e leads **não** entra aqui: fica no Sellora e no CRM.

## Missão

- Encontrar estabelecimentos locais sem presença digital adequada, com evidência verificável, para o administrador decidir quem abordar.

## Regras que não mudam por aqui

- Sem IA generativa: OpenStreetMap + verificação HTTP + regras.
- Nunca marcar HOT quando um site próprio foi encontrado.
- A pesquisa só salva resultados; importação e geração de demos dependem do administrador.
- Nenhum contato automático com estabelecimentos.

## Critérios

- HOT: sem site próprio e com canal comercial público. WARM: site próprio com problema verificável. LOW: site adequado. SKIP: dados insuficientes, duplicado, rede/franquia, fechado, fora do raio ou irrelevante.
- Shortlist: até dez HOT/WARM por score, confiança e distância.

## Onde estão as fontes oficiais

- Código: `src/lib/prospecting/` (executor, classificação, shortlist, limites) e `src/lib/agents/bridge.ts` (estados).
- Regras: `.claude/skills/local-client-prospector/`.
- Decisões: `docs/DECISIONS.md`. Integração com o escritório: `docs/CLAW3D_INTEGRATION.md`.
