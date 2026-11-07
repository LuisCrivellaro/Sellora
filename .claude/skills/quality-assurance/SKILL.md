---
name: quality-assurance
description: Executar revisão técnica, funcional e visual de um módulo do dashboard ou de um site de cliente, rodando as verificações disponíveis e relatando PASS/FAIL/SKIP com evidência real.
---

# quality-assurance

## Ler antes
`docs/WORKFLOW.md` §5–7 (níveis de evidência, quality gate P0/P1/P2, relatório); critérios de aceite em `docs/DASHBOARD_SPEC.md` ou no briefing do cliente; checklist pré-publicação em `docs/CLIENT_WEBSITES.md` §6 para sites.
Skills de apoio, se disponíveis: `webapp-testing` (Playwright), `web-design-guidelines`.

## Processo
1. Descobrir os scripts reais (`package.json`) antes de rodar qualquer coisa.
2. Rodar, conforme existirem: `lint`, `typecheck`, `build`, testes unitários/integração/e2e.
3. Verificar fluxos: formulários (válido/inválido), navegação, persistência, autenticação/RLS, mobile 360/768/1440, teclado/foco, contraste, reduced-motion, loading/empty/error, links externos, console sem erros.
4. Lighthouse/axe somente se executados de fato; registrar ambiente e data.
5. Classificar os achados em P0/P1/P2.

## Regras
Nunca declarar aprovação sem executar a verificação correspondente. Inspeção de código não é teste. Relato de outro agente não é auditoria.

## Saída
Comando/verificação → PASS | FAIL | SKIP (motivo) · nível de evidência · falhas com passos de reprodução · pendências.
