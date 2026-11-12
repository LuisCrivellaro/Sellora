# Integração Claw3D (aba Cloud 3D)

Status em 2026-11-12: **em andamento**. O lado Sellora da ponte está implementado e testado por unidade. A visualização 3D ainda não foi integrada. Este documento separa o que existe do que falta.

## O que é o Claw3D

- Repositório oficial: https://github.com/iamlukethedev/Claw3D, analisado no commit `51337f7` (2026-11-05), licença MIT (manter LICENSE e atribuição em qualquer fork ou reuso).
- Next.js 16.1, React, Three.js / React Three Fiber, 17 dependências diretas. É uma camada de visualização e interação; **não executa agentes**. Conecta-se a runtimes externos (OpenClaw, Hermes, `local`, `claw3d`, `custom`).
- Cópia de referência fora do repositório da Sellora: `C:\Projetos\Claw3D-referencia` (não versionada).

## Agentes reais da Sellora (sem fictícios)

| Agente | Existe? | Observação |
| --- | --- | --- |
| Gerador de Demos | Sim | Um job por vez (`src/lib/demos/generation-server.ts`). Executores: Claude Code (`claude -p`, Sonnet 5.5) para briefing e código; Codex `app-server` para imagens; Edge headless para a auditoria. As etapas são do mesmo agente, não agentes separados. |
| Prospecção IA | Executor, não agente generativo | OpenStreetMap + verificação HTTP, sem IA generativa. Pode ser representado depois como worker, se fizer sentido. |
| Claude Code / Codex de desenvolvimento | Opcional | Exige coletor de hooks (Claude Code) ou eventos do `app-server`; ainda não implementado. |

## Contrato real do runtime `custom` (verificado no código do Claw3D)

O Claw3D chama o runtime por um proxy próprio (`POST /api/runtime/custom` com `{ runtimeUrl, pathname, method, body }`) e consome:

- `GET /health`: `{ ok, status }` ou texto.
- `GET /state`: `{ runtime: { name, version, vendor, status, active_model }, profile, active: { <papel>: "<modelo>" | [..] }, identity }`. Os agentes vêm de `active` (ou de `identity`).
- `GET /registry`: `{ models: { <id>: … } }`.
- `POST /v1/chat/completions` (formato OpenAI) e `agents.message`/`agents.handoff`.

**Limitação:** os estados visuais (`running`, `idle`, `error`) vêm de eventos `agent` do gateway (`resolveLifecyclePatch`: `phase` start/fim/error com `runId`) e de `presence`/`heartbeat`. No runtime `custom` esses eventos só nascem de conversas iniciadas pelo próprio Claw3D. Implementar só `/state` e `/registry` mostraria o agente parado durante uma geração real. Por isso é preciso um provider `sellora` no Claw3D que assine os eventos da Sellora.

## Sellora Agent Bridge (implementado, branch `feat/cloud-3d`)

- Código: `src/lib/agents/bridge.ts`, rota `src/app/api/agents/[resource]/route.ts`, testes em `src/lib/agents/bridge.test.ts`.
- Acesso: `requireAccess` (só localhost no modo local; sessão autenticada com Supabase). Só leitura: nenhuma rota inicia, altera ou cancela execuções.
- Endpoints: `/api/agents/health`, `/api/agents/state`, `/api/agents/registry` (formato do runtime `custom`); `/api/agents/agents` (registro detalhado: status, execução atual com etapa, negócio, runtime, início, última atualização, eventos, erro, `siteId`, `leadId`); `/api/agents/events` (SSE: `presence`, `agent` com `phase` start/progress/end/error e `runId` = id do job, `heartbeat`).
- Fonte de verdade: os jobs gravados em `<dados>/jobs/*.json`, que o gerador atualiza a cada etapa com horário real (`events`, `startedAt`, `finishedAt`). Estados: `running` só se o job está ativo neste processo; job "running" de um processo encerrado aparece como `cancelled`; conclusão aparece como `waiting_approval` (a demo vai para revisão humana); falha como `failed`. Não há porcentagem de progresso: a etapa atual é mostrada como texto.

## Falta fazer

1. Provider `sellora` num fork do Claw3D, consumindo `/api/agents/events` e emitindo eventos `agent`/`presence` no pipeline existente (sem chat).
2. Executar o Claw3D como serviço local gerenciado pelo Electron (porta local fixa, só 127.0.0.1, token por sessão, encerramento junto com o app) e medir CPU/memória do Three.js.
3. Aba **Cloud 3D** em `/dashboard/cloud-3d` com a visualização + painel da Sellora (status, eventos, abrir demo pelo `siteId`, abrir lead pelo `leadId`, configurações sem credenciais).
4. Coletores opcionais: hooks do Claude Code (SessionStart/Stop, SubagentStart/Stop, Pre/PostToolUse, sem prompts completos) e eventos do `codex app-server` do processo que a Sellora já usa.
5. Testes 1–9 da missão (carregamento, conexão real, geração, conclusão, falha, desconexão, segurança, desktop, compatibilidade).

## Testes executados até agora

- Unidade: registro sem jobs (agente parado, nenhum fictício), job ativo × órfão, eventos start → progress → end (`waiting_approval`, com `siteId` e `leadId`) e error. 206 testes da suíte passando.
- Não testado: Claw3D rodando, SSE consumido por um cliente real, Electron.
