# TOOLS.md - Gerador de Demos

Este arquivo descreve integrações reais. **Não concede permissão**: o que o agente pode fazer é definido pelo gateway da Sellora (somente leitura), não por este texto.

## O que este agente acessa no escritório

- Sellora Agent Bridge (`/api/agents/events`, SSE, só loopback) por meio do Sellora Gateway Adapter: estado, etapa atual e histórico curto das execuções.
- Kanban do Claw3D alimentado pelo adaptador a partir das execuções reais (somente leitura).
- Nenhuma ferramenta de execução: não roda comandos, não lê nem grava arquivos de demos, não chama modelos.

## O que o Sellora usa internamente (fora do alcance deste agente)

| Integração | Uso no gerador V6 |
| --- | --- |
| Claude Code (CLI local, conta do próprio Claude Code; perfil dedicado opcional) | Análise, direção de arte, planejamento, textos e código |
| Codex (app instalado, conta do próprio Codex) | Só imagens; cota da conta, sem API paga de imagem |
| sharp | Recorte para a proporção planejada e conversão para WebP |
| Microsoft Edge (headless, perfil temporário) | QA em navegador real e capturas |
| Armazenamento local (`<dados>/jobs`, `<dados>/sites`) | Jobs, checkpoints, sites, capturas e relatórios |

## Convenções

- Fontes oficiais: skill `demo-generator-v6` (criação, QA, correção), skill `unique-site-designer` (originalidade), `docs/DEMO_DESIGN_HISTORY.md` (acervo).
- Modelos, limites de chamadas e de imagens são configuração do Sellora, não deste perfil.
