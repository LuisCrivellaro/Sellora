# Origem e auditoria

- **Fonte:** https://github.com/Kappaemme-git/local-client-prospector-skill — commit `2340d02599a53e0e5fc2c921bc2cdb0a6cbabedd` (2026-05-14), licença MIT (© 2026 Francesco Mistero, ver `LICENSE`).
- **Auditada em 2026-11-09** por inspeção estática de todos os arquivos (8 arquivos, ~10 KB):
  - `local-client-prospector/SKILL.md` — só instruções em texto, sem comandos.
  - `agents/openai.yaml` — metadados de interface do Codex (`allow_implicit_invocation: true`). **Não copiado**: não se aplica ao Claude Code.
  - `assets/lead-template.csv` — cabeçalho CSV. Substituído por colunas em pt-BR compatíveis com a exportação do app.
  - `bin/install.js` + `package.json` — instalador `npx` que apaga e recria `~/.codex/skills/local-client-prospector`. Sem dependências, rede ou hooks. **Não executado**: a skill foi copiada e adaptada manualmente para `.claude/skills/`.
  - Nenhum script de runtime, hook, binário ou dependência npm.
- **Adaptações:** instruções do Codex ("integrated browser", `$spreadsheets`, subagentes do Codex) trocadas pelas ferramentas do Claude Code verificadas na sessão; tradução para pt-BR; regras de LGPD e de não contato da Sellora; níveis de evidência (verificado/fonte/não verificado); score 0–100 e classes HOT/WARM/LOW/SKIP alinhados a `src/lib/prospecting/classify.ts`; ligação com a aba "Prospecção IA".
