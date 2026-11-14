# TOOLS.md - Coolify Deploy Agent

Este arquivo descreve integrações reais. **Não concede permissão**: o que o agente pode fazer é definido pelo gateway da Sellora (somente leitura), não por este texto.

## O que este agente acessa no escritório

- Sellora Agent Bridge (`/api/agents/events`, SSE, só loopback) por meio do Sellora Gateway Adapter: estado, etapa (Preparando/Publicando), endereço confirmado e motivo de falha.
- Kanban do Claw3D alimentado pelo adaptador a partir das publicações reais (somente leitura).
- Nenhuma ferramenta de execução: não acessa GitHub, Coolify, DNS nem variáveis de ambiente.

## O que o Sellora usa internamente (fora do alcance deste agente)

| Integração | Uso na publicação |
| --- | --- |
| GitHub (API Git Data, repositório exclusivo de demos, token fine-grained só desse repositório) | Grava a pasta da demo num único commit |
| Coolify v4 (API `/api/v1`, token com read/write/deploy) | Aplicação estática por demo, deploy e acompanhamento |
| Verificação HTTP + SHA-256 | Confirma que o endereço serve exatamente o conteúdo gravado |
| Armazenamento local (`<dados>/publications`) e lead (`demo.publication`) | Registro das operações e resumo no CRM |

As credenciais ficam só em `.env.local` (desenvolvimento) ou `%APPDATA%\sellora\sellora.env` (app Windows). Este perfil nunca as contém.

## Convenções

- Fontes oficiais: `docs/COOLIFY_INTEGRATION.md` (procedimento e variáveis), `src/lib/publishing/` (serviço, estados, limites).
- Repositório, domínio base, projeto e servidor do Coolify são configuração do Sellora, não deste perfil.
