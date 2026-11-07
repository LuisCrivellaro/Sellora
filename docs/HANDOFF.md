# Handoff — continuação do projeto Sellora

Documento para o próximo agente (ou outra conta) retomar o trabalho sem perder contexto. Atualizado em **2026-11-07**, último commit de referência `91c0bdb`.

---

## 1. Leia primeiro (nesta ordem)

1. `CLAUDE.md` — regras permanentes (honestidade, segurança, autorização para commit/push).
2. `docs/DECISIONS.md` — todas as decisões já tomadas e seus motivos. **Não reverta nenhuma sem pedido explícito.**
3. `docs/ROADMAP.md` e `docs/DASHBOARD_SPEC.md` — status e regras de cálculo.
4. `docs/WORKFLOW.md` §4–7 — formato de prompts, níveis de evidência e relatório final.
5. `docs/DESIGN_SYSTEM.md` — paleta refinada e linguagem visual aprovada (dark, roxo/magenta suavizados, navegação em pill).

## 2. Estado atual (confirmado)

| Área | Situação |
|---|---|
| Frontend | 7 páginas funcionando: Home, Leads (tabela + Kanban), Clientes, Projetos, Propostas, Financeiro, Configurações |
| Dados | **Modo demonstração** em `localStorage` (chave `sellora.db.v1`), dados fictícios rotulados. Sem backend. |
| Login | **Não existe.** Não há autenticação nem RLS. |
| Testes | `lint`, `typecheck`, 26 testes Vitest e `build` passam. Sem e2e automatizado, sem Lighthouse/axe. |
| Visual | Paleta suavizada aplicada globalmente; Financeiro usa a mesma paleta (entradas lilás, saídas magenta). |
| Publicação | Nada publicado; sem deploy. |

Stack: Next.js 16.4 (App Router, Turbopack) · React 19.3 · TypeScript 5.9 (não 7) · Tailwind 4.3 · `radix-ui` · `motion` 14 · Lucide · Zod 4 · Vitest 5. Gráficos em SVG próprio. Ambiente do usuário: Windows, Node 24, npm 11.

```bash
npm install
npm run dev        # http://localhost:3000 (o preview do Claude Code usa a porta 3100 via .claude/launch.json)
npm run lint && npm run typecheck && npm run test && npm run build
```

Arquitetura relevante para o próximo passo:
- `src/lib/types.ts` — entidades (Lead, Activity, Client, Project + tasks, Proposal + items, Transaction + payments, Settings).
- `src/lib/schemas.ts` — validação Zod de toda entrada (reutilizar no servidor).
- `src/lib/data/store.ts` — armazenamento local (`useSyncExternalStore`).
- `src/lib/data/repository.ts` — **todas as escritas** passam por aqui; é a fronteira a ser trocada por Supabase.
- `src/lib/metrics/*` — regras de cálculo puras e testadas (não duplicar nos componentes).

## 3. Pendências conhecidas

- Persistência real, login e RLS (**próximo passo**, abaixo).
- Financeiro: período personalizado e zoom do gráfico não implementados; a imagem de referência do redesign nunca foi anexada.
- Testes e2e (Playwright), Lighthouse e axe não executados.
- Portfólio (`/portfolio`) adiado.
- 8 alertas moderados do `npm audit` em `@typescript-eslint` (só desenvolvimento).
- Selo "Demonstração" saiu do topo no desktop por alteração do usuário (commit `f7b1075`); só rodapé, menu móvel e Configurações indicam o modo demo.
- Indefinido: onde ficará o código dos sites de clientes.

## 4. Por que este é o próximo passo

Pela ordem de prioridade do `CLAUDE.md` (dashboard utilizável > **dados persistidos e segurança** > funcionalidades comerciais > portfólio) e pelo critério de conclusão v0.1 ("Administrador **entra**…"), o que falta para o painel ser usado de verdade é **login + banco com RLS**. Hoje os dados reais ficariam só no navegador, sem backup.

Em paralelo, **fora do código**, o fundador já pode prospectar com o painel atual: usar "Começar do zero" em Configurações para trabalhar com dados reais locais e "Exportar dados (JSON)" como backup até o Supabase entrar. A meta do negócio continua sendo a **primeira venda em 15 dias**.

---

## 5. Missão — Entrega 1: Supabase (Auth + Postgres + RLS)

### 5.1 Objetivo
Trocar a persistência local por Supabase para dados reais, com login do administrador e RLS, **mantendo o modo demonstração** quando as variáveis do Supabase não estiverem configuradas. Nenhuma página deve mudar de aparência.

### 5.2 Contexto confirmado
Seções 2 e 3 acima. A interface já chama funções do `repository.ts`; os cálculos vivem em `src/lib/metrics`.

### 5.3 Escopo autorizado
- Criar migrations SQL (pasta `supabase/migrations/`) para: `leads`, `activities`, `clients`, `projects`, `project_tasks`, `proposals`, `proposal_items`, `transactions`, `payments`, `settings`.
- Cada tabela com `owner_id uuid not null default auth.uid() references auth.users`, `created_at`/`updated_at`, chaves estrangeiras com `on delete` coerente, índices nas colunas de filtro (`stage`, `status`, `due_date`, `client_id`, `project_id`, `lead_id`).
- **RLS habilitado em todas as tabelas**, políticas `select/insert/update/delete` restritas a `owner_id = auth.uid()`.
- Login por e-mail (senha ou link mágico) com `@supabase/ssr`; página `/entrar`; proteção das 7 rotas (verificar a convenção do Next 16 — `proxy.ts` substitui `middleware.ts`); sair no menu do usuário.
- Extrair uma interface de repositório e criar duas implementações: **local (demo)** — a atual — e **Supabase**, escolhida por presença das variáveis de ambiente.
- Escritas reais via **server actions** com os mesmos schemas Zod (validação no servidor).
- Mapear tipos TS ↔ colunas snake_case num único módulo de mapeamento.
- Importação opcional do JSON exportado do modo local para o banco, **somente com confirmação explícita do usuário**.

### 5.4 Fora de escopo e intocáveis
- Visual, layout, paleta, navegação, cálculos de `src/lib/metrics` (exceto adaptar a entrada de dados).
- Multitenant, papéis múltiplos, pagamentos, integrações externas, envio de mensagens, deploy.
- Nunca colocar `service_role` no frontend nem commitar `.env.local`.
- Nunca inserir os dados fictícios da semente no banco real.

### 5.5 Requisitos funcionais
- Sem variáveis do Supabase → app funciona exatamente como hoje (modo demonstração).
- Com variáveis → exige login; após login, CRUD de todas as entidades persiste no Postgres; recarregar a página mantém os dados; outro usuário autenticado não enxerga os registros (RLS).
- Estados de carregamento e erro reais nas leituras/escritas; mensagens em português com ação de recuperação.
- Configurações › Integrações mostra "Supabase: conectado" somente quando a sessão e uma consulta de teste funcionarem.

### 5.6 Requisitos não funcionais
Sem regressão visual; foco/teclado preservados; nenhuma chave secreta exposta; erros do servidor não vazam detalhes internos; manter `lint`, `typecheck`, `test` e `build` verdes.

### 5.7 Dependências e bloqueios
- `@supabase/supabase-js` e `@supabase/ssr` (verificar versões atuais compatíveis; registrar em `DECISIONS.md`).
- **Bloqueio provável:** credenciais. O usuário precisa criar o projeto Supabase e fornecer `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em `.env.local` (não versionado). Se não houver credenciais: implementar tudo, rodar migrations no Supabase local (CLI) se disponível, e relatar exatamente o que ficou sem validar.

### 5.8 Plano
1. Auditar repo e confirmar estado (seção 2).
2. Migrations + políticas RLS + revisão de segurança (skill `security-review` se disponível).
3. Interface de repositório + implementação Supabase + mapeadores.
4. Auth (`/entrar`, sessão, proteção de rotas, sair).
5. Server actions com Zod; adaptar `store`/hooks para dados assíncronos com loading/erro.
6. Importação opcional do JSON local.
7. Testes e validação; documentação; relatório.

### 5.9 Testes necessários
- Unitários: mapeadores, seleção de repositório, server actions (validação).
- RLS: dois usuários de teste — um não lê nem altera dados do outro.
- E2E (Playwright, se instalado com aprovação): entrar → cadastrar lead → recarregar → lead persiste → sair.
- Regressão: as 7 páginas abrem sem erros de console em modo demo e em modo Supabase.

### 5.10 Critérios de aceite
- Login funciona; rotas protegidas redirecionam para `/entrar` sem sessão.
- Lead, atividade, proposta, conversão em cliente/projeto e recebimento persistem após recarregar.
- RLS comprovado com dois usuários.
- Modo demo intacto sem variáveis.
- `lint`, `typecheck`, `test`, `build` passando.

### 5.11 Relatório final (obrigatório)
Formato de `docs/WORKFLOW.md` §7: solicitado / planejado / implementado / testado (PASS/FAIL/SKIP com motivo) / pendente / riscos / como testar. Não declarar concluído o que não foi testado.

### 5.12 Regras de execução
- Commit e push **só com autorização do usuário**. Exceção já combinada: se o limite de uso da conta chegar a **90%**, parar no ponto atual, fazer commit e push e informar onde parou.
- Responder sempre em português.
