# Prompt para a próxima IA (Sellora)

Copie tudo abaixo para a próxima sessão.

---

Você está assumindo o projeto **Sellora** já em andamento. **Não comece do zero e não refaça o que está concluído.** Você tem autorização para implementar, testar, fazer commit e push **somente** na branch `feat/cloud-3d` (sem merge na `main`, sem force push, sem deploy, sem serviços pagos, sem enviar mensagens a leads).

## 1. Recuperar o estado real
- Repositório: https://github.com/LuisCrivellaro/Sellora — branch `feat/cloud-3d`. Os hashes citados aqui são referência; use o commit mais recente do remoto.
- Se o projeto já existe (ex.: `C:\Projetos\Sellora`), não clone de novo: `git status`, `git remote -v`, `git branch --show-current`, `git fetch origin`, `git pull --ff-only origin feat/cloud-3d` (preserve alterações locais; nunca `reset --hard`/`clean -fd`). Senão: `git clone --branch feat/cloud-3d https://github.com/LuisCrivellaro/Sellora.git`.
- Leia: `CLAUDE.md`, `docs/AI_HANDOFF.md` (seção "Missões" e "Próxima ação exata"), `docs/CLAW3D_INTEGRATION.md`, `docs/SKILLS_SETUP.md`, `docs/DECISIONS.md` (últimas entradas), `README.md` (seções V6, Cloud 3D, imagens).
- Rode `npm ci`, `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. Em 2026-11-12 tudo passava (≈208 testes, 1 live pulado).

## 2. Onde as missões estão
1. **Gerador V6** (concluído com pendências): demos reais de barbearia, restaurante e clínica geradas (artefatos só locais em `.sellora-data/`). Corrigidos telefone inválido e hero repetido (arquétipos no guia `.agents/skills/demo-generator-v6/references/guia-de-criacao.md` + `recentHeroIssue` em `src/lib/demos/v6/generator.ts`). Pendentes: validar a rotação de hero com **uma** geração real nova; conferir **Leads → Demos → Revisar → Prévia | Código** com um lead fictício rotulado "Demonstração"; testar geração V6 dentro do `.exe`.
2. **Cloud 3D / Claw3D** (funcional em dev): `integrations/claw3d/` (setup com commit fixado `51337f7`, adaptador de gateway, launcher). Rodar: `node integrations/claw3d/setup.mjs` (uma vez), `npm run dev -- --port 3100`, `node integrations/claw3d/launcher.mjs`, abrir `/dashboard/cloud-3d`. Pendentes: testar no `.exe` (Electron chama `startOffice` em `desktop/main.mjs` se houver Claw3D em `SELLORA_CLAW3D_DIR` ou `%APPDATA%/sellora/claw3d/app`), medir CPU/memória, decidir como preparar o Claw3D para o app empacotado (com aprovação do administrador). Limitações conhecidas no doc.
3. **Remover Gemini/Imagen** (concluída): imagens só pelo Codex, fallback SVG gratuito; "gemini" aceito só na leitura de registros antigos.

Siga a "Próxima ação exata" de `docs/AI_HANDOFF.md`.

## 3. Regras de custo
- Uma demo V6 custou ≈6% da janela de 5 h do Claude Pro em 2026-11-12 (antes se observou 16%; meça). Gere o mínimo necessário; reutilize os sites existentes para QA.
- Não edite `next.config.ts`/`tsconfig.json` durante uma geração: o dev server reinicia e o job é interrompido.
- Testes do Claw3D sem gastar cota: bridge instrumentado (servidor SSE local no formato de `/api/agents/events`) + `SELLORA_BRIDGE_URL` no launcher + Edge headless via CDP. O painel de navegador embutido do app Claude, quando oculto, limita timers; prefira headless.

## 4. Regra dos 90% (obrigatória)
Monitore os limites da assinatura Claude com a ferramenta oficial (ex.: `get_usage` no app Claude; se não houver medidor confiável, não invente percentuais e faça checkpoints frequentes). Ao atingir **90%** de qualquer limite aplicável (janela de 5 h, semanal):
1. Pare de iniciar tarefas novas.
2. `git status`, `git diff --check`; commit descritivo (sem `.env`, dados de leads, `.sellora-data/`, `.claw3d/`, `test-results/`, `release/`).
3. `git push origin feat/cloud-3d` (sem force) e confirme que o remoto tem o commit.
4. Atualize `docs/AI_HANDOFF.md` (missão e etapa atuais, concluído, parcial, pendente, arquivos, skills, integrações, dependências, testes, problemas, decisões, branch, último commit, próxima ação exata, comandos).
5. Atualize este `docs/NEXT_AI_PROMPT.md` com um prompt completo e autossuficiente, incluindo **esta mesma regra dos 90%**; faça commit e push de novo.
6. Entregue o prompt completo na resposta final, com branch, último commit, status do push, missão atual, próxima tarefa, testes e pendências.

Entre 80% e 85%, faça um checkpoint preventivo e não comece tarefas que impeçam um encerramento seguro.
