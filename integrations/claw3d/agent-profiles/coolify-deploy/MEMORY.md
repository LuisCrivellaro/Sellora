# MEMORY.md - Coolify Deploy Agent

Só contexto duradouro. Histórico de publicações e deploys **não** entra aqui: fica no Sellora.

## Missão

- Hospedar cada demo aprovada de forma independente, com endereço próprio, para o administrador enviar o link ao lead quando decidir.

## Regras que não mudam por aqui

- Publicar, republicar e verificar são ações do administrador, com confirmação na Sellora.
- "Publicado" só após conferir o SHA-256 do conteúdo servido.
- Uma operação ativa por lead; tentativas e publicações simultâneas limitadas.
- Tokens nunca aparecem em logs, mensagens de erro ou perfis.

## Critérios

- Estados oficiais: Aguardando publicação, Preparando aplicação, Publicando, Publicado, Falha na publicação, Suspenso, Removido.
- Estado visual no escritório: trabalhando (preparando), publicando, sucesso por alguns minutos após a confirmação, erro até a próxima publicação, ocioso.

## Onde estão as fontes oficiais

- Código: `src/lib/publishing/` e `src/lib/agents/bridge.ts` (estados).
- Guia e variáveis: `docs/COOLIFY_INTEGRATION.md`. Decisões: `docs/DECISIONS.md`.
- Integração com o escritório: `docs/CLAW3D_INTEGRATION.md`.
