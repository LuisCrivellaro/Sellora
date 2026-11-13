# Skills do Sellora

Inventário do repositório atualizado em 2026-11-12. Skills externas variam por conta e sessão; confira o catálogo ativo em vez de presumir instalação.

## Skills versionadas

| Skill em .claude/skills | Uso |
| --- | --- |
| dashboard-builder | Implementação de módulos do dashboard |
| design-review | Revisão visual e de interação |
| quality-assurance | Verificações e relato de evidências |
| prompt-architect | Prompts para agentes |
| lead-research | Pesquisa e qualificação de leads |
| local-client-prospector | Critérios de prospecção HOT/WARM/LOW/SKIP |
| website-audit | Diagnóstico de presença digital |
| modernizar-sites-locais | Diagnóstico por URL, prévia e comparativo visual |
| unique-site-designer | Demos com composição, textos e imagens próprios |
| sales-strategy | Abordagem consultiva e follow-up |
| proposal-writer | Propostas comerciais |
| website-builder | Sites com briefing aprovado |

Escolha apenas as skills pertinentes à tarefa. Os arquivos orientam os agentes; sua presença não torna cada habilidade uma funcionalidade do aplicativo.

## Skill executada pelo aplicativo

Unique Site Designer tem fonte canônica em `.agents/skills/unique-site-designer/` e espelho em `.claude/skills/unique-site-designer/` para Claude Code. Mantenha SKILL.md e references iguais nos dois diretórios. O build Windows empacota somente a fonte canônica.

O gerador v5 lê SKILL.md, references/fluxo-sellora.md e references/validacao.md a cada geração. `generation-server.ts` aplica o fluxo e as validações; `codex-server.ts` usa o Codex local autenticado com ChatGPT; `generation-client.ts` coordena a fila. A geração começa por ação do administrador, usa os limites/créditos do plano e retorna à revisão. Detalhes no README e no guia da skill.

Modernizar Sites Locais foi copiada da instalação local a pedido do usuário. Seus scripts de captura/comparação exigem Playwright ou Playwright Core com Chromium compatível. Ela orienta tarefas assistidas por agente e não é chamada pelo gerador v5. Não use o endereço de exemplo como lead real.

## Skills de frontend do gerador V6 (instaladas em 2026-11-12)

Instaladas copiando as pastas dos repositórios oficiais para `.claude/skills/`, sem executar instaladores nem scripts. Os comandos documentados (`npx skills@latest add …`, `npx impeccable install`) baixam e executam pacotes npm e criam links simbólicos, que dão problema no Windows. A cópia direta dá o mesmo resultado para o Claude Code, que reconheceu todas as skills na sessão.

| Skill (pasta) | Repositório · commit · licença | Objetivo na Sellora |
| --- | --- | --- |
| emil-design-eng, animate, review-animations, improve-animations, animation-performance, mobile-native, break-ui | emilkowalski/skills · f7ce8c0 · MIT | Movimento com propósito: curvas, durações, resposta ao toque, desempenho, ajustes de celular e testes de casos extremos |
| impeccable | pbakaus/impeccable · b4bff16 · Apache-2.0 (LICENSE e NOTICE.md na pasta) | Piso de qualidade visual, critique/audit/polish/harden/typeset/layout/adapt |
| design-taste-frontend | leonxlnx/taste-skill · f6b7657 · MIT | Direção de arte por tipo de negócio, fotografia, seções, texto sem cara de IA |
| humanizer | blader/humanizer · b48c832 · MIT | Remover padrões de texto de IA de títulos, chamadas e mensagens |

- **Taste:** `assets/` (34 MB de fotos, ícones, efeitos) fica fora do git. Para restaurar: clone `leonxlnx/taste-skill` e copie `skills/taste-skill/assets` para `.claude/skills/design-taste-frontend/assets`. O SKILL.md declara um hook `Stop` que roda `scripts/gate.mjs` (Node + Chrome/Edge) quando a skill é usada numa sessão do Claude Code.
- **Impeccable:** o CLI (`scripts/impeccable.cmd`) baixa um binário na primeira execução. Ele não foi executado. `init` e `live` são interativos e não foram rodados; não há PRODUCT.md/DESIGN.md do Impeccable no projeto.
- **Uso automático x interativo:** nas sessões do Claude Code, as skills ficam disponíveis por nome (`/impeccable audit`, `/humanizer` etc.). O gerador do aplicativo não executa skills: ele roda o Claude Code com `--safe-mode` e sem ferramentas, ou o `codex app-server` com skills e MCP desligados. Instalar uma skill no Claude Code não a torna disponível ao `codex app-server`.
- **Integração real com o gerador:** as regras pertinentes das quatro skills foram adaptadas, com atribuição, em `.agents/skills/demo-generator-v6/references/guia-de-criacao.md`. O app envia esse guia como instrução de sistema a cada geração V6 e mede o que consegue em `src/lib/demos/v6/qa-static.ts` e `qa-browser.ts`. Os checkers originais (gate do Taste, detector do Impeccable) não rodam dentro do app.
- **demo-generator-v6:** skill do projeto (fonte canônica em `.agents/skills/`, espelho em `.claude/skills/`), empacotada no Windows pelo `desktop/build.mjs`.
- **imagen** (tysszl/imagen-skill): **removida em 2026-11-12** (pasta local `.claude/skills/imagen`, nunca versionada, sem licença), junto com a integração paga do Gemini no app. Imagens só pelo Codex, com fallback SVG gratuito.

## Origem e manutenção

- Local Client Prospector: upstream `Kappaemme-git/local-client-prospector-skill`, commit `2340d02`, licença MIT; adaptações e auditoria em seu ORIGEM.md.
- Modernizar Sites Locais: skill local do usuário, com dois guias e dois scripts Node.
- Unique Site Designer: fornecida pelo usuário, incorporada após aprovação. Conceitos e evidências em DEMO_DESIGN_HISTORY; mídias/fontes e licenças em public/demos/unique.

Antes de adicionar outra skill, confira fonte, licença, scripts, dependências e hooks. Preserve o escopo autorizado e registre decisões relevantes. Não instale pacotes ou cadeias de skills apenas porque aparecem como referência nos guias.

## Auditoria de 2026-11-12 (noite)

Verificado nesta máquina (Windows 11, Node 24.15.0, npm 11.12.1, Git 2.55, Claude Code 2.1.321 da cópia do app Claude em `%APPDATA%/Claude/claude-code`, Codex da extensão `openai.chatgpt-26.1106.51428` do VS Code; nenhum dos dois no PATH, o app os encontra pelos caminhos conhecidos):

| Skill | Instalada | Claude Code (sessão) | Dentro do gerador da Sellora |
| --- | --- | --- | --- |
| emil-design-eng, animate, improve-animations, animation-performance, mobile-native, break-ui | Sim (SKILL.md + LICENSE MIT) | Disponíveis por nome | Regras adaptadas no guia V6 (seção 5) |
| review-animations | Sim | Só pelo usuário (`/review-animations`): o frontmatter tem `disable-model-invocation: true` | Regras adaptadas no guia V6 |
| impeccable | Sim (LICENSE Apache-2.0, NOTICE) | Disponível | Regras no guia V6 (seção 6); o CLI/detector não roda no app |
| design-taste-frontend | Sim, com `assets/` local (37 MB, fora do git) | Disponível; hook `Stop` roda `scripts/gate.mjs` quando a skill é usada | Regras no guia V6 (seções 2 e 4); o gate não roda no app |
| humanizer | Sim (MIT) | Disponível | Regras no guia V6 (seção 4) |
| demo-generator-v6 | Sim; `.agents` e `.claude` idênticos (`diff -rq`) | Disponível | **Lida a cada geração** por `src/lib/demos/v6/prompts.ts` (`guia-de-criacao.md`) e empacotada pelo `desktop/build.mjs` |
| unique-site-designer | Sim; espelhos idênticos | Disponível | Lida pelo gerador v5 |
| Skills próprias (dashboard-builder, design-review, quality-assurance, prompt-architect, lead-research, local-client-prospector, website-audit, modernizar-sites-locais, sales-strategy, proposal-writer, website-builder) | Sim | Disponíveis | Não são executadas pelo app |

Os assets do Taste não são necessários ao gerador (ele não lê `assets/`); só servem a sessões interativas do Claude Code. Para restaurá-los em outra máquina: clonar `leonxlnx/taste-skill` e copiar `skills/taste-skill/assets`. O gerador continua sem depender de nenhuma skill em tempo de execução além do guia V6 versionado: o Claude Code roda com `--safe-mode`, sem ferramentas, e o `codex app-server` sem skills/MCP.
