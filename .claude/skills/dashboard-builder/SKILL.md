---
name: dashboard-builder
description: Construir módulos e fluxos do dashboard interno Sellora (leads, pipeline, atividades, propostas, clientes/projetos) ponta a ponta com UI autoral e funcional. Usar somente quando o usuário autorizar explicitamente a implementação de um módulo do dashboard.
---

# dashboard-builder

## Pré-condição
Pedido explícito de implementação. Sem ele, apenas planejar ou documentar.

## Ler antes
`docs/DASHBOARD_SPEC.md` (funcional), `docs/DESIGN_SYSTEM.md` (visual), `docs/FRONTEND_PLAYBOOK.md` §4–7 e §9 (componentes, forms, estados, motion, a11y), `docs/DECISIONS.md`.
Skills de apoio, se disponíveis na sessão: `interface-design` (direção de produto), `vercel-react-best-practices` (Next.js), `design-review` e `quality-assurance` ao final.

## Processo
1. Jornada antes de componentes: quem faz o quê, em qual ordem, qual a próxima ação.
2. Uma feature por vez, ponta a ponta: schema/repositório → server actions/API (validação Zod no servidor) → UI → estados → testes.
3. Dados: Supabase com RLS se houver credenciais; caso contrário, repositório demo isolado com selo **Demonstração**, sem alegar persistência.
4. UI: tokens semânticos, rótulos pelo resultado, labels persistentes, loading/empty/error/success, foco visível, 360/768/1440 px, Kanban com alternativa de teclado.
5. Motion só funcional (seção "Motion no dashboard" de `docs/DESIGN_SYSTEM.md`).
6. Verificar que **todo** CTA executa ação real.

## Não fazer
Dados fake sem rótulo; KPIs inflados por demo; gráficos cosméticos; páginas vazias com CTA falso; dependências sem registro em `docs/DECISIONS.md`.

## Saída
Relatório no formato de `docs/WORKFLOW.md` §7: arquivos alterados, comandos executados com PASS/FAIL/SKIP, limitações e próximos passos.
