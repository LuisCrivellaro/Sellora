# Sellora

## Aplicativo para Windows

O executável portátil é gerado em `release/Sellora-0.1.0-Windows-x64.exe`. Abra por duplo clique; não exige Node.js nem servidor iniciado no terminal. Versão para Windows x64, com Electron 45.3 e servidor Next embutido. O pacote local não inclui arquivos `.env`. A pesquisa OSM continua exigindo internet. O WhatsApp abre no navegador padrão; o envio continua manual. As demos continuam com links locais: compartilhar com leads exige uma hospedagem pública.

Os dados ficam no perfil local do aplicativo, separados do Opera e de outros navegadores; não sincronizam automaticamente. Use Configurações → exportar/restaurar JSON para transferir seus registros e manter backup. O executável pode ser movido, mas os dados permanecem no perfil do Windows. A porta local 3187 é fixa para preservar a origem do armazenamento; o servidor aceita apenas 127.0.0.1 e encerra com o aplicativo. Porta ocupada produz aviso em vez de abrir um serviço desconhecido. Uma segunda abertura traz a janela existente para frente.

Para gerar novamente: `npm ci` e `npm run desktop:build`. Para executar o pacote web preparado durante desenvolvimento: `npm run desktop:start` depois do build desktop. `release/` e `.desktop-web/` são artefatos ignorados. O build desktop habilita standalone apenas nessa execução, preservando os comandos web atuais. O aplicativo não tem assinatura digital comercial; o Windows pode exibir aviso de editor desconhecido. Não há atualização automática.

Validação: 112 testes, lint e compilação; teste do executável empacotado com abertura, executor OSM ativo, geração de demo, fechamento/reabertura com persistência e prévia incorporada. Dependências de produção sem vulnerabilidades no npm audit desta entrega. Não houve contato com leads durante os testes.

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
- **Financeiro** (`/financeiro`): todos os números saem de lançamentos e pagamentos registrados (localStorage no modo demonstração, Postgres com RLS no modo Supabase); nada é estimado. Receita contratada = contratos (projetos) não cancelados; recebimentos = só pagamentos registrados; pendentes separados em a vencer, vencidos e parciais; entradas/saídas pela data do pagamento no período (7D/30D/90D/1A). **Saldo de caixa** só aparece quando o saldo inicial é informado ("Informar saldo inicial"); sem ele a tela mostra "Movimentação líquida registrada". Comparações só com base anterior ("Sem comparação disponível"). Registrar recebimento (parcela ou avulso, forma de pagamento) e despesa (categoria, paga/a pagar), detalhes, correção com revisão, estorno com motivo, cancelamento de lançamento sem pagamento e cancelamento de contrato — tudo fica no histórico, nada é apagado.
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
2. Rode as migrations de `supabase/migrations/` em ordem no SQL Editor do painel (`20261107120000_initial_schema.sql`, `20261109120000_lead_source_prospeccao_ia.sql` `20261110120000_sellora2_stages_status_scope.sql`, `20261111174117_lead_demos_approval.sql` e `20261111220000_finance_production.sql`). A terceira só amplia listas aceitas e acrescenta a coluna de escopo; sem ela o banco recusa os status e etapas novos. A última (Financeiro) é aditiva: forma de pagamento, categoria, observações, cancelamento de contrato e um gatilho que impede pagamentos acima do valor do lançamento; o cabeçalho do arquivo traz o SQL para reverter. Faça backup (Configurações › Exportar) antes de aplicar. Alternativa: `npx supabase link` + `npx supabase db push`.
3. Em Authentication › Providers › Email, desligue **Allow new users to sign up**. Crie os usuários em Authentication › Users.
4. Opcional: o teste de RLS com dois usuários de teste é `node --env-file=.env.local scripts/rls-check.mjs` (variáveis no cabeçalho do script).

## Prospecção IA (aba em Leads)
Encontra estabelecimentos por cidade/UF, segmento, raio (5/10/20/50 km), quantidade (10/20/50/100) e tipo de oportunidade (sem site, site desatualizado, só redes sociais, todas). Implementa no servidor o fluxo da skill `local-client-prospector` (`.claude/skills/local-client-prospector/`): **pesquisa → verificação de presença digital → classificação** HOT/WARM/LOW/SKIP com score 0–100 justificado (critérios no `SKILL.md` e em `src/lib/prospecting/classify.ts`).

- **Executor real, sem custo:** OpenStreetMap (lista oficial do IBGE para localizar a cidade, com Nominatim só como reserva; Overpass para os estabelecimentos) + conferência HTTP de cada site encontrado (HTTPS, meta viewport, ano do rodapé, link de telefone/WhatsApp, domínio gratuito, site fora do ar). Sem chave, sem API paga, sem IA generativa. Dados © colaboradores do OpenStreetMap (ODbL).
- **Cidades:** o campo só aceita municípios oficiais do IBGE da UF escolhida (5.571 municípios em 27 UFs, `src/lib/prospecting/municipios.json`, gerado por `scripts/build-municipios.mjs`). A coordenada da sede vem dessa lista, então a etapa "localizar a cidade" não depende de busca por nome. Cidade na UF errada mostra a UF certa e um botão para trocar; o servidor repete a validação.
- **Servidores sobrecarregados:** a busca de estabelecimentos alterna entre servidores Overpass públicos (até 6 tentativas com espera crescente, dentro do limite da pesquisa) antes de informar falha.
- **Ativar:** `PROSPECCAO_EXECUTOR=osm` em `.env.local` e reiniciar o servidor. Sem isso a aba mostra "Integração não configurada" e nada é executado ou simulado.
- **Usar:** Leads → aba **Prospecção IA** → preencher o formulário → **Buscar oportunidades**. O progresso aparece em "Execução" (fase, candidatos, analisados, avisos, **Cancelar**). Resultados na tabela (busca, filtros por temperatura/segmento/situação, ordenação, paginação, seleção múltipla, exportação CSV/JSON) e no painel lateral (diagnóstico, problemas, score, evidências verificado/declarado/não verificado, fontes, sugestão de pacote).
- **Importar:** "Adicionar ao CRM" (no painel ou em lote). Confere duplicidade por nome+cidade, telefone, site e Instagram; o que já existe nunca é sobrescrito. O lead entra em **Novo**, origem **Prospecção IA**, prioridade pela classe, diagnóstico nas observações e uma nota na timeline. Funciona no modo demonstração e no modo Supabase (mesmo repositório e validação).
- **Modo Supabase:** rode também `supabase/migrations/20261109120000_lead_source_prospeccao_ia.sql` (amplia a origem aceita). Sem ela a gravação do lead importado é recusada pelo banco e a faixa de erro oferece tentar de novo/descartar.
- **Limites:** 1 pesquisa ativa por usuário, 2 no servidor, 10 por hora, 5 min por pesquisa, até 150 sites conferidos por pesquisa, Nominatim a 1 req/s. Rotas `/api/prospeccao/*` exigem login no modo Supabase e só atendem `localhost` no modo demonstração.
- **Onde ficam os dados:** histórico de pesquisas e resultados no `localStorage` deste navegador (por conta); jobs no servidor só em memória por 1 h. Leads importados vão para o CRM (localStorage ou Postgres, conforme o modo).
- **Limitações honestas:** a cobertura do OpenStreetMap varia (cidades menores trazem poucos resultados); "sem site" significa que a fonte não registra site — a ausência não é confirmada por busca na web (marcada como **não verificada**); Instagram não é aberto (exige login); layout, velocidade e conteúdo do site não são avaliados visualmente (use a skill `website-audit`). Nenhuma mensagem é enviada.

## Demos e mensagens para aprovação

Em **Leads → Prospecção IA**, **Buscar e gerar demos** pesquisa e prepara demos/mensagens de HOT/WARM não descartados. Importa os qualificados ao CRM, ignora ganhos/perdidos e reaproveita demos existentes sem sobrescrever o cadastro. A quantidade limita resultados da busca, não garante o número de qualificados. Desmarque **Preparar demos e mensagens para aprovação** para apenas pesquisar. Também é possível gerar pelos resultados selecionados/filtrados ou pela ficha de um lead.

A aba **Leads → Demos** (`/leads?aba=demos`) mostra um cartão por negócio, com miniatura, nome, cidade, status e trecho da mensagem. A mesma fila aparece na Prospecção IA. Abra o cartão para ver **a demo de um lado e a mensagem do outro** (empilhadas no celular), com alternância de prévia Computador/Celular. Revise, salve alterações, confirme a conferência e aprove. Filtros: Para aprovar, Aprovadas, Envios, Todas e Recusadas; busca por nome, cidade e telefone.

**Recusar demo** (botão vermelho no cartão, com confirmação) muda só o estado daquela demo para recusada: ela sai das demais filas, perde a aprovação e não pode ser aprovada, editada, copiada, aberta no WhatsApp nem marcada como enviada até ser restaurada. Lead, mensagem, envio declarado e histórico ficam; uma nota no CRM registra quem recusou e quando. Em **Recusadas**, abra o cartão para ver a demo, o histórico e **Restaurar para aguardando aprovação** (exige nova aprovação). Reimportar o mesmo estabelecimento não desfaz a recusa.

Depois de aprovar, **Abrir no WhatsApp** usa o recurso oficial [clique para conversa](https://faq.whatsapp.com/5913398998672934) para abrir o destinatário com texto e link preenchidos. Sem API paga, automação de navegador ou disparo; você precisa apertar Enviar no WhatsApp. Telefones brasileiros recebem DDI 55 se ausente; outros países exigem +DDI explícito. Telefone ausente/inválido desabilita a abertura. O Sellora não verifica se o número tem WhatsApp. Use com destinatários que autorizaram o contato. A opção de copiar a mensagem continua disponível.

**Já enviei → Confirmar envio manual** é uma declaração do operador, não confirmação de entrega. Só essa ação atualiza o último contato, registra atividade WhatsApp e move Novo/Qualificado para Contatado; demais etapas são preservadas. Abrir o WhatsApp não grava contato. A mesma versão para o mesmo número não gera registros repetidos. O histórico guarda a última mensagem declarada (texto, destinatário, data e revisor); alterações posteriores preservam esse registro. O indicador diário conta leads distintos com envio declarado no fuso America/Sao_Paulo, com referência de 10 contatos/dia, sem agendamento ou garantia de entrega.

A aprovação guarda data e identificação da conta/perfil atual, sem papel separado de aprovador. Editar e salvar o texto revoga a aprovação. Demos novas usam o visual v3; links v1 e v2 continuam com o visual em que foram revisados. **Atualizar visual da demo** conserva o cadastro/snapshot e o histórico, muda para v3 e exige nova aprovação.

**v3: uma demo diferente por estabelecimento, sem IA.** O tipo do negócio sai do nome ("Barbearia", "Spa", "Cabeleireira", "Pizzaria"…) ou, sem pista no nome, da categoria do OpenStreetMap guardada na demo; por fim, do segmento. São 26 tipos em [src/lib/demos/kinds.ts](src/lib/demos/kinds.ts) (barbearia, salão, estética/spa, massagem, unhas, tatuagem, restaurante, café/padaria, lanchonete, bar, clínica, odontologia, veterinária, terapias, academia, oficina, pet shop, escritório, escola, reparos, moda, casa, eletrônicos…), cada um com títulos, textos, seções, tipografia, foto adequada (ou nenhuma) e três paletas. Um hash do nome + cidade escolhe paleta, título e layout (foto ao lado, foto em destaque ou tipográfico com monograma), então dois salões da mesma cidade saem diferentes, e a mesma empresa sempre recebe a mesma demo. Tipos sem fotografia licenciada adequada usam o layout tipográfico em vez de uma foto de outro ramo. A mensagem cita o tipo ("o site da barbearia de vocês"). Para ajustar textos ou paletas, edite `kinds.ts`; os testes em `kinds.test.ts` conferem a detecção e a variação. Nenhuma mensagem é enviada pelo Sellora.

Modelos React/CSS para restaurantes, beleza, saúde, serviços, comércio e outros, sem IA generativa, API paga ou publicação automática. A v2 usa seis direções visuais, hierarquias e composições por segmento, com fotografias de referência locais licenciadas (fontes em [public/demos/ASSETS.md](public/demos/ASSETS.md)). São conceitos por segmento, não sites sob medida já validados com cada empresa. Usam nome, segmento, cidade/UF e telefone disponível, com **Demonstração não oficial**. Fotografias são identificadas como ilustrativas; serviços, preços, avaliações e credenciais não são inventados. A demo guarda um snapshot do cadastro; alterações posteriores no lead não alteram a prévia revisada.

O link `/demo#…` contém só esse snapshot comercial validado, sem notas, e-mail ou score. Abre em outro navegador sem depender do localStorage do autor. O fragmento não é um segredo, não é autenticado e não é revogável. O renderizador é público, não indexável e não consulta o CRM; as demais rotas continuam protegidas no modo Supabase. **Localhost/IP privado serve para testes na máquina/rede**. Para envio externo, hospede o Sellora em um endereço público e abra esse endereço para copiar o link. Nenhum deploy foi feito nesta implementação.

No modo local, demos/aprovações acompanham o lead no localStorage e no JSON exportado. No modo Supabase, aplique antes `supabase/migrations/20261111174117_lead_demos_approval.sql` (JSONB nullable em `leads.demo`, herda o RLS). Todas as migrations foram executadas em Postgres local via PGlite, com gravação/leitura e limites JSONB verificados; não houve acesso, aplicação ou validação em projeto remoto nesta sessão. Histórico de pesquisas permanece neste navegador. Pesquisas ativas retomam ao reabrir a aba; o preparo ocorre quando o navegador recebe o resultado concluído. Não há agendador nem worker independente do navegador.

Validação em 2026-11-11: testes unitários de geração/idempotência, qualificação, aprovação/edição, mapeamento/validação, conclusão de pesquisas e isolamento da rota pública; navegador isolado com geração manual, aprovação/cópia/edição, recarga e fluxo de pesquisa com resposta controlada; prévia independente em outro contexto, layouts 320/375/768/1024/1440 px. Consulta real Campinas/SP, beleza, 5 km, até 10 resultados: concluída com 10 oportunidades após uma falha inicial HTTP 502 do Overpass. Nenhuma mensagem enviada.

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
