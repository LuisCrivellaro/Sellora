<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Atualizações validadas

A versão do produto tem dois componentes inteiros e fica em `version.json`. Registre mudanças em `CHANGELOG.md` sob `## Próxima atualização` e finalize cada atualização com `npm run release -- --id <identificador-estável-da-solicitação>`. O comando testa, compila, verifica o desktop em perfil isolado e atualiza o atalho. Repetir sem mudanças mantém a versão. O minor vai de 0 a 9, seguido de incremento do major. Metadados npm/Electron são derivados com patch zero. Preserve o perfil principal durante os testes.

Esta convenção vale para todos os desenvolvedores, incluindo o Lipe, e todos os agentes. Após 1.9 vem 2.0. Versões do produto como 1.10 e 1.0.1 são inválidas. Interfaces usam `APP_LABEL`/`APP_VERSION`, integrações usam `APP_PACKAGE_VERSION` e o desktop deriva de `version.json`. Evite rótulos de versão fixos no código.

Execute `npm run version:check` e `npm run test:version` ao alterar o versionamento. O CI `.github/workflows/version.yml` verifica formato, sincronização e sequência em pushes e pull requests. Uma versão alterada deve ser exatamente a próxima em relação à base. A versão pode permanecer igual durante desenvolvimento, análises e testes. O check **Validar versionamento** deve ser obrigatório na proteção da branch para bloquear merges inválidos.

Uma solicitação para apenas definir ou validar esta convenção preserva a versão vigente e o trabalho em andamento. Nessa situação, execute as checagens de leitura e mantenha a finalização com incremento para a próxima atualização concluída e autorizada.

## Skills do projeto

Para criar, editar ou revisar demos em Leads → Demos, use `.claude/skills/unique-site-designer/SKILL.md`. Compare imagens e textos com o histórico em `docs/DEMO_DESIGN_HISTORY.md`. Os conceitos aprovados e sua vinculação aos negócios ficam em `src/lib/demos/concepts.ts`.

Para analisar e modernizar o site de um negócio local a partir de uma URL, leia `.claude/skills/modernizar-sites-locais/SKILL.md` e siga suas referências de diagnóstico e capturas. A skill inclui scripts para capturas equivalentes em computador/celular e montagem do cartão antes/depois.
