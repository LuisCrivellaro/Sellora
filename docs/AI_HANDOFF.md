# Continuidade do Sellora

Estado verificado em 2026-11-12. README descreve o uso e DECISIONS preserva as decisões. Este resumo substitui HANDOFF e PROMPT_CONTINUACAO, que descreviam missões encerradas.

## Estado atual

- Aplicativo Windows com Electron e Next local em 127.0.0.1:3187. Build: `npm run desktop:build`; executável em `release/`, ignorado pelo Git.
- Sete módulos, CRM e fluxo lead → proposta → cliente/projeto → financeiro. Escritas passam por `src/lib/data/repository.ts`.
- Prospecção usa OpenStreetMap e classificação local por regras, com verificação HTTP de sites. Apesar do nome da aba, o ranking não usa modelo generativo: seleciona até dez HOT/WARM por score, confiança e distância dentro do raio e informa limites de cobertura.
- A pesquisa apenas salva resultados. O administrador revisa e usa **Gerar prospecção com demo** para importar os selecionados (ou resultados visíveis) e iniciar a geração. Flags antigas não autorizam geração automática.
- Demos v5 são criadas no app com Unique Site Designer e a conta ChatGPT do Codex instalado: textos estruturados, imagem nativa, validação, histórico e fila sequencial. Pendências pausam ao reabrir; só uma ação explícita retoma os leads escolhidos.
- Leitores v1–v4 e dois conceitos v4 aprovados permanecem disponíveis. Mensagens editadas, snapshots e envios anteriores são preservados.
- WhatsApp abre com rascunho após aprovação; envio e confirmação são manuais. Nenhum contato com leads foi realizado na validação.

## Merge com origin/main (2026-11-12)

- Ramo local (demos v1–v5 com Codex) mesclado com origin/main (IBGE/Overpass, financeiro de produção, demos v3 por tipo de negócio e recusa de demo). Decisão detalhada em DECISIONS.
- v3 com `design` = personalização; v3 sem `design` = visual por tipo (`DemoSiteV3`/`CoverV3`). Demos recusadas ficam fora das ações em lote e da aplicação de resultados gerados.
- Migration `20261111220000_finance_production.sql` veio do remoto e não foi aplicada em nenhum Supabase real.

## Dados e segurança

- CRM local no armazenamento do perfil; exportação/restauração JSON nas Configurações. Não aumentar DB_VERSION: normalizar campos novos para preservar registros.
- Resultados e imagens v5 em `%APPDATA%/sellora/demo-generator` no Windows ou `.sellora-data/` no desenvolvimento. O JSON do CRM não inclui esses arquivos; preservar o diretório junto com o backup.
- Links contêm dados comerciais públicos. Imagens v5 dependem do servidor de origem; links locais não servem para leads externos. Nenhum deploy foi feito.
- Codex mantém a própria autenticação. Telefone, notas, e-mail, score e credenciais ficam fora do briefing do modelo. Rotas de geração exigem origem local e validação de acesso.
- Supabase é opcional e continua sem validação em projeto remoto real. Não afirmar que login/RLS remotos foram testados. Conferir o projeto antes do acesso; migrations em `supabase/migrations/`.

## Evidências e limites

- Após o merge com origin/main (2026-11-12): 176 testes em 25 arquivos, lint, TypeScript e build aprovados. Dependências de produção sem vulnerabilidades no npm audit desta revisão.
- Auditoria completa: 12 alertas moderados nas dependências de desenvolvimento (cadeias de typescript-eslint e electron-builder/minimatch), sem alertas altos ou críticos. package-lock.json não mudou nesta versão. A correção deve ser tratada separadamente, validando compatibilidade; não executar audit fix --force indiscriminadamente.
- QA anterior observado no executável e navegador: geração nativa com negócio fictício, persistência, layouts responsivos, prévia, shortlist regional, ausência de geração antes do botão e pausa da fila antiga ao reabrir. Evidências temporárias em `test-results/`, fora do commit.
- A conta Codex precisa disponibilizar geração de imagens e ter cota/créditos. Não há garantia de uso ilimitado ou gratuito.
- Comparação automática detecta origem idêntica, copy normalizada e combinações de composição. Fatos, semelhança semântica e qualidade visual exigem revisão humana.
- Aviso preexistente de hidratação no painel com movimento reduzido, associado a `useMotionEnabled`; registrado em DEMO_DESIGN_HISTORY. Não foi corrigido nesta versão.

## Verificação antes do commit

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check`. Para distribuir Windows, executar também `npm run desktop:build` e conferir ausência de .env, dados privados e artefatos de QA no pacote. Não gerar novas imagens só para repetir QA: usar fixtures/resultados existentes.

Commits e push exigem autorização explícita conforme CLAUDE.md; nunca presumir o estado do remoto a partir de hashes antigos documentados.

## Missões em andamento (2026-11-12)

### Estado exato em 2026-11-12 20:05 (branch `feat/demo-generator-v6`, último commit enviado `d5ae5fe` + commit de handoff)

**Missão 1 (V6): implementada, testada por unidade e em execução real parcial.**
- Concluído e verificado: gerador V6 em etapas; código próprio por demo; visualizador Prévia | Código; ZIP; QA estático + navegador real (Edge headless/CDP); armazenamento imutável; v1–v5 preservadas; aprovação/recusa/restauração V6 (teste em `src/lib/data/demos.test.ts`); 210 testes, lint, typecheck, `npm run build` e `npm run desktop:build` ok; .exe aberto com CRM, Demos, Financeiro e rotas novas respondendo.
- Execução real: 1 demo V6 completa (Barbearia Teste Sellora, Campinas) com Claude Sonnet 5.5 + 3 imagens do Codex + QA em navegador (passou após 1 rodada de correção). Site em `.sellora-data/sites/f2d9b0ce-5605-40c3-ba10-62adbc98f33d/` (local, fora do git; capturas em `meta/shot-*.png`). Servido em produção com CSP sandbox e conferido no Edge real (fontes, CSS e imagens ok). ZIP baixado, aberto pelo Expand-Archive e com SHA-256 de todos os arquivos iguais aos da prévia.
- Problema real encontrado e corrigido: EPERM ao renomear a pasta do site no Windows (antivírus/watcher) → `publishDirectory` com novas tentativas e cópia. Build Windows quebrava ao copiar link simbólico do sharp → `cp(..., { dereference: true })`.
- **Pendente na missão 1:** (a) gerar as demos de teste do **restaurante** e da **clínica odontológica** e comparar capturas lado a lado com a barbearia (script em `scratchpad/claude-probe/v6-run.mjs` e `side-by-side.mjs`; recriar se o scratchpad sumir: POST `/api/demos/jobs` com `generator: "v6"`, `textProvider: "claude"`, `imageProvider: "codex"`, nomes "… Teste Sellora"). Motivo de não ter feito: **cada demo V6 consome ~16% do limite de 5 h do plano Pro** (Sonnet esforço alto escrevendo briefing, código e correção) e o limite estava em 71%. (b) verificar visualmente o painel "Prévia | Código" dentro do app com uma demo V6 de um lead real do CRM (no painel interno de navegador do Claude o site em sandbox aparece sem estilos por bloqueio do próprio painel, `ERR_BLOCKED_BY_CLIENT`; no Edge real funciona). (c) testar uma geração V6 dentro do .exe (sharp nativo no utilityProcess do Electron não foi exercitado; se falhar, `optimizeForWeb` mantém PNG).
- Consumo: considerar reduzir custo (ex.: esforço "medium" no código ou briefing mais curto) depois de comparar qualidade; hoje `V6_LIMITS` = 3 imagens, 1 correção de direção, 1 rodada de correção.

**Missão 2 (Cloud 3D/Claw3D): não iniciada** (ordem do usuário). **Missão 3 (remover Gemini/imagen-skill): não iniciada.** Detalhes de cada uma abaixo.

### Estado da missão 1 (histórico de checkpoints)

- **Feito e enviado** (branch `feat/demo-generator-v6`): skills instaladas (`.claude/skills/`: Emil ×7, impeccable, design-taste-frontend, humanizer; ver docs/SKILLS_SETUP.md); skill canônica `.agents/skills/demo-generator-v6` (guia lido pelo app); `src/lib/demos/v6/` (schema, store imutável, zip, serve/CSP, prompts, images com WebP/sharp e fallback SVG, postprocess, qa-static, qa-browser via Edge+CDP, highlight, generator); rotas `/sites/[id]/[[...path]]` (pública, CSP sandbox), `/api/demos/sites/[id]` (código), `/zip`, `/preview`; `proxy.ts` libera `/sites/`; `generation-server.ts` usa V6 por padrão (`generator: "v6"`, telefone só para marcadores, linha do tempo `events`); modelo `version: 6` + `site`; `applyGeneratedLeadDemo` V6; capa, painel e canvas "Prévia | Código" com `CodeViewer`; build desktop copia a skill V6; eslint ignora skills de terceiros. 201 testes, lint e typecheck ok.
- **Em andamento**: geração real das 3 demos de teste (barbearia, restaurante, clínica odontológica, nomes "… Teste Sellora") com `scratchpad/v6-run.mjs` contra `npm run dev` na porta 3100; depois comparar capturas (`<dados>/sites/<id>/meta/shot-*.png`), conferir ZIP e ajustar o guia se as três parecerem variações do mesmo modelo.
- **Pendente na missão 1**: verificação visual do visualizador de código no navegador; `npm run build` + `npm run desktop:build` com teste no .exe; documentação final (README já tem a seção V6; DECISIONS registrada).

1. **Em execução — Sellora 2.0 / Demo Generator V6** (branch `feat/demo-generator-v6`): skills Emil Kowalski, Impeccable, Taste e Humanizer; gerador em etapas com código próprio por demo (index.html, styles.css, script.js, assets), imagens múltiplas com fallback, QA automático (estático + navegador real quando disponível), visualizador "Prévia | Código", ZIP portátil, snapshots imutáveis, demos antigas preservadas. Base já na branch: Claude Sonnet 5.5 para textos (esforço alto/médio), Gemini Nano Banana 2.1 opcional para imagens (sem chave configurada), Codex como alternativa.
2. **Na fila, só depois da missão 1 — Cloud 3D (Claw3D)**: aba "Cloud 3D" em `/dashboard/cloud-3d`; clonar iamlukethedev/Claw3D em diretório separado, conferir licença, README, ARCHITECTURE.md, docs/runtime-profiles.md, docs/multi-agent-beta.md e segurança; criar "Sellora Agent Bridge" (registro central de agentes reais, estados queued/running/waiting_approval/completed/failed/cancelled/offline, runtime `custom` com /health, /state, /registry conforme contrato real, SSE/WebSocket); primeira integração = gerador de demos com eventos reais de etapa; Claude Code (hooks) e Codex app-server opcionais; sem agentes fictícios; configurações sem credenciais; validar no Electron; documentar em `docs/CLAW3D_INTEGRATION.md`; branch própria.
3. **Na fila, só depois das missões 1 e 2 — Remover imagen-skill/Gemini e restaurar imagens pelo Codex**: o usuário não quer API paga para imagens. Remover a integração Gemini do fluxo (`src/lib/demos/gemini-server.ts`, `imageProvider` "gemini" como padrão, seletor "Imagem: Gemini", status `gemini` em `/api/demos/generator`, `GEMINI_API_KEY`/`SELLORA_GEMINI_IMAGE_MODEL` em `.env.example`, trechos do README/DECISIONS) e a pasta local `.claude/skills/imagen` + linha do `.gitignore` (dependências Python `google-genai`/`pillow` instaladas com `--user`: avaliar remoção sem afetar outros projetos). Codex volta a ser o único gerador de imagens, com o fallback gratuito existente; preservar V6, visualizador, ZIP, Claude nos textos, aprovação/recusa, histórico e Cloud 3D. A V6 já nasce usando Codex para imagens (sem Gemini como padrão). Testar sem afirmar geração real que não ocorreu. Não reverter commits inteiros.
