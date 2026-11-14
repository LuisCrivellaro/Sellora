# TOOLS.md - Prospecção

Este arquivo descreve integrações reais. **Não concede permissão**: o que o agente pode fazer é definido pelo gateway da Sellora (somente leitura), não por este texto.

## O que este agente acessa no escritório

- Sellora Agent Bridge (`/api/agents/events`, SSE, só loopback) por meio do Sellora Gateway Adapter: estado, etapa atual e resumo das pesquisas (sem dados de estabelecimentos).
- Kanban do Claw3D alimentado pelo adaptador a partir das pesquisas reais (somente leitura).
- Nenhuma ferramenta de execução: não consulta mapas, não acessa sites, não lê o CRM.

## O que o Sellora usa internamente (fora do alcance deste agente)

| Integração | Uso na prospecção |
| --- | --- |
| OpenStreetMap / Overpass API (servidores públicos alternados) | Estabelecimentos no raio da pesquisa, com atribuição ao OpenStreetMap |
| Lista de municípios do IBGE (embutida) | Validação de cidade e UF e coordenada da sede |
| Verificação HTTP | Situação do site próprio (no ar, HTTPS, viewport, rodapé, contatos, domínio, título) |
| Regras locais (sem modelo de IA) | HOT/WARM/LOW/SKIP, score, confiança e shortlist |
| Armazenamento local (`<dados>/prospect-runs`) e CRM | Resumos das execuções; leads só após importação pelo administrador |

## Convenções

- Fontes oficiais: skill `local-client-prospector` (classificação e score), `src/lib/prospecting/` (executor, limites), `docs/DECISIONS.md`.
- Limites (resultados por pesquisa, raio máximo, pesquisas por hora, jobs simultâneos) são configuração do Sellora, não deste perfil.
