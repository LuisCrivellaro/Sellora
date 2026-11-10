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
- **Home** (`/dashboard`): quatro KPIs por período (leads, contatos, propostas e vendas), evolução comercial e fontes de leads em composição 65/35; tabela de atividades recentes com busca, filtros, ordenação, paginação e acesso ao CRM. Radar de performance, pipeline e próximas ações ficam em análises complementares. Períodos 7D/30D/90D/1A atualizam os KPIs, gráfico, fontes e movimentações; comparações usam o intervalo anterior equivalente, sem percentual quando a base é zero. Vendas usam o histórico de ganho ou a aprovação de uma proposta vinculada, uma vez por lead; ganhos sem data ficam fora da contagem por período, explicados no tooltip.
- **Leads** (`/leads`): captação, origem, temperatura; CRM com busca, filtros, ordenação, seleção em lote, paginação, cadastro/edição, detalhe com score explicado, atividades e follow-ups; visão **Kanban** com arrastar e soltar e menu acessível "Mover para…"; **Importar CSV** (modelo da skill de prospecção ou planilha com nome/cidade, sem duplicar); mover para Ganho cria ou vincula o cliente sem duplicar. Aba **Prospecção IA** (`/leads?aba=prospeccao`): ver seção abaixo.
- **Clientes** (`/clientes`): evolução, segmentos, sites contratados, clientes que exigem atenção; cadastro, busca, histórico, projetos vinculados e dados comerciais.
- **Projetos** (`/projetos`): nove etapas (Briefing pendente, Briefing recebido, Planejamento, Design, Desenvolvimento, Revisão, Aprovação, Publicação, Entregue), heatmap de produção, status; checklist de tarefas (progresso = tarefas concluídas ÷ total), preview e publicação registrados.
- **Propostas** (`/propostas`): volume, valores por status, conversão; editor com pacotes, itens, escopo, desconto, prazo, revisões, validade; duplicar; sete status (Rascunho, Pronta, Enviada, Em negociação, Aprovada, Recusada, Expirada); documento imprimível/PDF pelo navegador; **Fechar venda** cria cliente, projeto e parcelas a receber de uma vez.
- **Financeiro** (`/financeiro`): contratado × recebido; situação dos recebimentos; contratado, faturado, recebido, saldo, custos e ticket médio separados; lançamentos, recebimentos parciais, cancelamento e valores por cliente.
- **Configurações** (`/configuracoes`): perfil, animações (sistema/completas/reduzidas), densidade, pacotes e padrões comerciais (validade, follow-up, condições de pagamento, entrada %, revisões), status real das integrações, exportar/restaurar/limpar dados.

### Fluxo comercial completo
Lead (cadastro manual, Prospecção IA ou CSV) → qualificação no funil → **Criar proposta** na ficha do lead → status Enviada/Em negociação (o lead acompanha no funil) → **Fechar venda** na proposta → cliente + projeto + parcelas (entrada e saldo) → **Registrar recebimento** no Financeiro → indicadores da Home. Parcelas são contas a receber: só o recebimento registrado entra no caixa. Nada é enviado nem cobrado automaticamente.

Busca global: **Ctrl/⌘ + K**. Detalhes têm deep link (`?id=`).

Navegação compartilhada em **sidebar BranchedMenu**: Visão geral, Comercial e Gestão. Fixa no desktop (264px), recolhível no tablet (76px/264px) e drawer lateral no celular, com overlay, Escape e foco contido. O header preserva busca, notificações, configurações rápidas e perfil; o item ativo acompanha a URL, refresh e histórico.

Tema **Premium Monochrome Dark**: estrutura em preto/grafite/cinza. Dashboards comerciais usam vermelho sofisticado e azul-aço, centralizados em `src/lib/visualization.ts`. Sucesso/concluído continua verde, atenção âmbar e atraso/erro vermelho de alerta. O Financeiro conserva integralmente sua paleta, com positivos verdes, negativos vermelhos e zero neutro. Layout e animações são mantidos.

## Modo demonstração (importante)
Sem Supabase configurado, os dados ficam **apenas no `localStorage` deste navegador** (chave `sellora.db.v1`): não há backup, sincronização nem login. Os registros iniciais são **fictícios**, identificados nas informações de modo do perfil, rodapé e Configurações. O selo foi removido da sidebar e do drawer. Em Configurações › Sistema é possível exportar JSON, restaurar a demonstração ou **começar do zero** (o selo passa a "Dados locais"). Nenhum envio de mensagem, pagamento, publicação ou integração é simulado.

## Modo Supabase (dados reais)
Com `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local`, o painel exige login em `/entrar` (e-mail e senha) e grava no Postgres com RLS. Cada operação atualiza a tela na hora e envia ao servidor só o que mudou, numa transação (função `apply_changes`), depois de validar com Zod. Um aviso "Salvando…" aparece durante a gravação. Se ela falhar, uma faixa oferece **Tentar novamente** ou **Descartar**: nada se perde em silêncio. Dados de demonstração nunca vão ao banco. Em Configurações › Sistema há **Importar dados locais (JSON)**, que aceita só exports com dados reais e pede confirmação.

Configuração (uma vez):
1. Crie o projeto no Supabase e copie a URL e a chave anon/publishable para `.env.local` (modelo em `.env.example`). **Nunca** use a `service_role` no app.
2. Rode as migrations de `supabase/migrations/` em ordem no SQL Editor do painel (`20261107120000_initial_schema.sql`, `20261109120000_lead_source_prospeccao_ia.sql` e `20261110120000_sellora2_stages_status_scope.sql`). A terceira só amplia listas aceitas e acrescenta a coluna de escopo; sem ela o banco recusa os status e etapas novos. Alternativa: `npx supabase link` + `npx supabase db push`.
3. Em Authentication › Providers › Email, desligue **Allow new users to sign up**. Crie os usuários em Authentication › Users.
4. Opcional: o teste de RLS com dois usuários de teste é `node --env-file=.env.local scripts/rls-check.mjs` (variáveis no cabeçalho do script).

## Prospecção IA (aba em Leads)
Encontra estabelecimentos por cidade/UF, segmento, raio (5/10/20/50 km), quantidade (10/20/50/100) e tipo de oportunidade (sem site, site desatualizado, só redes sociais, todas). Implementa no servidor o fluxo da skill `local-client-prospector` (`.claude/skills/local-client-prospector/`): **pesquisa → verificação de presença digital → classificação** HOT/WARM/LOW/SKIP com score 0–100 justificado (critérios no `SKILL.md` e em `src/lib/prospecting/classify.ts`).

- **Executor real, sem custo:** OpenStreetMap (Nominatim para a cidade, Overpass para os estabelecimentos) + conferência HTTP de cada site encontrado (HTTPS, meta viewport, ano do rodapé, link de telefone/WhatsApp, domínio gratuito, site fora do ar). Sem chave, sem API paga, sem IA generativa. Dados © colaboradores do OpenStreetMap (ODbL).
- **Ativar:** `PROSPECCAO_EXECUTOR=osm` em `.env.local` e reiniciar o servidor. Sem isso a aba mostra "Integração não configurada" e nada é executado ou simulado.
- **Usar:** Leads → aba **Prospecção IA** → preencher o formulário → **Buscar oportunidades**. O progresso aparece em "Execução" (fase, candidatos, analisados, avisos, **Cancelar**). Resultados na tabela (busca, filtros por temperatura/segmento/situação, ordenação, paginação, seleção múltipla, exportação CSV/JSON) e no painel lateral (diagnóstico, problemas, score, evidências verificado/declarado/não verificado, fontes, sugestão de pacote).
- **Importar:** "Adicionar ao CRM" (no painel ou em lote). Confere duplicidade por nome+cidade, telefone, site e Instagram; o que já existe nunca é sobrescrito. O lead entra em **Novo**, origem **Prospecção IA**, prioridade pela classe, diagnóstico nas observações e uma nota na timeline. Funciona no modo demonstração e no modo Supabase (mesmo repositório e validação).
- **Modo Supabase:** rode também `supabase/migrations/20261109120000_lead_source_prospeccao_ia.sql` (amplia a origem aceita). Sem ela a gravação do lead importado é recusada pelo banco e a faixa de erro oferece tentar de novo/descartar.
- **Limites:** 1 pesquisa ativa por usuário, 2 no servidor, 10 por hora, 5 min por pesquisa, até 150 sites conferidos por pesquisa, Nominatim a 1 req/s. Rotas `/api/prospeccao/*` exigem login no modo Supabase e só atendem `localhost` no modo demonstração.
- **Onde ficam os dados:** histórico de pesquisas e resultados no `localStorage` deste navegador (por conta); jobs no servidor só em memória por 1 h. Leads importados vão para o CRM (localStorage ou Postgres, conforme o modo).
- **Limitações honestas:** a cobertura do OpenStreetMap varia (cidades menores trazem poucos resultados); "sem site" significa que a fonte não registra site — a ausência não é confirmada por busca na web (marcada como **não verificada**); Instagram não é aberto (exige login); layout, velocidade e conteúdo do site não são avaliados visualmente (use a skill `website-audit`). Nenhuma mensagem é enviada.

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
- `docs/AI_HANDOFF.md`: **estado atual da Sellora 2.0**, o que foi testado, pendências e próximos passos (ler primeiro ao retomar em outra sessão ou conta).
- `docs/HANDOFF.md`: histórico da missão anterior (Supabase).
- `.claude/skills/*/SKILL.md`: habilidades reutilizáveis do projeto.

O procedimento para incorporar novas instruções (antes previsto em `prompts/INTEGRATE_NEW_PROMPTS.md`) está em `docs/WORKFLOW.md` §3. O prompt de início do dashboard (`prompts/START_DASHBOARD.md`) ainda não existe; será gerado com a skill `prompt-architect` quando a implementação for autorizada.

## Rodar localmente
Requisitos verificados: Node 24.15 e npm 11.12 (Windows). Nenhuma variável de ambiente é necessária no modo demonstração. As variáveis do Supabase são lidas no build e no `dev`: reinicie o servidor depois de alterá-las.

```bash
npm install
npm run dev        # http://localhost:3000
npm run lint
npm run typecheck
npm run test       # Vitest: métricas, schemas, repositório, fluxo de venda, CSV, diff/mapeadores, validação do servidor, fila do modo Supabase, prospecção
npm run build
```

## Estrutura
```
src/app/                 rotas (7 páginas) + layout + tokens (globals.css)
src/components/shell/    AppShell, sidebar BranchedMenu, busca global, notificações, menu do usuário
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
src/lib/prospecting/     Prospecção IA: catálogo, classificação/score, OpenStreetMap, conferência HTTP segura, jobs, ponte para o CRM
src/app/api/prospeccao/  rotas status, jobs (POST) e jobs/[id] (GET/DELETE)
src/components/prospecting/ aba Prospecção IA (formulário, execução, tabela, painel)
src/lib/metrics/         regras de cálculo (testadas)
src/lib/schemas.ts       validação Zod
```

## Repositório
https://github.com/LuisCrivellaro/Sellora
