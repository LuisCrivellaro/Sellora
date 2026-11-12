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
- **imagen** (tysszl/imagen-skill): sem licença, local e fora do git. Remoção agendada (ver AI_HANDOFF, missão 3).

## Origem e manutenção

- Local Client Prospector: upstream `Kappaemme-git/local-client-prospector-skill`, commit `2340d02`, licença MIT; adaptações e auditoria em seu ORIGEM.md.
- Modernizar Sites Locais: skill local do usuário, com dois guias e dois scripts Node.
- Unique Site Designer: fornecida pelo usuário, incorporada após aprovação. Conceitos e evidências em DEMO_DESIGN_HISTORY; mídias/fontes e licenças em public/demos/unique.

Antes de adicionar outra skill, confira fonte, licença, scripts, dependências e hooks. Preserve o escopo autorizado e registre decisões relevantes. Não instale pacotes ou cadeias de skills apenas porque aparecem como referência nos guias.
