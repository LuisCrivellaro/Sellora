---
name: design-review
description: Revisar UX/UI, acessibilidade e consistência visual de telas do dashboard Sellora ou de sites de clientes antes de entregar, inspecionando páginas renderizadas e classificando achados em P0/P1/P2.
---

# design-review

## Ler antes
`docs/DESIGN_SYSTEM.md` (dashboard) ou a ficha de direção do cliente (`docs/CLIENT_WEBSITES.md` §2); `docs/FRONTEND_PLAYBOOK.md`; quality gate em `docs/WORKFLOW.md` §6.
Skills de apoio, se disponíveis: `web-design-guidelines` (conformidade), `interface-design` (dashboard), `frontend-design` (sites).

## Processo
1. Inspecionar páginas **renderizadas** (navegador/screenshot) em 360, 768 e 1440 px, não apenas código. Sem navegador, declarar que a revisão é estática.
2. Avaliar: hierarquia e foco (teste dos 5 segundos), densidade, navegação, rótulos pelo resultado, estados (hover/focus/disabled/loading/empty/error/success), formulários, teclado e foco, contraste medido, semântica, reduced-motion, coerência com a direção aprovada, sinais de "site genérico".
3. Listar primeiro os 5 problemas de maior impacto; corrigi-los se a tarefa incluir implementação.
4. Não impor gosto pessoal contra direção aprovada; separar obrigatório de sugestão.
5. Não copiar interfaces de terceiros.

## Saída
Por achado: P0/P1/P2 · evidência (screenshot, seletor, medida) · página/componente · correção · como verificar. Declarar o nível de evidência usado (`docs/WORKFLOW.md` §5).
