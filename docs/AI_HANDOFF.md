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

## Missões (estado em 2026-11-12, ~21:30 BRT) — branch `feat/cloud-3d`

Ordem de prioridade dos fatos: Git/código > testes > este documento. Confira `git log -5` antes de agir.

### Missão 1 — Gerador V6: concluída e testada na UI e no `.exe`
- Feito e verificado: demos reais **Restaurante Teste Sellora** (site `871275a1-d80c-41bd-8de7-4296d8bf1179`, ~4,5 min, ~6% da janela de 5 h) e **Clínica Odontológica Teste Sellora** (site `9469cd61-533c-4d88-9704-0487a56931b6`); a barbearia `f2d9b0ce-…` continua em `.sellora-data/sites` (o job dela não existe mais em `.sellora-data/jobs`). Todos os artefatos são locais (fora do Git).
- Capturas 1440/1024/768/390 das três (Edge headless): sem overflow horizontal, sem imagem quebrada, links de âncora + Maps (+ WhatsApp/tel na barbearia, que tinha telefone válido).
- Achados e correções: (1) telefone inválido gerava "Ligar para" sem número → o gerador só avisa o modelo de telefone válido (`normalizeWhatsappPhone`); (2) as três demos tinham o mesmo hero (foto de ponta a ponta + painel no canto) → guia V6 com 6 arquétipos `[foto-painel|colunas|tipografico|moldura|grade|cor-solida]` e `recentHeroIssue` recusa o arquétipo das 2 demos mais recentes de qualquer segmento (histórico V6 ordenado por `finishedAt`). **Validado com geração real**: "Restaurante Teste Sellora" v2 (site `fd67a0e7-bb3c-4830-b8b1-a90141c7fed4`, ~3 min) saiu com `[tipografico]` (fundo verde chapado, título gigante, foto em faixa), fontes Bricolage Grotesque + Source Serif 4, sem "Ligar para" (telefone inválido virou "Ver como chegar"), sem overflow e sem imagem quebrada nas 4 larguras.
- ZIP da clínica: 6 arquivos (3 WebP do Codex + HTML/CSS/JS) com SHA-256 idêntico aos gravados; `/api/demos/sites/<id>` devolve o conteúdo real.
- **Teste de UI (2026-11-12, 22h BRT):** perfil de navegador isolado (Edge headless, CRM com os leads fictícios de demonstração), lead "Oficina Motor Certo" → **Gerar demo e mensagem com IA** → geração real (site `562f0fac-…`, hero `colunas`) → **Leads → Demos → Revisar**: Prévia (Computador/Celular) e Código com lista de arquivos (3 WebP + HTML/CSS/JS), números de linha, destaque de sintaxe, Copiar código, Baixar arquivo e Baixar código ZIP. O quadro mostra "Imagens · Codex…" (sem Gemini).
- **Bug achado nesse teste e corrigido:** a auditoria em navegador real não rodava ("navegador real não executado"). O Edge 157 relança a si mesmo (o processo aberto sai em ~60 ms) e não escreve mais "DevTools listening" no stderr; além disso o `kill()` deixava o navegador órfão a cada geração. `qa-browser.ts` agora lê `DevToolsActivePort` no perfil e encerra, no Windows, os processos do perfil temporário. Teste real opcional: `SELLORA_LIVE_BROWSER=<pasta files de um site> npx vitest run src/lib/demos/v6/qa-browser.live.test.ts`.
- **Teste no `.exe`:** portátil recompilado, aberto com `--user-data-dir` isolado; geração V6 real "Pet Shop Teste Sellora" (site `dd4ed016-…`) concluída em ~2,7 min com imagens WebP (sharp nativo no utilityProcess), auditoria em navegador executada em 1440/1024/768/390 e capturas gravadas em `<userData>/demo-generator/sites`. Fechar a janela encerrou Sellora, Claw3D, adaptador e Edge (0 processos restantes).

### Missão 2 — Claw3D/Cloud 3D: funcional em desenvolvimento e no `.exe`
- Arquitetura e detalhes: `docs/CLAW3D_INTEGRATION.md`. Código em `integrations/claw3d/` (setup com commit fixado `51337f7`, adaptador de gateway, núcleo testado, launcher com proxy de enquadramento), `src/lib/agents/bridge.ts` (`claw3dScene`, rota `/api/agents/scene`), `src/components/views/cloud-3d-view.tsx` (iframe + painel), `desktop/main.mjs` (`startOffice`) e `desktop/build.mjs` (copia `integrations/claw3d`).
- Verificado: geração real da clínica acompanhada no escritório (running com o `runId` do job → idle); recarga no meio mantém estado; bridge instrumentado em Edge headless: start/progress/end/error corretos (`status=error` aplicado); reconexão do adaptador após reinício do dev server.
- Limitações: contador "working" do cabeçalho do Claw3D demora a voltar após o fim (travas de animação dele); `error` pode virar ocioso na sincronização de frota do Claw3D.
- `.exe` testado (resultados e memória em `docs/CLAW3D_INTEGRATION.md`). Aba Cloud 3D capturada em Edge headless: escritório conectado + painel com última tarefa, etapas, Abrir demo/lead.
- Pendente: preparar o Claw3D para o app empacotado sem terminal (botão com aprovação do administrador); medir GPU/CPU do renderizador com a cena aberta na janela do app.
- Atenção (dev): depois de editar `next.config.ts`/`tsconfig.json` ou rodar builds com o dev server aberto, o `next dev` antigo pode entrar em recarga em loop em qualquer página ("Carregando…"). Reiniciar o dev server resolve; não é bug da aba.

### Missão 3 — Gemini/Imagen removidos: concluída
- Removidos `gemini-server.ts` (+teste), seletor de imagem, status `gemini`, variáveis do `.env.example`, `.claude/skills/imagen` (local) e linha do `.gitignore`. Leitura legada de "gemini" mantida (`storedImageProviderSchema`); pedido novo com "gemini" vira Codex. README/DECISIONS/SKILLS_SETUP atualizados.

### Evidências desta sessão
- `npm test`: 208 testes (207 ok, 1 live pulado) antes do último lote; depois do lote de arquétipos, `src/lib/demos`: 53 ok. Lint e typecheck sem erros. `npm run build` ok.
- Commits: `631ab32`, `66fa771`, `a5bf0d7` (+ os posteriores a este documento; veja `git log`).

### Missão 4 — Publicação no Coolify + Coolify Deploy Agent (2026-11-13): implementada, testada com mocks
- Código em `src/lib/publishing/` (config, clientes Coolify/GitHub, serviço, store, estados), rotas `/api/publications` e `/api/publications/[leadId]`, painel `src/components/demos/demo-publication-panel.tsx` (dentro de `LeadDemoPanel`, só demos V6), resumo em `leads.demo.publication`, agente `coolify-deploy` no bridge e no adaptador do Claw3D. Guia: `docs/COOLIFY_INTEGRATION.md`.
- Testado: 13 testes do módulo (incluindo duplicidade, falha de deploy, conteúdo divergente, retomada), bridge e adaptador; API no build de produção (sem variáveis → 409 com a lista do que falta; agente ocioso); painel na ficha de um lead de teste (estado "Aguardando publicação", botão desativado, sem overflow em 375 px).
- **Não testado contra Coolify real**: não há VPS, domínio nem tokens. Próximo passo externo: seguir o procedimento do guia e publicar uma demo "… Teste Sellora".
- A aba Cloud 3D não pôde ser vista no painel do navegador embutido oculto (streaming não completa com o painel oculto); a API `/api/agents/agents` mostra os três agentes.

### Próxima ação exata
As três missões estão concluídas e testadas. Melhorias opcionais, nesta ordem:
1. Cloud 3D no app empacotado: botão "Preparar escritório 3D" na aba, que roda `setup.mjs --dir %APPDATA%/sellora/claw3d/app` só com aprovação explícita do administrador (baixa ~600 MB de dependências do Claw3D).
2. Persistir o estado de erro no escritório 3D (hoje o Claw3D pode voltar a "ocioso" na sincronização de frota).
3. Avaliar repetição de fontes entre segmentos no histórico V6 (Young Serif e Big Shoulders Display já apareceram duas vezes).

## Histórico anterior

### Estado da missão 1 (histórico de checkpoints)

- **Feito e enviado** (branch `feat/demo-generator-v6`): skills instaladas (`.claude/skills/`: Emil ×7, impeccable, design-taste-frontend, humanizer; ver docs/SKILLS_SETUP.md); skill canônica `.agents/skills/demo-generator-v6` (guia lido pelo app); `src/lib/demos/v6/` (schema, store imutável, zip, serve/CSP, prompts, images com WebP/sharp e fallback SVG, postprocess, qa-static, qa-browser via Edge+CDP, highlight, generator); rotas `/sites/[id]/[[...path]]` (pública, CSP sandbox), `/api/demos/sites/[id]` (código), `/zip`, `/preview`; `proxy.ts` libera `/sites/`; `generation-server.ts` usa V6 por padrão (`generator: "v6"`, telefone só para marcadores, linha do tempo `events`); modelo `version: 6` + `site`; `applyGeneratedLeadDemo` V6; capa, painel e canvas "Prévia | Código" com `CodeViewer`; build desktop copia a skill V6; eslint ignora skills de terceiros. 201 testes, lint e typecheck ok.
- **Em andamento**: geração real das 3 demos de teste (barbearia, restaurante, clínica odontológica, nomes "… Teste Sellora") com `scratchpad/v6-run.mjs` contra `npm run dev` na porta 3100; depois comparar capturas (`<dados>/sites/<id>/meta/shot-*.png`), conferir ZIP e ajustar o guia se as três parecerem variações do mesmo modelo.
- **Pendente na missão 1**: verificação visual do visualizador de código no navegador; `npm run build` + `npm run desktop:build` com teste no .exe; documentação final (README já tem a seção V6; DECISIONS registrada).

1. **Em execução — Sellora 2.0 / Demo Generator V6** (branch `feat/demo-generator-v6`): skills Emil Kowalski, Impeccable, Taste e Humanizer; gerador em etapas com código próprio por demo (index.html, styles.css, script.js, assets), imagens múltiplas com fallback, QA automático (estático + navegador real quando disponível), visualizador "Prévia | Código", ZIP portátil, snapshots imutáveis, demos antigas preservadas. Base já na branch: Claude Sonnet 5.5 para textos (esforço alto/médio), Gemini Nano Banana 2.1 opcional para imagens (sem chave configurada), Codex como alternativa.
2. **Na fila, só depois da missão 1 — Cloud 3D (Claw3D)**: aba "Cloud 3D" em `/dashboard/cloud-3d`; clonar iamlukethedev/Claw3D em diretório separado, conferir licença, README, ARCHITECTURE.md, docs/runtime-profiles.md, docs/multi-agent-beta.md e segurança; criar "Sellora Agent Bridge" (registro central de agentes reais, estados queued/running/waiting_approval/completed/failed/cancelled/offline, runtime `custom` com /health, /state, /registry conforme contrato real, SSE/WebSocket); primeira integração = gerador de demos com eventos reais de etapa; Claude Code (hooks) e Codex app-server opcionais; sem agentes fictícios; configurações sem credenciais; validar no Electron; documentar em `docs/CLAW3D_INTEGRATION.md`; branch própria.
3. **Na fila, só depois das missões 1 e 2 — Remover imagen-skill/Gemini e restaurar imagens pelo Codex**: o usuário não quer API paga para imagens. Remover a integração Gemini do fluxo (`src/lib/demos/gemini-server.ts`, `imageProvider` "gemini" como padrão, seletor "Imagem: Gemini", status `gemini` em `/api/demos/generator`, `GEMINI_API_KEY`/`SELLORA_GEMINI_IMAGE_MODEL` em `.env.example`, trechos do README/DECISIONS) e a pasta local `.claude/skills/imagen` + linha do `.gitignore` (dependências Python `google-genai`/`pillow` instaladas com `--user`: avaliar remoção sem afetar outros projetos). Codex volta a ser o único gerador de imagens, com o fallback gratuito existente; preservar V6, visualizador, ZIP, Claude nos textos, aprovação/recusa, histórico e Cloud 3D. A V6 já nasce usando Codex para imagens (sem Gemini como padrão). Testar sem afirmar geração real que não ocorreu. Não reverter commits inteiros.
