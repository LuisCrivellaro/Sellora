# Prompt de continuidade da Sellora (para a próxima IA)

Copie tudo abaixo e envie à próxima IA.

---

Você vai continuar o desenvolvimento da **Sellora**, um app de CRM e geração de sites demonstrativos para negócios locais sem presença digital (Next.js 16 App Router + TypeScript + Tailwind, empacotado para Windows com Electron; dados locais no navegador/perfil do app ou Supabase opcional). Leia `CLAUDE.md` antes de tudo: ele define regras de honestidade, segurança e dados ("Demonstração", nunca inventar fatos, aprovação humana para envios e publicação).

## Repositório
- GitHub: https://github.com/LuisCrivellaro/Sellora
- Branches de trabalho: `feat/demo-generator-v6` (missão 1) e `feat/cloud-3d` (missão 2, criada a partir da anterior; contém tudo da missão 1 + o Sellora Agent Bridge inicial). Continue na `feat/cloud-3d`; se fizer correções da missão 1, faça-as lá também. Não faça merge na `main` sem pedido explícito; nunca `push --force`.
- Último commit: veja `git log -1` na branch. O handoff mais recente está em `docs/AI_HANDOFF.md`, seção "Estado exato".

## Missões, na ordem obrigatória
1. **Sellora 2.0 / Demo Generator V6** (quase concluída): cada demo nova é um site estático próprio (`index.html`, `styles.css`, `script.js`, `assets/`) gerado em etapas (briefing → comparação com histórico → código + imagens → pós-processamento → QA estático → QA em navegador real → 1 correção → gravação imutável). Visualizador "Prévia | Código" e "Baixar código ZIP" em Leads → Demos → Revisar. Skills Emil Kowalski, Impeccable, Taste e Humanizer instaladas em `.claude/skills/`; suas regras adaptadas em `.agents/skills/demo-generator-v6/references/guia-de-criacao.md` (lido pelo gerador). Código em `src/lib/demos/v6/`, rotas `src/app/sites/[id]/[[...path]]` e `src/app/api/demos/sites/[id]/{,zip,preview}`.
2. **Cloud 3D (Claw3D)**: integrar o projeto open source https://github.com/iamlukethedev/Claw3D como aba "Cloud 3D" (`/dashboard/cloud-3d`) para observar agentes reais (primeiro o gerador de demos, que já grava `events` com horário real por etapa em cada job: `src/lib/demos/generation-server.ts`). Criar o "Sellora Agent Bridge" (registro de agentes reais, estados queued/running/waiting_approval/completed/failed/cancelled/offline, runtime `custom` do Claw3D com /health, /state, /registry conforme o contrato real), SSE/WebSocket, Claude Code hooks e Codex opcionais, sem agentes fictícios, validar no Electron, documentar em `docs/CLAW3D_INTEGRATION.md`. Detalhes completos em `docs/AI_HANDOFF.md`.
3. **Remover imagen-skill/Gemini e manter imagens só pelo Codex**: o usuário não quer API paga. Remover `src/lib/demos/gemini-server.ts` e seus usos (seletor "Imagem: Gemini", status `gemini`, `GEMINI_API_KEY` no `.env.example`, trechos do README/DECISIONS, teste `gemini-server.test.ts`), a pasta local `.claude/skills/imagen` e a linha dela no `.gitignore`. Manter Codex + fallback SVG gratuito. Preservar V6, visualizador, ZIP, Claude nos textos, aprovação/recusa e Cloud 3D.

## O que fazer primeiro
1. `git fetch && git checkout feat/demo-generator-v6 && git pull` e `npm ci`.
2. Ler `docs/AI_HANDOFF.md` (seções "Estado exato" e "Missões"), `docs/DECISIONS.md` (últimas entradas), `docs/SKILLS_SETUP.md`.
3. Conferir o estado real: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.
4. Continuar pela **próxima pendência da missão 1** (lista "Pendente na missão 1" no handoff): gerar as demos de teste de restaurante e clínica odontológica (dados fictícios "… Teste Sellora"), comparar capturas lado a lado com a barbearia, revisar o guia se parecerem o mesmo modelo, verificar o painel Prévia | Código dentro do app e uma geração no .exe. Depois a missão 2, depois a 3.
5. Não refazer o que está concluído. Não iniciar a missão seguinte antes de fechar a anterior (ou documentar o bloqueio).

## Ambiente (Windows do usuário)
- Claude Code vem do app Claude em `%APPDATA%\Claude\claude-code\<versão>\<hash>\claude.exe`, logado com a conta Claude (o gerador usa `claude -p` com Sonnet 5.5, esforço alto para criar e médio para corrigir; nunca chave de API).
- Codex: extensão do VS Code (`openai.chatgpt-*`), login ChatGPT, com geração de imagens.
- Auditoria visual usa o Microsoft Edge instalado (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`).
- Dev: `npm run dev -- --port 3100`. Produção local: `npm run build && npm run start -- --port 3102`. Windows: `npm run desktop:build` (feche o Sellora antes; o executável fica em `release/`).
- **Custo:** cada demo V6 consome cerca de 16% do limite de 5 h do plano Claude Pro. Gere só o necessário.

## Protocolo obrigatório de continuidade (repita para a próxima IA)
- Trabalhe de forma autônoma; não pare para pedir confirmação de decisões comuns. Encerre só quando tudo estiver concluído e testado, ou quando um limite de uso confirmado da assinatura chegar a 90%.
- Verifique o uso com a ferramenta disponível (no app Claude: `get_usage`); não confunda com a janela de contexto e não invente números. Sem medição confiável, diga isso e use checkpoints preventivos.
- Faça commits pequenos após cada etapa funcional e `git push` na branch de trabalho; confirme com `git log origin/<branch> -1`. Nunca envie `.env`, segredos, `.sellora-data/` ou `test-results/`.
- Aos 90%: pare de implementar; `git status`; commit de checkpoint; push confirmado; atualize `docs/AI_HANDOFF.md` com missão atual, etapa exata, concluído, parcial, pendente, arquivos, decisões, dependências, skills, integrações, problemas, testes feitos e pendentes, comandos e próxima ação exata; commit e push finais; confira `git status`, `git log -1 --oneline` e `git branch --show-current`; gere um novo prompt autossuficiente como este (incluindo este protocolo) e salve em `docs/NEXT_AI_PROMPT.md` no commit final.
- Se tudo for concluído antes de 90%: testes, correções, documentação, commit, push e relatório final.
