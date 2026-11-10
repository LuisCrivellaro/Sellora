# SELLORA 2.0 — MISSÃO PARTE 2 DE 2 (prompt de continuidade)

Você assume o desenvolvimento da Sellora no ponto exato em que outra instância de IA parou. Atue como engenheiro full-stack sênior e designer de produto. Responda sempre em português. Quero implementação, correção e testes reais, não só plano.

## 1. O que é a Sellora

Negócio que cria sites profissionais para estabelecimentos locais (restaurantes, clínicas, salões, barbearias, escritórios) sem site ou com site ruim. Meta: **primeiro cliente pagante em até 15 dias**. Pagamento único pela criação: Essencial R$ 590, Profissional R$ 990, Personalizado a partir de R$ 1.490 (editáveis), 50% de entrada e 50% na entrega. Domínio, hospedagem e manutenção são custos separados.

O repositório é o **painel interno** da operação: prospecção → CRM → proposta → cliente → projeto → financeiro.

- Repositório: `https://github.com/LuisCrivellaro/Sellora`
- Branch: `main`. A Parte 1 está no commit `1a1e380` (feat: fluxo comercial completo), seguido de um commit de documentação.
- **Esses commits podem não ter sido enviados ao GitHub** (o remoto estava em `06d1203`). Rode `git log --oneline | head -5` antes de tudo. Se `1a1e380` não aparecer e não existir `docs/AI_HANDOFF.md`, você está num clone sem a Parte 1: pare e peça ao usuário o push ou o bundle (instruções em `docs/AI_HANDOFF.md` §11 da máquina de origem).

## 2. Antes de modificar qualquer coisa

1. `pwd`, `git status --short`, `git remote -v`, `git log --oneline | head -5`. Não descarte alterações não commitadas.
2. Leia, nesta ordem: `CLAUDE.md` → `docs/AI_HANDOFF.md` (estado real, testes, pendências) → `README.md` → `docs/DECISIONS.md` (as entradas de 2026-11-10 são da Parte 1) → `docs/DESIGN_SYSTEM.md` e `docs/FRONTEND_PLAYBOOK.md` conforme a tarefa.
3. Rode a referência: `npm install` (se preciso), `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. Esperado: tudo verde, **87 testes em 8 arquivos**. Se algo falhar, conserte antes de avançar e diga o que encontrou.
4. Confira as skills disponíveis na sua sessão (variam por conta) e leia o `SKILL.md` das que for usar.

## 3. Stack real (não migrar)

Next.js 16.4 (App Router, Turbopack, `src/proxy.ts`) · React 19.3 · TypeScript 5.9 · Tailwind 4.3 · `radix-ui` · `motion` 14 · Lucide · Zod 4 · Vitest 5 · Supabase (`@supabase/ssr`, Auth + Postgres + RLS) ativado só com variáveis de ambiente. Gráficos em SVG próprio. Windows, Node 24. Dependência nova só com justificativa registrada em `docs/DECISIONS.md`.

Arquitetura que você deve respeitar:
- **Toda escrita passa por `src/lib/data/repository.ts`**, validada com os schemas de `src/lib/schemas.ts`.
- **Todo cálculo fica em `src/lib/metrics/*`** (puro e testado). Não recalcule em componentes.
- Dois modos de dados: local/demonstração (`localStorage`, chave `sellora.db.v1`) e Supabase. Nesta máquina só o modo local está ativo.
- **Nunca altere `DB_VERSION`** em `src/lib/data/seed.ts`: isso apaga os dados locais do usuário. Campos novos entram por `normalizeDatabase()` e por `.default()` em `settingsSchema` (`row-schemas.ts`).
- Mudança de banco = nova migration **aditiva** em `supabase/migrations/`, mais `mappers.ts` e `row-schemas.ts`. Nada destrutivo sem aprovação.

## 4. Decisões aprovadas (não reverter sem pedido explícito)

- Sete módulos no menu, nesta ordem, sem itens novos: Home, Leads, Clientes, Projetos, Propostas, Financeiro, Configurações. Prospecção IA é uma aba de Leads.
- Contratado ≠ faturado ≠ recebido ≠ despesa ≠ saldo. Parcela é conta a receber; só recebimento registrado é caixa.
- Dados de demonstração sempre rotulados e nunca gravados no banco real. Nenhum número, lead, avaliação ou integração inventados.
- Nada é enviado, cobrado, assinado ou publicado automaticamente. Preço final, contrato, cobrança, envio e publicação exigem aprovação humana.
- Ids antigos preservados: etapa de projeto `briefing` aparece como "Briefing pendente" e `entrega` como "Entregue".
- Commit e push só com autorização explícita do usuário. Nunca force push. Nenhum deploy sem autorização.
- **Integração com WhatsApp está proibida nesta etapa.** Não criar cliente de API, webhook, envio nem tela de configuração de WhatsApp. O tipo de atividade "WhatsApp" existente é só um registro manual e fica como está.

## 5. Primeira pergunta obrigatória ao usuário: identidade visual

Há um conflito que só o usuário resolve, e ele bloqueia o refinamento visual:

- O briefing original descreve: navegação superior em **pill**, roxo `#8866BD` e magenta `#BB6BA5` discretos, fundo `#101014`, superfícies `#1A1920`/`#24222B`, texto `#EAE8EF`/`#A6A2B0`, Financeiro com verde-menta `#67B99A`.
- O código atual, após os commits `d789002` e `b9613ba` feitos pelo usuário, usa **sidebar BranchedMenu** e tema **Premium Monochrome Dark**: preto/grafite, vermelho `#C94B55` e azul-aço `#7186A6` nos dashboards (`src/lib/visualization.ts`), Financeiro com tokens `--fin-*`.

A Parte 1 preservou o que está no código e não mexeu em tokens, shell ou paleta. **Pergunte qual identidade vale antes de alterar qualquer coisa visual.** Enquanto não houver resposta, trabalhe nos itens funcionais da §8 e não redesenhe nada.

## 6. O que a Parte 1 implementou (não reimplementar)

- **Fechar venda**: `closeSale(proposalId)` em `repository.ts`, com botão e confirmação no detalhe da proposta. Aprova a proposta, leva o lead a Ganho, cria ou vincula o cliente, abre o projeto (valor contratado = total da proposta, 12 tarefas padrão) e lança as parcelas. Uma gravação, idempotente.
- **Parcelas**: `buildInstallments()` — entrada (%) de Configurações + saldo na entrega, soma exata em centavos.
- **Lead → Ganho garante o cliente sem duplicar** (`withClientForLead`): reaproveita cliente vinculado ou com mesmo nome+cidade/telefone.
- **Funil acompanha a proposta** (`advanceLeadForProposal`): Enviada → "Proposta"; Em negociação → "Negociação"; só avança.
- **Projetos com 9 etapas** e **propostas com 7 status** (novos: Pronta, Expirada); campo **Escopo** na proposta, no documento imprimível e nas observações do projeto.
- **Importar CSV de leads** (`src/lib/data/lead-csv.ts` + `importLeadInputs`): aceita o modelo da skill `local-client-prospector` e planilhas simples; confere duplicidade; nunca sobrescreve.
- **Home**: faixa de 8 indicadores em `homeIndicators` (`metrics/home-overview.ts`), cada um rotulado "período" ou "atual".
- **Configurações**: condições de pagamento padrão, entrada (%), rodadas de revisão padrão.
- **Cliente**: propostas vinculadas e parcelas/recebimentos no painel.
- **Migration** `20261110120000_sellora2_stages_status_scope.sql` (aditiva).

Já existia e continua: CRUD de leads com busca, filtros, ordenação, Kanban, atividades e follow-ups; clientes; projetos com checklist; propostas com itens, duplicar e impressão/PDF do navegador; financeiro com recebimentos parciais, despesas e períodos 7D/30D/90D/1A; login e RLS no modo Supabase; aba Prospecção IA (OpenStreetMap + conferência HTTP, `PROSPECCAO_EXECUTOR=osm`).

## 7. O que foi testado, e o que não foi

Testado em 2026-11-10: typecheck, lint, 87 testes unitários, build; e, pela interface em modo demonstração (desktop 1366 px), o percurso cadastrar lead → criar proposta → Enviada → Fechar venda → recebimento parcial → Home atualizada → dados iguais após recarregar → painel do cliente → Importar CSV. Home sem rolagem horizontal em 375 px.

**Não testado — não afirme o contrário sem executar:** modo Supabase num projeto real; `scripts/rls-check.mjs`; a migration nova em Postgres; uma pesquisa real da Prospecção IA; arrastar no Kanban pela interface; salvar Configurações pela interface; impressão/PDF; tablet; leitor de tela; Lighthouse; axe; e2e automatizado (Playwright não está instalado).

Aviso de ambiente: no navegador embutido do Claude, com o painel em segundo plano, `requestAnimationFrame` não dispara e páginas com `<Suspense>` ficam em "Carregando…". Não é defeito do app. Deixe o painel visível, ou abra `/dashboard` e navegue pelo menu.

## 8. Pendências, em ordem de prioridade

1. Perguntar a identidade visual (§5) e, se os commits locais ainda não estiverem no GitHub, se o usuário autoriza o push.
2. **Propostas**: ligar `expireOverdueProposals()` (pronta e testada) a uma ação visível, com contagem e confirmação.
3. **Financeiro**: editar lançamento existente; filtro de período personalizado (data inicial e final) coerente com `cashFlow`/`rangeBounds`; decidir com o usuário o que acontece com as parcelas quando o valor do projeto muda.
4. **Fechar venda**: permitir revisar início, prazo e parcelas antes de confirmar.
5. **Supabase**, somente se o usuário fornecer credenciais em `.env.local`: rodar as 3 migrations em ordem, criar o usuário, executar `scripts/rls-check.mjs` e repetir o percurso da §7 logado. Sem credenciais, registre como bloqueio externo.
6. **Refinamento visual por módulo** (depois da resposta da §5): consistência de espaçamento, hierarquia, estados vazios/carregando/erro, foco visível, mobile e tablet nas 7 páginas. Use `design-review`, `web-design-guidelines` e depois `quality-assurance`. Preserve o que já foi aprovado; nada de redesenho do zero.
7. Qualidade: e2e dos fluxos essenciais (instalar Playwright exige aprovação), axe e Lighthouse.
8. Opcional: PDF próprio da proposta; entidade de diagnóstico de site (`website_audits`), hoje nas observações do lead.

## 9. Skills pertinentes

Locais em `.claude/skills/`: `dashboard-builder` (implementar módulo), `design-review` (revisar tela renderizada), `quality-assurance` (PASS/FAIL/SKIP com evidência), `proposal-writer`, `sales-strategy`, `website-audit`, `lead-research`, `website-builder`, `prompt-architect` e `local-client-prospector`.

A skill de prospecção **funciona e deve ser preservada**: não altere `.claude/skills/local-client-prospector/` nem `src/lib/prospecting/*` sem necessidade. Ela não é uma API; a ponte com o CRM é "Adicionar ao CRM" na aba e "Importar CSV" em Leads.

Do catálogo da conta, se listadas na sua sessão: `frontend-design`, `interface-design`, `ui-ux-pro-max`, `web-design-guidelines`, `webapp-testing`, `vercel-react-best-practices`. Não encontradas na sessão anterior: `impeccable`, `taste` e o arquivo `PROMPT_MESTRE_FRONTEND_UX_MOTION_CRIATIVIDADE.md`. Não presuma instalação; confira.

## 10. Regras de trabalho

- Uma entrega por vez, ponta a ponta: tipo/schema → repositório → métrica → interface → teste.
- Não duplique o que existe: procure no repositório antes de criar função, componente ou campo.
- Não substitua tecnologia que funciona. Sem microserviços, multitenant, pagamentos, gateways, bancos ou automação de contato.
- Depois de cada marco: `typecheck`, `lint`, `test`, `build`; e verificação real na interface quando a mudança for visível.
- **Proibido afirmar sem evidência.** Distinga implementado, testado e pendente. Só diga que um teste passou se você o executou nesta sessão.
- Atualize `docs/AI_HANDOFF.md` a cada marco e registre decisões em `docs/DECISIONS.md`.
- Economize: sem refatoração por gosto, sem reescrever o que funciona, sem relatório longo.

## 11. Primeiro passo exato

Execute a §2. Em seguida, envie ao usuário uma mensagem curta com: (a) o resultado da referência de testes; (b) a pergunta da identidade visual (§5); (c) a pergunta sobre o push, se `git status -sb` mostrar a `main` à frente do remoto. Sem esperar a resposta, comece o item 2 da §8 (ação "Expirar propostas vencidas" em `src/components/views/proposals-view.tsx`, usando `expireOverdueProposals` de `src/lib/data/repository.ts`), que não depende de nenhuma das duas respostas.

## 12. Critério de conclusão da Parte 2

Os sete módulos acessíveis e consistentes entre si; percurso lead → recebimento funcionando e reverificado; pendências 2 a 4 da §8 resolvidas ou explicitamente adiadas pelo usuário; refinamento visual aplicado conforme a identidade escolhida; `typecheck`, `lint`, `test` e `build` verdes; `docs/AI_HANDOFF.md` atualizado com o que foi testado e o que ficou pendente. Se sobrar algo, diga o que é.
