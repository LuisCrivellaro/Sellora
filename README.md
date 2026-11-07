# Sellora

**Sellora** é uma operação de criação de sites profissionais para estabelecimentos sem presença digital adequada. A meta inicial é fechar **a primeira venda em até 15 dias**, antes de automatizar prospecção, venda e produção.

## Objetivo da versão 0.1
Dashboard interno (uso administrativo) com CRM de leads, pipeline, histórico de contatos, tarefas de follow-up, propostas, clientes e projetos. Não é um marketplace nem uma plataforma de venda automática nesta fase.

## Público e oferta
Empresas locais de diferentes segmentos, com prioridade prática para um recorte geográfico e comercial de teste. Produtos iniciais: landing page (referência R$590), site institucional (R$990) e projeto personalizado (a partir de R$1.490). Valores são hipóteses comerciais ajustáveis. Criação cobrada uma vez; domínio, hospedagem, suporte e integrações são custos separados.

## Estratégia inicial
1. Montar 1 demonstração funcional e mais 2 conceitos claramente identificados.
2. Prospectar manualmente via pesquisa de estabelecimentos e canais comerciais públicos, respeitando privacidade e regras das plataformas.
3. Cadastrar oportunidades no CRM; registrar origem, diagnóstico, contato e próxima ação.
4. Enviar orçamento personalizado depois de revisão humana.
5. Converter lead em projeto; entregar escopo contratado e documentar aprovação.

## Stack sugerida
Next.js (App Router), TypeScript, Tailwind CSS, shadcn/ui, Lucide, Zod. Supabase (PostgreSQL + Auth) para dados reais, com RLS; Vercel para publicação. Validar versões compatíveis antes de instalar. Se faltarem credenciais, iniciar com camada de repositório mock claramente sinalizada **sem tratar dados simulados como reais**.

## Módulos do dashboard
- **Visão Geral:** KPIs derivados de dados reais e tarefas pendentes.
- **Leads:** CRUD, busca, filtros, origem, prioridade, score explicado, histórico, próximo contato.
- **Pipeline:** Novo → Qualificado → Contatado → Respondeu → Diagnóstico → Proposta → Negociação → Ganho / Perdido.
- **Atividades:** follow-up, tarefas, notas, próximos passos.
- **Propostas:** pacote, itens, escopo, condições, status e impressão/PDF.
- **Clientes/Projetos:** conversão de lead ganho, briefing, tarefas e publicação.
- **Portfólio:** peças conceito ou cases reais identificados corretamente.

## Qualidade e segurança
Aplicação autenticada; dados reais somente no backend; RLS; validação de formulários; sem chaves no Git; sem scraping agressivo; sem envios em massa; sem publicações ou cobranças automáticas. E2E nos fluxos essenciais, lint, typecheck e build antes da entrega.

## Arquivos para Claude Code
- `CLAUDE.md`: regras permanentes do agente.
- `docs/PRODUCT_CONTEXT.md`: visão, usuários, escopo e prioridades.
- `docs/DASHBOARD_SPEC.md`: especificação funcional e visual do dashboard.
- `docs/ROADMAP.md`: milestones e critérios de aceite.
- `docs/DESIGN_SYSTEM.md`: direção visual do dashboard.
- `docs/FRONTEND_PLAYBOOK.md`: princípios de UI/UX, formulários, estados, motion, scroll, acessibilidade e performance.
- `docs/CLIENT_WEBSITES.md`: produção de sites de clientes (direção criativa, storytelling, segmentos, pré-publicação, referências).
- `docs/WORKFLOW.md`: integração de novas instruções, padrão de prompts, quality gate e formato de relatório.
- `docs/SKILLS_SETUP.md`: skills locais e externas, com status verificado.
- `docs/DECISIONS.md`: registro de decisões.
- `.claude/skills/*/SKILL.md`: habilidades reutilizáveis do projeto.

O procedimento para incorporar novas instruções (antes previsto em `prompts/INTEGRATE_NEW_PROMPTS.md`) está em `docs/WORKFLOW.md` §3. O prompt de início do dashboard (`prompts/START_DASHBOARD.md`) ainda não existe; será gerado com a skill `prompt-architect` quando a implementação for autorizada.

## Rodar localmente (depois da implementação)
O Claude Code deve documentar aqui os comandos efetivamente utilizados (`npm install`, `npm run dev`, testes) e as variáveis de ambiente necessárias. Este pacote contém **contexto e skills**, não a aplicação implementada.

## Repositório
https://github.com/LuisCrivellaro/Sellora
