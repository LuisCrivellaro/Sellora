# Skills — locais e externas

Inventário verificado em 2026-11-06. "Disponível" significa observado na listagem de skills da sessão do Claude desktop (Code tab) daquela data; outra máquina, o CLI puro ou outra conta podem não ter as mesmas skills. Nenhuma skill externa foi instalada no repositório.

## Skills locais (versionadas em `.claude/skills/`)

| Skill | Quando usar | Referências principais |
|---|---|---|
| `dashboard-builder` | Implementar um módulo do dashboard (só com autorização) | DASHBOARD_SPEC, DESIGN_SYSTEM, FRONTEND_PLAYBOOK |
| `design-review` | Revisar UI/UX renderizada antes de entregar | DESIGN_SYSTEM, FRONTEND_PLAYBOOK, WORKFLOW §6 |
| `quality-assurance` | Rodar verificações e relatar PASS/FAIL/SKIP | WORKFLOW §5–7, CLIENT_WEBSITES §6 |
| `prompt-architect` | Escrever ou consolidar prompts para agentes | WORKFLOW §2–4 |
| `lead-research` | Montar e qualificar lista de leads | PRODUCT_CONTEXT, ROADMAP |
| `website-audit` | Diagnosticar o site/presença de um lead | FRONTEND_PLAYBOOK §3, §9–10; CLIENT_WEBSITES §5 |
| `sales-strategy` | Abordagem consultiva e follow-up (rascunhos) | PRODUCT_CONTEXT, ROADMAP |
| `proposal-writer` | Rascunho de proposta comercial | PRODUCT_CONTEXT, CLIENT_WEBSITES §4 |
| `website-builder` | Construir site de cliente com briefing aprovado | CLIENT_WEBSITES, FRONTEND_PLAYBOOK |

As 8 skills originais foram reescritas preservando nome e propósito, com gatilho mais claro no `description`, leituras obrigatórias, processo, proibições e formato de saída. `prompt-architect` é nova.

## Skills externas

| Skill | Fonte | Status nesta máquina | Uso na Sellora |
|---|---|---|---|
| Frontend Design | `anthropics/skills` (repositório oficial da Anthropic; pasta com `SKILL.md` e `LICENSE.txt`, sem scripts) | **Disponível** na sessão como `anthropic-skills:frontend-design` (catálogo da conta). Não instalada no repo | Direção estética de sites de clientes |
| Interface Design | Catálogo `anthropic-skills` | **Disponível** na sessão | Dashboard e telas de produto |
| UI UX Pro Max | Upstream `nextlevelbuilder/ui-ux-pro-max-skill` (MIT; contém scripts) | **Disponível** na sessão como `anthropic-skills:ui-ux-pro-max` | Consulta de paletas, pares tipográficos, padrões — referência, não regra |
| Web Design Guidelines | Catálogo `anthropic-skills` | **Disponível** na sessão | Auditoria de conformidade de UI |
| Humanizer | Catálogo `anthropic-skills` | **Disponível** na sessão | Revisão de textos de sites e propostas |
| Webapp Testing | Catálogo `anthropic-skills` (Python Playwright) | **Disponível** na sessão; Python/Playwright **não verificados** | E2E e screenshots locais |
| Vercel React Best Practices | Catálogo `anthropic-skills` | **Disponível** na sessão | Performance Next.js/React |
| Skill Creator | Catálogo `anthropic-skills` | **Disponível** na sessão | Criar/avaliar skills locais |
| Taste (`design-taste-frontend`, "tasteskill v2") | Sincronizada pela conta em `~/.claude/skills/synced/`; upstream **não verificado** | Arquivo presente em disco; **não listado** como skill ativa nesta sessão | Anti-genérico em landing pages e telas — avaliar antes de habilitar |
| Prompt Engineer (`prompt-engineer`, MIT, autor Jeffallan) | Sincronizada pela conta em `~/.claude/skills/synced/` | Arquivo presente; **não listado** nesta sessão | Opcional; `prompt-architect` cobre o padrão Sellora |
| Impeccable | Upstream `pbakaus/impeccable` (Apache-2.0, segundo catálogos de terceiros) | **Não instalada.** O instalador para Claude Code adiciona um **hook** que roda após edições de UI | Candidata para revisão de design; exige autorização por alterar configuração de hooks |

## Instalação (não executada)

Antes de instalar qualquer skill externa: confirmar fonte oficial, ler `SKILL.md` e scripts, verificar dependências, hooks e permissões, checar sobreposição com as skills acima e pedir autorização. Registrar em `docs/DECISIONS.md`.

Comandos de referência, a revisar no README oficial antes de usar:

```bash
npx skills add https://github.com/anthropics/skills --skill frontend-design
```

```bash
npx skills add https://github.com/pbakaus/impeccable --skill impeccable
```

No Claude Code também existe a via de marketplace de plugins (`/plugin marketplace add <owner>/<repo>`), executada pelo usuário em um terminal `claude` interativo.

## Combinações recomendadas

1. **Dashboard:** `dashboard-builder` + `interface-design` + `vercel-react-best-practices` → `design-review` + `web-design-guidelines` → `quality-assurance` + `webapp-testing`.
2. **Site de cliente:** `website-builder` + `frontend-design` (+ `ui-ux-pro-max` como consulta) + `humanizer` → `design-review` → `quality-assurance`.
3. **Venda:** `lead-research` → `website-audit` → `sales-strategy` → `proposal-writer` (+ `humanizer`).
4. **Prompts para outros agentes:** `prompt-architect`.

Não instalar dezenas de skills parecidas; quando duas cobrem o mesmo tema, a skill local e os docs da Sellora prevalecem sobre a genérica.
