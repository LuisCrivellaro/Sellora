# Registro de decisões (ADR leve)

- 2026-11-06: Começar por dashboard interno de operação, não por landing page comercial nem plataforma autônoma.
- 2026-11-06: Priorizar venda em 15 dias, com oferta inicial de pagamento único e preços configuráveis.
- 2026-11-06: Usar Claude Code para desenvolver sites, separadamente do CRM de gestão.
- 2026-11-06: Supabase sugerido para Auth e PostgreSQL; confirmar disponibilidade de credenciais antes de migração.

- 2026-11-06: **Base de conhecimento organizada em camadas.** Contexto: integração do material `PROMPT_MESTRE_FRONTEND_UX_MOTION_CRIATIVIDADE.md` (fornecido pelo usuário, fora do repositório em `C:\Projetos\`). Decisão: `CLAUDE.md` curto com regras permanentes e mapa; conhecimento especializado em `docs/FRONTEND_PLAYBOOK.md` (universal), `docs/CLIENT_WEBSITES.md` (sites de clientes) e `docs/WORKFLOW.md` (processo, prompts, QA). Alternativas: um único documento grande (difícil de carregar seletivamente) ou dezenas de arquivos por tema (fragmentação). Motivo: leitura sob demanda e menos contexto desperdiçado.
- 2026-11-06: **Pasta `prompts/` não criada.** O README a referenciava, mas os arquivos não existiam. O procedimento de integração foi para `docs/WORKFLOW.md` §3; o prompt de início do dashboard será gerado quando a implementação for autorizada.
- 2026-11-06: **Motion: CSS primeiro.** Dashboard usa apenas motion funcional com CSS/Tailwind; sites de clientes escolhem ferramenta (Motion, GSAP, Three.js, Lenis) pela necessidade do briefing e do pacote, registrando aqui cada dependência.
- 2026-11-06: **Skills externas não instaladas no repositório.** Frontend Design, UI UX Pro Max, Web Design Guidelines, Humanizer e correlatas já estão disponíveis na sessão do Claude desktop via catálogo da conta; instalação local só com autorização e revisão de scripts (ver `docs/SKILLS_SETUP.md`).
- 2026-11-06: **Nova skill local `prompt-architect`** para gerar prompts de agentes no padrão de `docs/WORKFLOW.md` §4.
- 2026-11-06: **Nova direção visual do dashboard: dark neon com navegação superior em pill**, fiel a 4 imagens de referência aprovadas pelo usuário. Substitui a direção inicial (superfícies neutras, acento teal, sidebar, "evitar degradês roxos"). Motivo: instrução explícita mais recente. Logos e nomes das referências não são reproduzidos.
- 2026-11-06: **Motion de entrada permitido no dashboard** (cards em stagger, desenho de gráficos, contadores), substituindo "motion só funcional". Limites: ≤ 1s, só transform/opacity, desligável por `prefers-reduced-motion` e por preferência em Configurações.
- 2026-11-06: **Navegação com 7 destinos**: Home, Leads/CRM, Clientes, Projetos, Propostas, Financeiro, Configurações. Pipeline Kanban vira visualização alternativa dentro de Leads; atividades ficam no detalhe do lead; Portfólio adiado.
- 2026-11-06: **Stack**: Next.js 16.4 (App Router) + React 19.3 + TypeScript 5.9 (não 7.0, por compatibilidade do ecossistema de lint) + Tailwind 4.3 + `radix-ui` (primitivos acessíveis estilizados localmente no padrão shadcn, sem CLI) + `motion` 14 + `lucide-react` + Zod 4 + Vitest. ESLint 9.39 (não 10) pela compatibilidade de `eslint-config-next`.
- 2026-11-06: **Gráficos em SVG próprio** em vez de Recharts: fidelidade ao acabamento das referências (glow, barras segmentadas, donut com gaps, heatmap), menos peso e controle de acessibilidade por teclado.
- 2026-11-06: **Modo demo isolado** com `localStorage` (sem Supabase configurado): dados fictícios rotulados "Demonstração", sem autenticação simulada, sem integrações simuladas. Repositório isolado em `src/lib/data` para troca futura por Supabase.
- 2026-11-06: **Skills na construção do dashboard**: usadas `dashboard-builder`, `interface-design`, `frontend-design`, `ui-ux-pro-max` (só SKILL.md disponível; scripts/dados ausentes). `design-taste-frontend` (Taste) lida mas **não aplicada**: suas regras (sem glow, gradiente, violeta, nav em pill) contradizem a direção aprovada e seus arquivos de referência estão ausentes. Impeccable indisponível.
- 2026-11-07: **Tipografia Manrope** (uma família, números tabulares): geométrica e arredondada como os pills das referências, com mais caráter que Inter. Sem monoespaçada.
- 2026-11-07: **Tema claro adiado**: Configurações mostra "Claro (em breve)" desabilitado; só o tema escuro aprovado existe.
- 2026-11-07: **Auditoria `npm audit`**: 8 alertas moderados em `@typescript-eslint/*` (dependência de lint, só desenvolvimento). Não aplicado `audit fix --force` por exigir mudanças incompatíveis; reavaliar ao atualizar `eslint-config-next`.
- 2026-11-07: **`.claude/launch.json`** criado para o preview do Claude Code (`npm run dev -- --port 3100`).
- Pendente: onde ficará o código dos sites de clientes (mesmo repositório em pasta própria vs. um repositório por cliente).

Acrescentar decisões novas com data, contexto, alternativas e motivo.
