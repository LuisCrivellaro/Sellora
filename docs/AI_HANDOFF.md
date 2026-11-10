# AI_HANDOFF — Sellora 2.0

Documento de transferência entre instâncias de IA. **Atualizado em 2026-11-10, ao fim do marco "fluxo comercial completo" da Parte 1.** Não contém segredos. Complementa (não substitui) `CLAUDE.md`, `README.md` e `docs/DECISIONS.md`. O antigo `docs/HANDOFF.md` descreve a missão anterior (Supabase) e segue válido só como histórico.

Legenda de evidência: **[testado]** = executado nesta sessão com resultado observado · **[implementado]** = código escrito, sem execução real do caminho · **[pendente]** = não feito.

---

## 1. Objetivo da Sellora

Operação que cria sites profissionais para negócios locais sem presença digital adequada. Meta: **primeiro cliente pagante em até 15 dias**. Pagamento único pela criação: Essencial R$ 590 · Profissional R$ 990 · Personalizado a partir de R$ 1.490 (editáveis em Configurações); condição sugerida 50% de entrada + 50% na entrega. Domínio, hospedagem e manutenção são custos separados. O painel interno (este repositório) organiza prospecção → CRM → proposta → cliente → projeto → financeiro.

Divisão do trabalho: **Parte 1** (esta) = fundação funcional e fluxo comercial ponta a ponta. **Parte 2** (próxima IA) = refinamento visual extensivo, pendências da §8 e qualidade (e2e, acessibilidade). **WhatsApp está fora das duas partes.**

## 2. Estado do repositório

- Repositório: `https://github.com/LuisCrivellaro/Sellora` · branch `main` · commit da Parte 1: `1a1e380` (feat: fluxo comercial completo), seguido de um commit de documentação. O remoto (`origin/main`) está em `06d1203`.
- **A Parte 1 está commitada localmente, sem push** (push só com autorização do usuário). Detalhes na §11.
- Nada publicado; nenhum deploy; nenhum push feito nesta sessão.

## 3. Stack e versões reais

Next.js 16.4 (App Router, Turbopack; `src/proxy.ts` no lugar de middleware) · React 19.3 · TypeScript 5.9 · Tailwind CSS 4.3 · `radix-ui` 1.8 · `motion` 14 · Lucide · Zod 4 · Vitest 5 · `@supabase/ssr` 0.12 + `@supabase/supabase-js` 2.119. Gráficos em SVG próprio. Ambiente: Windows 11, Node 24, npm 11. Sem Playwright instalado.

```bash
npm install
npm run dev                      # http://localhost:3000 (launch.json do Claude usa 3100)
npm run lint && npm run typecheck && npm run test && npm run build
```

## 4. Arquitetura real

```
src/app/<rota>/page.tsx      7 páginas: dashboard, leads, clientes, projetos, propostas, financeiro, configuracoes (+ entrar)
src/components/views/        composição de cada página
src/components/<módulo>/     formulários e painéis de detalhe
src/lib/types.ts             entidades do domínio
src/lib/constants.ts         etapas, status, rótulos, tarefas padrão
src/lib/schemas.ts           validação Zod de toda entrada (formulário e servidor)
src/lib/data/repository.ts   TODAS as escritas (única fronteira de gravação)
src/lib/data/store.ts        estado no navegador: modo local (localStorage) ou Supabase (fila + diff)
src/lib/data/actions.ts      server actions do modo Supabase (sessão → Zod → RPC apply_changes)
src/lib/data/mappers.ts      camelCase ↔ snake_case
src/lib/data/row-schemas.ts  validação no servidor do que vai ao Postgres
src/lib/data/lead-csv.ts     importação de leads por CSV (pura)
src/lib/metrics/*            regras de cálculo puras e testadas (não duplicar em componentes)
src/lib/prospecting/*        Prospecção IA (OpenStreetMap + conferência HTTP)
supabase/migrations/         3 migrations, só aditivas depois da inicial
```

Dois modos de dados, escolhidos pelas variáveis de ambiente:
- **Demonstração/local** (sem variáveis Supabase): `localStorage`, chave `sellora.db.v1`. É o modo ativo nesta máquina (`.env.local` só tem `PROSPECCAO_EXECUTOR`). Não é persistência de produção.
- **Supabase** (com `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`): login em `/entrar`, Postgres com RLS por `owner_id`, gravação atômica via `apply_changes`. **Nunca validado num projeto Supabase real** (faltam credenciais).

Regra crítica: **não aumentar `DB_VERSION`** (`src/lib/data/seed.ts`). `store.ts` descarta o banco local se a versão mudar. Campos novos entram por `normalizeDatabase()` (local) e por `.default()` no `settingsSchema` (Supabase).

## 5. Decisões aprovadas (resumo; detalhes em `docs/DECISIONS.md`)

1. Sete módulos no menu, sem itens novos. Prospecção IA é uma aba dentro de Leads (`/leads?aba=prospeccao`).
2. Dados de demonstração sempre rotulados; nunca vão ao banco real. Nada de números inventados.
3. Contratado ≠ faturado ≠ recebido ≠ despesa ≠ saldo. Contrato nunca entra no caixa.
4. Nenhum envio automático (mensagem, contrato, cobrança, publicação). Status "Enviada" só registra.
5. Prospecção usa OpenStreetMap + verificação HTTP, sem chave e sem custo; "sem site" vindo só do OSM é "não verificado".
6. Ids antigos preservados: etapa de projeto `briefing` = "Briefing pendente", `entrega` = "Entregue".
7. Commit e push só com autorização explícita; nunca force push.

### Conflito de identidade visual — decisão do usuário pendente

O briefing da Parte 1 descreve "navegação superior em pill, roxo #8866BD e magenta #BB6BA5, fundo #101014, Financeiro verde-menta #67B99A". **O código atual não é assim:** os commits `d789002` ("Layout black") e `b9613ba` ("Layout front pronto"), feitos pelo usuário, trocaram para **sidebar BranchedMenu** e tema **Premium Monochrome Dark** (preto/grafite, vermelho #C94B55 e azul-aço #7186A6 nos dashboards; Financeiro com tokens `--fin-*`). A Parte 1 **preservou o que está no código** e não tocou em tokens, shell ou paleta. A Parte 2 deve **perguntar ao usuário qual das duas identidades vale** antes de qualquer refinamento visual.

## 6. Skills

Locais, versionadas em `.claude/skills/` (todas presentes): `dashboard-builder`, `design-review`, `quality-assurance`, `lead-research`, `sales-strategy`, `website-audit`, `proposal-writer`, `website-builder`, `prompt-architect`, `local-client-prospector`.

Do catálogo da conta, listadas nesta sessão (variam por conta — conferir antes de citar): `frontend-design`, `interface-design`, `ui-ux-pro-max`, `web-design-guidelines`, `webapp-testing`, `vercel-react-best-practices`, `humanizer`, `skill-creator`, `code-review`, `security-review`, `simplify`.

**Não encontradas:** `impeccable`, `taste` (como skill ativa) e o arquivo `PROMPT_MESTRE_FRONTEND_UX_MOTION_CRIATIVIDADE.md` (não existe no repositório).

**Uso real nesta sessão:** nenhuma skill foi invocada pela ferramenta Skill. Foram lidos e seguidos os documentos do projeto (`CLAUDE.md`, `README.md`, `docs/HANDOFF.md`, trechos de `DECISIONS.md` e `SKILLS_SETUP.md`) e auditado o `SKILL.md` da `local-client-prospector`. A Parte 2 deve usar `design-review`, `quality-assurance` e `web-design-guidelines` no refinamento visual.

### Auditoria da skill de prospecção (`local-client-prospector`)

- Local: `.claude/skills/local-client-prospector/` (`SKILL.md`, `ORIGEM.md`, `LICENSE` MIT, `assets/lead-template.csv`).
- **Não é API.** Dois caminhos: (a) no chat do Claude Code, com WebSearch/WebFetch, saída em tabela, CSV ou JSON; (b) executor do app em `src/lib/prospecting/*` exposto por `/api/prospeccao/status`, `/api/prospeccao/jobs` (POST) e `/api/prospeccao/jobs/[id]` (GET/DELETE).
- Entradas: cidade/UF, segmento, raio (5/10/20/50 km), quantidade (10/20/50/100), tipo de oportunidade.
- Saídas: classe HOT/WARM/LOW/SKIP, score 0–100, confiança, evidências, fontes. CSV com 17 colunas (`CSV_COLUMNS` em `src/lib/prospecting/export.ts`).
- Dependências: Nominatim e Overpass públicos; `PROSPECCAO_EXECUTOR=osm` em `.env.local`. Sem chave.
- Limites: 1 pesquisa por usuário, 2 no servidor, 10/hora, 5 min, 150 sites conferidos; jobs só em memória por 1 h; cobertura do OSM varia; Instagram não é aberto.
- Integração com o CRM: "Adicionar ao CRM" (`importProspects`) e, novo na Parte 1, **Importar CSV** em Leads, que lê o CSV da skill/aba. Ambos conferem duplicidade e nunca sobrescrevem.
- Estado: código da prospecção **não foi alterado**. [testado] os 15 testes de `prospecting.test.ts` passam; `GET /api/prospeccao/status` respondeu `configured: true, executor: "osm"`. [pendente] Nenhuma pesquisa real foi disparada nesta sessão.

## 7. O que a Parte 1 entregou

| Item | Onde | Evidência |
|---|---|---|
| Etapas de projeto: 9 (Briefing pendente, Briefing recebido, Planejamento, Design, Desenvolvimento, Revisão, Aprovação, Publicação, Entregue) | `types.ts`, `constants.ts`, `visualization.ts`, `metrics/projects.ts` | [testado] rótulos vistos em `/projetos` |
| Status de proposta: 7 (+ Pronta, + Expirada). "Pronta" não conta como enviada; `expireOverdueProposals()` existe | `constants.ts`, `repository.ts`, `metrics/proposals.ts` | [testado] unitário; 7 opções vistas no seletor. A função de expirar **não está ligada a nenhum botão** |
| Campo **Escopo** na proposta (formulário, documento imprimível, vira observação do projeto) | `proposal-form.tsx`, `proposal-detail.tsx` | [testado] interface |
| **Fechar venda** (`closeSale`): proposta → Aprovada, lead → Ganho, cliente criado/vinculado, projeto com valor contratado e 12 tarefas, parcelas a receber. Uma gravação, idempotente | `repository.ts`, botão no detalhe da proposta | [testado] unitário e interface |
| Parcelas (`buildInstallments`): entrada % configurável + saldo na entrega, soma exata em centavos | `repository.ts` | [testado] unitário |
| Lead → Ganho (Kanban, seletor ou edição) garante cliente sem duplicar; reaproveita cliente já cadastrado com mesmo nome+cidade ou telefone | `withClientForLead` em `repository.ts` | [testado] unitário |
| Funil acompanha a proposta: Enviada → lead em "Proposta"; Em negociação → "Negociação" (só avança) | `advanceLeadForProposal` | [testado] unitário e interface |
| **Importar CSV** de leads (modelo da skill ou planilha simples; vírgula ou ponto e vírgula; limite 500 linhas / 2 MB) | `lead-csv.ts`, `importLeadInputs`, botão em Leads | [testado] unitário e interface |
| Home: faixa de 8 indicadores (total de leads, qualificados, conversão, contratado, recebido, a receber, projetos ativos, atividades pendentes), cada um rotulado "período" ou "atual" | `homeIndicators` em `metrics/home-overview.ts`, `home-view.tsx/.css` | [testado] valores mudaram de forma coerente após a venda de teste |
| Configurações: condições de pagamento padrão, entrada (%), rodadas de revisão padrão | `settings-view.tsx`, `Settings` | [testado] campos visíveis com os padrões; **salvar não foi exercitado na interface** |
| Cliente: propostas vinculadas e parcelas/recebimentos no painel | `client-detail.tsx` | [testado] interface |
| Migration aditiva (status, etapas, coluna `scope`) | `supabase/migrations/20261110120000_sellora2_stages_status_scope.sql` | [implementado] **não executada em nenhum Postgres** |

Já existia antes e foi preservado: CRUD de leads com busca, filtros, ordenação, Kanban, atividades e follow-ups; clientes; projetos com checklist; propostas com itens, duplicar e impressão/PDF pelo navegador; financeiro com recebimentos parciais, despesas e filtros 7D/30D/90D/1A; Supabase Auth + RLS; Prospecção IA.

## 8. Parcial e pendente

Parcial:
- **Modo Supabase não validado em projeto real.** Faltam credenciais. A migration nova precisa ser rodada antes de usar os status "Pronta"/"Expirada" e as etapas novas, senão o banco recusa a gravação (check constraint) e a faixa de erro oferece tentar de novo/descartar.
- **Expiração de propostas**: função pronta e testada, sem gatilho na interface.
- **Financeiro**: sem período personalizado (só 7D/30D/90D/1A); sem edição de lançamento já criado (só cancelar e recriar); parcelas geradas não são recalculadas se o projeto mudar de valor.
- **Fechar venda** sempre cria projeto com início hoje e prazo = hoje + prazo da proposta; não há tela para ajustar parcelas antes de gerar (edita-se depois em Projetos/Financeiro).
- **Diagnóstico do lead** fica nas Observações; não há entidade `website_audits`.

Pendente:
- Refinamento visual extensivo (Parte 2), depois de resolver o conflito de identidade da §5.
- Testes e2e automatizados (Playwright não instalado), Lighthouse, axe.
- Exportação de PDF própria (hoje é a impressão do navegador).
- Portfólio (`/portfolio`), adiado.
- WhatsApp: **proibido nesta etapa**.

## 9. Testes executados nesta sessão (2026-11-10)

| Verificação | Resultado |
|---|---|
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run test` | PASS — 87 testes em 8 arquivos (78 antes; +9 em `src/lib/data/sale-flow.test.ts`) |
| `npm run build` | PASS — 7 páginas + `/entrar` + 3 rotas de API |
| Interface, modo demonstração, `localhost:3000`, desktop 1366×800 | PASS: cadastrar lead pelo formulário → criar proposta a partir do lead (com escopo) → status Enviada (lead foi para Proposta) → Fechar venda (cliente +1, projeto +1, 2 parcelas de R$ 495) → recebimento parcial de R$ 200 → Home: contratado +990, recebido +200, a receber +790, projetos ativos +1 → valores iguais após recarregar a página → painel do cliente com proposta e parcelas → Importar CSV (1 criado, 1 duplicado recusado) |
| Mobile 375 px, Home | PASS: sem rolagem horizontal; faixa de indicadores em 2 colunas |
| Console do navegador | Sem erros nas telas visitadas |

Não executado: modo Supabase real; `scripts/rls-check.mjs`; migration nova em Postgres; pesquisa real de prospecção; arrastar no Kanban pela interface (coberto por teste unitário de `moveLeadStage`); salvar Configurações pela interface; impressão/PDF; tablet; leitor de tela; Lighthouse/axe.

Nota de ambiente: com o painel do navegador do Claude em segundo plano, `requestAnimationFrame` não dispara e as páginas com `<Suspense>` ficam no esqueleto ("Carregando…"). Não é defeito do app; some com o painel visível ou navegando pelo menu a partir de `/dashboard`.

## 10. Erros e riscos conhecidos

- Sem erro crítico conhecido nos fluxos testados.
- 8 alertas moderados do `npm audit` em `@typescript-eslint` (só desenvolvimento), herdados.
- O navegador de teste do Claude ficou com dados de teste no `localStorage` dele (lead "Cantina Teste E2E", "Lanchonete CSV Teste"). O navegador do usuário não foi tocado. Para limpar: Configurações › Sistema › Restaurar demonstração.
- `closeSale` usa a entrada (%) vigente em Configurações no momento do clique, não o texto livre "Forma de pagamento" da proposta.

## 11. Onde está o código da Parte 1

Tudo commitado na `main` local em `1a1e380` (31 arquivos: 26 modificados, 5 novos), seguido de um commit só de documentação que atualizou este arquivo e o prompt de continuidade. Ver com `git show --stat 1a1e380`. A árvore de trabalho ficou limpa. **Nenhum push foi feito**: o GitHub ainda está em `06d1203`.

### Como levar o código para a outra conta

- **Mesma máquina, mesma pasta** (`C:\Projetos\Sellora`): nada a fazer; a outra conta enxerga os commits locais.
- **Outro computador ou clone**, em ordem de preferência:
  1. Com autorização do usuário, `git push origin main` (ou uma branch: `git switch -c sellora2-parte1 && git push -u origin sellora2-parte1`) e `git pull`/`git fetch` no destino.
  2. Sem push: `git bundle create parte1.bundle 06d1203..main`, copiar o arquivo e, num clone em `06d1203`, `git pull parte1.bundle main`.
- `.env.local` não é versionado: recriar a partir de `.env.example` (`PROSPECCAO_EXECUTOR=osm`; variáveis do Supabase só quando houver projeto).

## 12. Configuração externa necessária (sem segredos)

| Item | Estado | O que falta |
|---|---|---|
| Supabase | Não configurado | Criar projeto; pôr URL e chave anon em `.env.local`; rodar as 3 migrations em ordem; desligar cadastro público; criar o usuário administrador |
| Prospecção | Ativa (`osm`) | Nada |
| Vercel/deploy | Inexistente | Só com autorização |
| WhatsApp, bancos, gateways | Fora de escopo | — |

## 13. Próximos passos, em ordem

1. Perguntar ao usuário qual identidade visual vale (§5) e se autoriza o push dos commits locais.
2. Se houver credenciais do Supabase: rodar as migrations, criar usuário, executar `scripts/rls-check.mjs` e repetir o fluxo da §9 logado.
3. Ligar `expireOverdueProposals()` a uma ação visível em Propostas.
4. Financeiro: editar lançamento e período personalizado.
5. Parte 2: refinamento visual por módulo com `design-review`, depois `quality-assurance`.

**Onde o trabalho parou:** código da Parte 1 completo e verde; documentação atualizada; tudo commitado localmente, sem push. Nenhuma tarefa ficou pela metade.
