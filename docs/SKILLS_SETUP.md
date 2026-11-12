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

## Origem e manutenção

- Local Client Prospector: upstream `Kappaemme-git/local-client-prospector-skill`, commit `2340d02`, licença MIT; adaptações e auditoria em seu ORIGEM.md.
- Modernizar Sites Locais: skill local do usuário, com dois guias e dois scripts Node.
- Unique Site Designer: fornecida pelo usuário, incorporada após aprovação. Conceitos e evidências em DEMO_DESIGN_HISTORY; mídias/fontes e licenças em public/demos/unique.

Antes de adicionar outra skill, confira fonte, licença, scripts, dependências e hooks. Preserve o escopo autorizado e registre decisões relevantes. Não instale pacotes ou cadeias de skills apenas porque aparecem como referência nos guias.
