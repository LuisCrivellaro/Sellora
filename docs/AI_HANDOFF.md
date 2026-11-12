# Continuidade do Sellora

Estado verificado em 2026-11-12. README descreve o uso e DECISIONS preserva as decisões. Este resumo substitui HANDOFF e PROMPT_CONTINUACAO, que descreviam missões encerradas.

## Estado atual

- Aplicativo Windows com Electron e Next local em 127.0.0.1:3187. Build: `npm run desktop:build`; executável em `release/`, ignorado pelo Git.
- Sete módulos, CRM e fluxo lead → proposta → cliente/projeto → financeiro. Escritas passam por `src/lib/data/repository.ts`.
- Prospecção usa OpenStreetMap e classificação local por regras, com verificação HTTP de sites. Apesar do nome da aba, o ranking não usa modelo generativo: seleciona até dez HOT/WARM por score, confiança e distância dentro do raio e informa limites de cobertura.
- A pesquisa apenas salva resultados. O administrador revisa e usa **Gerar prospecção com demo** para importar os selecionados (ou resultados visíveis) e iniciar a geração. Flags antigas não autorizam geração automática.
- Demos v5 são criadas no app com Unique Site Designer e a conta ChatGPT do Codex instalado: textos estruturados, imagem nativa, validação, histórico e fila sequencial. Pendências pausam ao reabrir; só uma ação explícita retoma os leads escolhidos.
- Leitores v1–v4 e dois conceitos v4 aprovados permanecem disponíveis. Mensagens editadas, snapshots e envios anteriores são preservados.
- WhatsApp abre com rascunho após aprovação; envio e confirmação são manuais. Nenhum contato com leads foi realizado na validação.

## Dados e segurança

- CRM local no armazenamento do perfil; exportação/restauração JSON nas Configurações. Não aumentar DB_VERSION: normalizar campos novos para preservar registros.
- Resultados e imagens v5 em `%APPDATA%/sellora/demo-generator` no Windows ou `.sellora-data/` no desenvolvimento. O JSON do CRM não inclui esses arquivos; preservar o diretório junto com o backup.
- Links contêm dados comerciais públicos. Imagens v5 dependem do servidor de origem; links locais não servem para leads externos. Nenhum deploy foi feito.
- Codex mantém a própria autenticação. Telefone, notas, e-mail, score e credenciais ficam fora do briefing do modelo. Rotas de geração exigem origem local e validação de acesso.
- Supabase é opcional e continua sem validação em projeto remoto real. Não afirmar que login/RLS remotos foram testados. Conferir o projeto antes do acesso; migrations em `supabase/migrations/`.

## Evidências e limites

- 148 testes em 22 arquivos, lint, TypeScript e build aprovados. Dependências de produção sem vulnerabilidades no npm audit desta revisão.
- Auditoria completa: 12 alertas moderados nas dependências de desenvolvimento (cadeias de typescript-eslint e electron-builder/minimatch), sem alertas altos ou críticos. package-lock.json não mudou nesta versão. A correção deve ser tratada separadamente, validando compatibilidade; não executar audit fix --force indiscriminadamente.
- QA anterior observado no executável e navegador: geração nativa com negócio fictício, persistência, layouts responsivos, prévia, shortlist regional, ausência de geração antes do botão e pausa da fila antiga ao reabrir. Evidências temporárias em `test-results/`, fora do commit.
- A conta Codex precisa disponibilizar geração de imagens e ter cota/créditos. Não há garantia de uso ilimitado ou gratuito.
- Comparação automática detecta origem idêntica, copy normalizada e combinações de composição. Fatos, semelhança semântica e qualidade visual exigem revisão humana.
- Aviso preexistente de hidratação no painel com movimento reduzido, associado a `useMotionEnabled`; registrado em DEMO_DESIGN_HISTORY. Não foi corrigido nesta versão.

## Verificação antes do commit

`npm test`, `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check`. Para distribuir Windows, executar também `npm run desktop:build` e conferir ausência de .env, dados privados e artefatos de QA no pacote. Não gerar novas imagens só para repetir QA: usar fixtures/resultados existentes.

Commits e push exigem autorização explícita conforme CLAUDE.md; nunca presumir o estado do remoto a partir de hashes antigos documentados.
