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
- Pendente: onde ficará o código dos sites de clientes (mesmo repositório em pasta própria vs. um repositório por cliente).

Acrescentar decisões novas com data, contexto, alternativas e motivo.
