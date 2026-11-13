# Integração Claw3D (aba Cloud 3D)

Status em 2026-11-12 (noite): **escritório 3D conectado a execuções reais**, em desenvolvimento e no executável Windows. Testado com geração real de demo, bridge instrumentado em Edge headless e o `.exe` portátil.

## Arquitetura

```
Gerador de demos (jobs reais em <dados>/jobs)
        │  leitura a cada 2 s
        ▼
Sellora Agent Bridge  ── /api/agents/{health,state,registry,agents,events,scene}   (Next, requireAccess)
        │  SSE /api/agents/events (presence, agent start/progress/end/error, heartbeat)
        ▼
Sellora Gateway Adapter (integrations/claw3d/sellora-gateway-adapter.cjs, ws://127.0.0.1:18790 e [::1])
        │  protocolo de gateway do Claw3D: hello-ok, agents.list, chat.history, eventos agent/chat/presence
        ▼
Servidor do Claw3D (127.0.0.1:3191, proxy próprio injeta o token do adaptador do lado do servidor)
        ▼
Proxy de enquadramento do launcher (127.0.0.1:3190) ── só ajusta frame-ancestors para as origens locais da Sellora
        ▼
Aba /dashboard/cloud-3d: iframe do escritório + painel lateral da Sellora (status, etapas, histórico, abrir demo/lead)
```

Por que um adaptador de gateway e não o runtime `custom`: no `custom` os estados visuais só nascem de conversas iniciadas pelo próprio Claw3D. O pipeline real do Claw3D (`gatewayRuntimeEventHandler` → `resolveLifecyclePatch`) consome eventos `agent` com `stream: "lifecycle"`. O adaptador fala esse protocolo (o mesmo do `server/demo-gateway-adapter.js` do upstream) e o Claw3D se conecta a ele como `adapterType: "demo"`, **sem nenhum arquivo do Claw3D alterado**.

## Versionamento (reprodutível)

- Tudo o que é da Sellora está em `integrations/claw3d/` (versionado):
  - `claw3d.lock.json`: upstream `https://github.com/iamlukethedev/Claw3D.git`, commit `51337f7` (2026-11-05), licença MIT. O upstream não tinha commits novos em 2026-11-12.
  - `setup.mjs`: clona o upstream no commit fixado em `~/.sellora/claw3d/app` (fora do repositório), confere a licença MIT, roda `npm ci`, copia o adaptador para `server/` e faz `npm run build`.
  - `sellora-gateway-core.cjs` (tradução, testável) e `sellora-gateway-adapter.cjs` (servidor WebSocket).
  - `launcher.mjs`: sobe adaptador + Claw3D + proxy de enquadramento; usado em desenvolvimento e pensado para o Electron.
  - `sellora-gateway-core.test.ts`: 7 testes (incluídos no `npm test`).
- Não há fork no GitHub: a cópia do Claw3D é descartável e recriada pelo setup. Licença e atribuição do Claw3D ficam no próprio checkout (LICENSE MIT, autores originais); a Sellora não redistribui o código do Claw3D no repositório.

## Como rodar (desenvolvimento)

```bash
node integrations/claw3d/setup.mjs          # uma vez (~1 min de npm ci + build)
npm run dev -- --port 3100                  # Sellora
node integrations/claw3d/launcher.mjs       # escritório em http://127.0.0.1:3190/office
```

`SELLORA_BRIDGE_URL` (padrão `http://127.0.0.1:3100`), `SELLORA_CLAW3D_DIR`, `SELLORA_CLAW3D_STATE`, `SELLORA_CLAW3D_PORT` ajustam o launcher. Na Sellora, `SELLORA_CLAW3D_URL` (padrão `http://127.0.0.1:3190`) diz onde procurar a cena; `/api/agents/scene` informa se ela está no ar.

## Segurança

- Adaptador, Claw3D e proxy escutam só em loopback; o adaptador recusa conexões de fora do loopback e `SELLORA_BRIDGE_URL` precisa ser local.
- Token aleatório por sessão (24 bytes) exigido no `connect` do adaptador. Fica só no `settings.json` privado do Claw3D (`~/.sellora/claw3d/state/claw3d/`); o proxy do Claw3D o injeta do lado do servidor e o `/api/studio` não o devolve ao navegador.
- O Claw3D roda com `UPSTREAM_ALLOWLIST=127.0.0.1,localhost` e sem chaves de API no ambiente (o launcher remove `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`).
- Somente observação: o adaptador recusa `chat.send`, `agents.create/update/delete`, `config.set/patch`, `cron.*`, `sessions.patch/reset`, `exec.approvals.set` e `agents.message/handoff` (`read_only`). Nada inicia, altera ou cancela execuções da Sellora.
- O proxy de enquadramento só troca `frame-ancestors` (origens `localhost`/`127.0.0.1` nas portas 3100, 3102 e 3187), remove `X-Frame-Options` e `upgrade-insecure-requests` (página http local). Conteúdo e demais cabeçalhos passam intactos.

## Mapeamento de estados

| Sellora (bridge) | Claw3D |
| --- | --- |
| `presence` (registro completo) | `presence`; se houver execução ativa, `lifecycle start` + texto da etapa (retoma após reconexão) |
| `agent start` | `lifecycle start` + `assistant` "Estabelecimento · etapa" (balão sobre o personagem) |
| `agent progress` | `assistant` com a nova etapa |
| `agent end` (demo para revisão humana) | `chat final` "Concluído, aguardando revisão humana" + `lifecycle end` → ocioso |
| `agent error` / job interrompido | só `lifecycle error` → estado de erro; o motivo fica no histórico |
| cliente novo/recarga | replay único após o primeiro `agents.list` |

Detalhes que o código do Claw3D exige (descobertos nos testes): numeração `seq` contínua **por conexão** (saltos disparam reconciliação e resetam estados); durante a execução o `chat.history` termina na mensagem do pedido (role `user`), senão o Claw3D conclui que a execução acabou; `chat error` antes do `lifecycle error` faz o erro ser ignorado.

## Testes executados (2026-11-12)

- Unidade: `src/lib/agents/bridge.test.ts` (3) e `integrations/claw3d/sellora-gateway-core.test.ts` (7).
- Execução real: geração V6 "Clínica Odontológica Teste Sellora" com o escritório aberto; o agente "Gerador de Demos" apareceu como `running` com o balão da etapa real. Recarregar a página no meio da execução manteve o estado (replay).
- Execução instrumentada (bridge falso em scratchpad, Edge headless via CDP): start → `running`; progress → continua `running`; end → `status=idle`; error → `status=error` e contador "1 error".
- Desconexão: reiniciar o dev server derrubou o SSE; o adaptador reconectou sozinho e marcou a execução interrompida (job órfão vira `cancelled` no bridge).

- Executável Windows (`npm run desktop:build`, portátil de 124 MB) aberto com `SELLORA_CLAW3D_DIR=%USERPROFILE%/.sellora/claw3d/app`: o Electron subiu Sellora (127.0.0.1:3187), proxy do escritório (127.0.0.1:3190), Claw3D (127.0.0.1:3191) e adaptador (127.0.0.1/::1:18790), conectado ao bridge do próprio app; `/api/agents/scene` = disponível e conectado; o escritório mostrou o agente "Gerador de Demos" com o histórico real do app (nos primeiros ~25 s de um perfil novo aparece o marcador "Main" do Claw3D até a lista de agentes carregar). Memória em repouso: servidor Sellora 115 MB, processo principal 105 MB, servidor Claw3D 133 MB, adaptador 77 MB (CPU < 1 s cada). Fechar a janela encerrou todos os processos e liberou as quatro portas. Não medido: GPU/CPU do renderizador com a cena aberta dentro da janela do app.
- `setup.mjs` validado do zero (clone novo em `~/.sellora/claw3d/app`, npm ci, build) depois de corrigir o checkout de clone `--no-checkout`.

## Andar fixo da Sellora

O Claw3D tem vários "andares" (Lobby, OpenClaw, Hermes…). Só o **Lobby** (provider `demo`) está ligado ao adaptador da Sellora. Observado no `.exe` em 2026-11-12: depois de uma falha de conexão, o Claw3D trocou sozinho para o andar OpenClaw, mostrou a tela "Remote gateway" pedindo um servidor OpenClaw e gravou essa escolha, apagando o token do perfil `demo`. Correção: `writeStudioSettings` (launcher) mescla o `settings.json` existente e fixa gateway `demo` + token da sessão + `activeFloorId: "lobby"`, na abertura do app **e** a cada entrada pela aba (`/__sellora/office`). Testado no `.exe`: arquivo desviado de propósito, aba reaberta → "DEMO • CONNECTED", Lobby, 1 agente, preferências preservadas. Testes em `integrations/claw3d/launcher.test.ts`.

## Limitações conhecidas

- Checkout e estado do Claw3D ficam **fora** do repositório (`~/.sellora/claw3d/`; no app empacotado, `%APPDATA%/sellora/claw3d/`). Dentro do projeto, o `settings.json` que o Claw3D grava ao conectar fazia o dev server do Next recarregar a aba Cloud 3D em loop (o iframe gravava de novo a cada recarga).

- O contador "working" do cabeçalho do Claw3D pode continuar marcando o agente por alguns segundos depois do fim (travas de animação do próprio Claw3D: `workingUntilByAgentId`, permanência na mesa). O estado do agente (`status=idle`) muda na hora.
- O estado `error` pode voltar a ocioso quando o Claw3D sincroniza a frota (`loadAgents` disparado por `presence`/`heartbeat`, com intervalo mínimo de 3 s). A falha continua registrada no histórico do agente no Claw3D e, de forma persistente, no painel lateral da Sellora.
- No painel de navegador embutido do app Claude, quando oculto, o Chrome limita timers e o Claw3D demora para conectar; em navegador normal/headless conecta em segundos.
- O Claw3D mostra seus próprios menus (Kanban, Marketplace, Chat). O chat não executa nada: o adaptador recusa os métodos de escrita.

## Falta fazer

1. **Electron**: integrado (`startOffice` em `desktop/main.mjs`) e testado no `.exe` com Claw3D já preparado. Falta: preparar o Claw3D para o app empacotado sem terminal (hoje: `node integrations/claw3d/setup.mjs --dir %APPDATA%/sellora/claw3d/app` ou `SELLORA_CLAW3D_DIR`); o Claw3D não vai dentro do instalador (centenas de MB). Recomendado: botão "Preparar escritório 3D" na aba, com aprovação do administrador.
2. Persistir o estado `error` no escritório (exigiria mudança no Claw3D ou um agente de status separado).
3. Coletores opcionais (hooks do Claude Code, eventos do `codex app-server`): não implementados; a Prospecção (OpenStreetMap, sem IA generativa) não é apresentada como agente.
