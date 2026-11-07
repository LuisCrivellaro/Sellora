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

## Stack implementada
Next.js 16.4 (App Router) · React 19.3 · TypeScript 5.9 · Tailwind CSS 4.3 · `radix-ui` (primitivos acessíveis, estilizados no padrão shadcn) · `motion` 14 · Lucide · Zod 4 · Vitest 5. Gráficos em SVG próprio (sem biblioteca). Dados reais em **Supabase** (Auth + Postgres + RLS) via `@supabase/ssr` 0.12 e `@supabase/supabase-js` 2.119, ativados só quando as variáveis existem (ver "Modo Supabase"). Decisões em `docs/DECISIONS.md`.

## Módulos do dashboard (7 destinos)
- **Home** (`/dashboard`): evolução comercial, fontes de leads, funil, heatmap de atividades, radar de performance normalizado, pipeline por etapa e próximas ações.
- **Leads** (`/leads`): captação, origem, temperatura; CRM com busca, filtros, ordenação, seleção em lote, paginação, cadastro/edição, detalhe com score explicado, atividades e follow-ups; visão **Kanban** com arrastar e soltar e menu acessível "Mover para…"; conversão em cliente sem duplicar.
- **Clientes** (`/clientes`): evolução, segmentos, sites contratados, clientes que exigem atenção; cadastro, busca, histórico, projetos vinculados e dados comerciais.
- **Projetos** (`/projetos`): etapas por mês de início, heatmap de produção, status; checklist de tarefas (progresso = tarefas concluídas ÷ total), etapas, preview e publicação registrados.
- **Propostas** (`/propostas`): volume, valores por status, conversão; editor com pacotes, itens, desconto, prazo, revisões, validade; duplicar; status; documento imprimível/PDF pelo navegador.
- **Financeiro** (`/financeiro`): contratado × recebido; situação dos recebimentos; contratado, faturado, recebido, saldo, custos e ticket médio separados; lançamentos, recebimentos parciais, cancelamento e valores por cliente.
- **Configurações** (`/configuracoes`): perfil, animações (sistema/completas/reduzidas), densidade, pacotes e padrões comerciais, status real das integrações, exportar/restaurar/limpar dados.

Busca global: **Ctrl/⌘ + K**. Detalhes têm deep link (`?id=`).

## Modo demonstração (importante)
Sem Supabase configurado, os dados ficam **apenas no `localStorage` deste navegador** (chave `sellora.db.v1`): não há backup, sincronização nem login. Os registros iniciais são **fictícios** e o header mostra o selo **Demonstração**. Em Configurações › Sistema é possível exportar JSON, restaurar a demonstração ou **começar do zero** (o selo passa a "Dados locais"). Nenhum envio de mensagem, pagamento, publicação ou integração é simulado.

## Modo Supabase (dados reais)
Com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local`, o painel exige login em `/entrar` (e-mail e senha) e grava no Postgres com RLS. Cada operação atualiza a tela na hora e envia ao servidor só o que mudou, numa transação (função `apply_changes`), depois de validar com Zod. Um aviso "Salvando…" aparece durante a gravação. Se ela falhar, uma faixa oferece **Tentar novamente** ou **Descartar**: nada se perde em silêncio. Dados de demonstração nunca vão ao banco. Em Configurações › Sistema há **Importar dados locais (JSON)**, que aceita só exports com dados reais e pede confirmação.

Configuração (uma vez):
1. Crie o projeto no Supabase e copie a URL e a chave anon/publishable para `.env.local` (modelo em `.env.example`). **Nunca** use a `service_role` no app.
2. Rode a migration `supabase/migrations/20261107120000_initial_schema.sql` no SQL Editor do painel. Alternativa: `npx supabase link` + `npx supabase db push`.
3. Em Authentication › Providers › Email, desligue **Allow new users to sign up**. Crie os usuários em Authentication › Users.
4. Opcional: o teste de RLS com dois usuários de teste é `node --env-file=.env.local scripts/rls-check.mjs` (variáveis no cabeçalho do script).

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
- `docs/HANDOFF.md`: estado atual, pendências e missão do próximo passo (para retomar o trabalho em outra sessão ou conta).
- `.claude/skills/*/SKILL.md`: habilidades reutilizáveis do projeto.

O procedimento para incorporar novas instruções (antes previsto em `prompts/INTEGRATE_NEW_PROMPTS.md`) está em `docs/WORKFLOW.md` §3. O prompt de início do dashboard (`prompts/START_DASHBOARD.md`) ainda não existe; será gerado com a skill `prompt-architect` quando a implementação for autorizada.

## Rodar localmente
Requisitos verificados: Node 24.15 e npm 11.12 (Windows). Nenhuma variável de ambiente é necessária no modo demonstração. As variáveis do Supabase são lidas no build e no `dev`: reinicie o servidor depois de alterá-las.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run test       # Vitest: métricas, schemas, repositório, diff/mapeadores, validação do servidor, fila do modo Supabase
npm run build
```

## Estrutura
```
src/app/                 rotas (7 páginas) + layout + tokens (globals.css)
src/components/shell/    AppShell, navegação em pill, busca global, notificações, menu do usuário
src/components/ui/       card, botão, campos, select, modal/sheet, popover, menu, tabela, estados, toast
src/components/charts/   linha neon, barras, empilhadas, segmentada, heatmap, donut, radar (SVG)
src/components/<módulo>/ formulários e detalhes de leads, clientes, projetos, propostas, financeiro
src/components/views/    composição de cada página
src/lib/data/            semente demo, store (local | Supabase), repositório, diff, mapeadores, validação e server actions
src/lib/supabase/        configuração e cliente de servidor
src/lib/auth/            login/logout (server actions)
src/proxy.ts             proteção de rotas e renovação de sessão
supabase/migrations/     esquema, FKs, índices, RLS e função apply_changes
scripts/rls-check.mjs    teste de RLS contra o projeto real (dois usuários)
src/lib/metrics/         regras de cálculo (testadas)
src/lib/schemas.ts       validação Zod
```

## Repositório
https://github.com/LuisCrivellaro/Sellora
