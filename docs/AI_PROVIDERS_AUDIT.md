# Auditoria: portabilidade das integrações Claude e Codex

Data: 2026-11-13. Escopo: diagnóstico e arquitetura recomendada. **Nenhuma mudança de código foi feita por esta auditoria.**
Legenda: **[confirmado]** visto no código ou nesta máquina · **[inferido]** dedução não reproduzida em outro computador.

## 1. Como funciona hoje

| Ponto | Claude | Codex |
| --- | --- | --- |
| Mecanismo | CLI do **Claude Code** em modo não interativo (`claude -p --output-format json --json-schema … --tools "" --safe-mode --no-session-persistence --model claude-sonnet-5-5 --effort high/medium`), um processo por chamada. `src/lib/demos/claude-server.ts` [confirmado] | **`codex app-server`** (JSON-RPC por stdin/stdout), com shell, exec, code mode e MCP desligados; gera textos (opcional) e as **imagens** pela ferramenta nativa do ChatGPT. `src/lib/demos/codex-server.ts` [confirmado] |
| Autenticação | Sessão OAuth da **assinatura Claude** do usuário (`claude auth login`). O app exige `authMethod === "claude.ai"` e **remove** `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN` do ambiente do processo para não cobrar por API [confirmado] | Sessão da **conta ChatGPT** no Codex (`account/read` precisa responder `type: "chatgpt"`) e capacidade `imageGeneration` [confirmado] |
| Onde ficam as credenciais | Perfil do usuário no computador (gerenciadas pelo Claude Code; nesta máquina, `~/.claude/` sem arquivo de credencial visível, provavelmente no cofre do Windows) [confirmado/inferido] | `~/.codex/auth.json` (gerenciado pelo Codex) [confirmado] |
| Como o executável é encontrado | `SELLORA_CLAUDE_PATH` → PATH procurando **`claude.exe`** → `~/.local/bin/claude.exe` → cópia do app Claude em `%APPDATA%\Claude\claude-code\<versão>\<build>\claude.exe` [confirmado] | `SELLORA_CODEX_PATH` → PATH procurando **`codex.exe`** → extensões `openai.chatgpt-*` do VS Code, Cursor ou Antigravity (só Windows) [confirmado] |
| Nesta máquina | Encontrado só pela cópia do app Claude (2.1.321) | Encontrado só pela extensão do VS Code (`openai.chatgpt-26.1106.51428`); `codex` não está no PATH [confirmado] |

**Seletor de provedores** (`src/lib/demos/generation-client.ts`): preferência `textProvider` (Claude padrão, Codex opcional) salva no `localStorage` do navegador (`sellora-demo-text-provider-v2`) e fixada em cada item da fila. Imagem é sempre Codex, com composição SVG gratuita quando ele falta. `canGenerateDemos` libera o botão só se o provedor de texto escolhido estiver disponível segundo `GET /api/demos/generator`, que roda `claude auth status` e `account/read` do Codex a cada consulta.

**Execução no backend** (`/api/demos/jobs` → `generation-server.ts` → `v6/generator.ts`): o servidor Next local inicia o job em memória (`globalThis.selloraDemoJobs`), grava o andamento em `<dados>/jobs/<id>.json`, cria um espaço de trabalho em `<dados>/workspace/<id>`, chama os CLIs como subprocessos e grava o site em `<dados>/sites/<id>`. O navegador consulta o job a cada 1,5 s e aplica o resultado no lead. As rotas recusam qualquer host que não seja `localhost` (`requireLocalDemoAccess`). Uma geração por vez.

## 2. O que é versionado e o que depende da máquina

| Versionado no GitHub | Só na máquina local |
| --- | --- |
| Código do gerador, prompts, schemas Zod | Instalação do Claude Code (ou app Claude) e do Codex (CLI ou extensão de editor) |
| Guias canônicos `.agents/skills/demo-generator-v6` e `unique-site-designer` (lidos a cada geração) | Logins: assinatura Claude e conta ChatGPT de cada pessoa |
| `.env.example`, `.claude/launch.json`, migrations, docs | `.env.local` (inclui `PROSPECCAO_EXECUTOR=osm`; sem ele a Prospecção fica desligada) |
| Skills de sessão em `.claude/skills/` (exceto assets do Taste) | `<dados>` = `.sellora-data/` (dev) ou `%APPDATA%/sellora/demo-generator` (app): jobs, sites V6, imagens, publicações |
| | CRM no `localStorage` do navegador/perfil (modo demonstração) |
| | Edge/Chrome para a auditoria em navegador real; checkout do Claw3D em `~/.sellora/claw3d` |

Nenhuma credencial está no repositório: ponto positivo que deve ser mantido.

## 3. Causas encontradas para "não conecta no outro computador"

1. **Descoberta frágil dos executáveis** [confirmado no código; efeito inferido]. O código só procura `claude.exe`/`codex.exe`. Instalações via npm global (`npm i -g @anthropic-ai/claude-code`, `npm i -g @openai/codex`) criam *shims* `claude.cmd`/`codex.cmd`, que não são encontrados. E, mesmo apontando `SELLORA_*_PATH` para um `.cmd`, o `spawn` sem `shell` do Node recusa `.cmd/.bat` no Windows desde a correção de segurança de 2024 (EINVAL). Só funcionam a cópia do app Claude, o instalador nativo (`~/.local/bin`) e a extensão ChatGPT de VS Code/Cursor/Antigravity. Fora do Windows, só o PATH.
2. **Login diferente do esperado** [confirmado no código]. Claude logado por API key/Console (`authMethod` ≠ `claude.ai`) aparece como indisponível. Codex logado com API key (`type` ≠ `chatgpt`) aparece desconectado; conta sem geração de imagem deixa o Codex "conectado, mas sem imagem".
3. **Mensagens genéricas** [confirmado]. O `stderr` dos CLIs é descartado e os erros viram "Instale…" ou "Não foi possível iniciar…". Não há como saber, pela interface, se faltou o executável, o login, a versão ou a permissão.
4. **Configuração local não versionada** [confirmado]. `.env.local` não vai ao Git (correto), mas não há verificação de ambiente: quem clona não sabe que precisa de `PROSPECCAO_EXECUTOR=osm` nem dos caminhos opcionais.
5. **Dados presos ao computador** [confirmado]. Leads (localStorage), demos V6, imagens e publicações ficam na máquina onde foram criados. Em outro computador, a demo aberta de um lead importado responde 404 em `/sites/<id>`. Isso não é falha de provedor, mas é percebido como "não funciona no outro computador".
6. **App desktop herda o PATH do momento em que foi aberto** [inferido]. Instalar o CLI com o app aberto exige reabrir.

## 4. Alternativas comparadas

| Critério | A. CLIs com login individual (atual, endurecido) | B. APIs oficiais (Anthropic + OpenAI) no backend | C. Execução centralizada (máquina/VPS que roda o gerador) |
| --- | --- | --- | --- |
| Custo | Incluído nas assinaturas de cada pessoa; cotas por pessoa | Por uso (tokens e imagens). **Conflita com a decisão de 2026-11-12: nenhuma API paga de imagem** | Servidor + (se usar API) consumo; com CLIs, exige uma conta por serviço central |
| Portabilidade | Exige instalar e logar em cada máquina | Só a chave no servidor | Total para os devs (só acessam o serviço) |
| Capacidade/comportamento | Igual ao validado hoje: `--json-schema`, esforço, Codex com ferramenta de imagem nativa e QA no navegador local | Texto: Messages API com saída estruturada e esforço equivalentes ao CLI, **sem** agentes nem limites da assinatura. Imagem: API de imagens da OpenAI, outro modelo/qualidade e preço; exige revalidar o guia V6 | Igual a A ou B, conforme o motor do servidor |
| Segurança | Credenciais no perfil de cada pessoa, fora do repo | Chaves só no servidor, nunca no frontend; precisa de limite de gasto | Abrir o gerador para a rede exige autenticação real (hoje é só localhost) e um armazenamento compartilhado |
| Riscos | Termos de uso das assinaturas para automação (conferir), quebra por mudança de CLI | Gasto fora de controle sem limites; mudança de qualidade | Compartilhar login pessoal entre pessoas tende a violar termos; mais infraestrutura |

## 5. Arquitetura recomendada

**Camada de provedores no backend, com A como padrão hoje e B plugável depois**, sem mudar o fluxo nem o seletor:

```
UI (seletor Claude | Codex | …)  ── só nomes de provedor, nunca credenciais
        ▼
/api/demos/providers (status por provedor: instalado? logado? capacidades? motivo exato)
        ▼
ProviderRegistry (src/lib/ai/registry.ts)
  TextProvider:  claude-code-cli · codex-app-server · [anthropic-api] · [openai-api]
  ImageProvider: codex-app-server · svg-fallback · [openai-images-api]
        ▼
Configuração compartilhada versionada: config/ai-providers.json (padrões, modelos, esforço, timeouts, ordem de fallback — sem segredos)
Configuração local: .env.local / cofre do SO (caminhos, chaves de API se um dia houver)
```

- **Interface única** (`generateStructured(input, schema, effort)`, `generateImage(prompt, aspect)`, `status()`) que o `ClaudeWriter` e o `LocalCodex` já quase implementam; o gerador V6 passa a depender só da interface. Novos provedores entram pelo registro.
- **Descoberta robusta**: aceitar `.exe`, `.cmd` (via `cmd.exe /d /s /c` com argumentos escapados ou chamando o `node` + script do pacote), `where`/`which`, caminhos do app Claude e das extensões; registrar a origem encontrada e a versão (`--version`).
- **Diagnóstico**: `npm run doctor` (script Node versionado) que confere Node, dependências, executáveis, login (`claude auth status`, `account/read`), capacidade de imagem, navegador para QA e variáveis do `.env.local`, com instruções exatas. O mesmo resultado aparece no quadro do gerador, com motivos específicos.
- **Credenciais**: continuam fora do Git; APIs (se adotadas) só com chave no servidor, limite de gasto e rótulo de custo na interface; nada de chave no app empacotado sem decisão explícita.
- **Dados compartilhados** (para os dois devs verem os mesmos leads e demos): Supabase já previsto para o CRM; os arquivos das demos V6 iriam para um armazenamento compartilhado (Supabase Storage ou o próprio repositório de demos da publicação no Coolify). Sem isso, mesmo com os provedores funcionando, cada máquina vê só os seus dados.
- **C só depois**: quando o volume justificar, um worker central com **contas/chaves de serviço** (não logins pessoais) e autenticação real.

## 6. Plano de implementação (para aprovação)

1. `src/lib/ai/` com interfaces e registro; adaptar `ClaudeWriter`/`LocalCodex` como adaptadores, sem mudar prompts nem resultados (testes de regressão do gerador V6 iguais).
2. Descoberta robusta + suporte a `.cmd` + versão detectada; testes unitários por plataforma com caminhos simulados.
3. `/api/demos/providers` com motivos específicos; quadro do gerador mostra o motivo exato; seletor lê a lista do registro (mantém Claude/Codex).
4. `config/ai-providers.json` versionado + validação Zod; `.env.example` com as variáveis opcionais.
5. `scripts/doctor.mjs` + `npm run doctor`; `docs/SETUP_NEW_MACHINE.md` (instalar Node, `npm ci`, Claude Code nativo ou app Claude + `claude auth login`, Codex CLI/extensão + login ChatGPT, Edge/Chrome, `.env.local`, `npm run doctor`).
6. (Separado, decisão do usuário) adaptadores de API oficiais com limite de gasto; (separado) dados compartilhados via Supabase.

Critérios de aceite: um segundo computador limpo, seguindo só o guia, chega a "Claude disponível / Codex disponível" no quadro, ou recebe do `doctor` o motivo exato; nenhum segredo no Git ou no navegador; demos geradas iguais às atuais nos testes.

## 7. Riscos

- Termos de uso: automatizar geração com assinaturas pessoais (Claude, ChatGPT) deve ser conferido nos termos vigentes antes de escalar. Compartilhar um login entre pessoas não é recomendado.
- Mudanças nos CLIs (flags, formato JSON, protocolo do `app-server`) quebram a integração sem aviso; o `doctor` e os testes de contrato reduzem o tempo de diagnóstico.
- APIs pagas sem limite de gasto; a decisão atual do projeto as exclui para imagens.
- Dados locais: sem armazenamento compartilhado, os dois desenvolvedores continuarão vendo CRMs e demos diferentes.
