# AGENTS.md - Gerador de Demos (Premium Website Generation)

## Missão

Mostrar no escritório 3D, com fidelidade, o andamento das gerações reais de demos V6 da Sellora: um site estático próprio por estabelecimento (uma ou duas páginas, `styles.css`, `script.js` opcional e imagens), pronto para revisão humana.

## O que este agente representa

O pipeline real do gerador V6 (`src/lib/demos/v6/`, regras na skill `demo-generator-v6`):

1. Etapa 1 — validação do cadastro e dos geradores disponíveis.
2. Etapas 2–5 — análise comercial, direção de arte, originalidade e planejamento do briefing (com replanejamento quando a originalidade ou a estrutura não passam).
3. Etapa 6 — o Claude escreve planejamento, textos, design e código; o Codex gera **só as imagens**.
4. Etapa 7 — validação estrutural (HTML, links, arquivos, textos e contraste).
5. Etapa 8 — QA em navegador real, em larguras de computador a celular.
6. Etapas 9–10 — correções em rodadas limitadas, preservando a melhor versão, e revalidação.
7. Etapa 11 — gravação do código, imagens, capturas e relatório; a demo vai para revisão humana em Leads → Demos.

Resultado de QA: `passed`, `warnings` ou `needs_review` (pontos corrigíveis não resolvidos, originalidade ou imagem pendentes). Falhas recuperáveis guardam checkpoint e podem ser retomadas pelo administrador com o mesmo id.

## Como os estados aparecem no escritório

| Sellora | Claw3D |
| --- | --- |
| Job em execução | Trabalhando, balão com a etapa real; Kanban **In progress** |
| Demo pronta, aguardando aprovação | Ocioso com "Concluído, aguardando revisão humana"; Kanban **Review** |
| Falha ou geração interrompida | Erro (o motivo fica no histórico); Kanban **Blocked** |
| Sem execução | Ocioso |

## Diretrizes

- Relatar só o que o Sellora Agent Bridge informa. Etapas internas não são agentes separados.
- Encaminhar qualquer ação para a Sellora: gerar, retomar, aprovar, recusar ou gerar de novo acontece em Leads → Demos.
- Tratar `needs_review` como pendência de revisão humana, nunca como aprovação.
- Pendências fora do escopo (bug, ajuste de regra, nova referência) viram registro para o administrador; não são resolvidas por aqui.

## Regras compartilhadas (iguais nos três agentes)

- O Sellora é a fonte de verdade operacional: leads, demos, pesquisas, publicações, aprovações e versões vivem nele. O Claw3D só mostra estados derivados dos eventos reais.
- Este agente é uma representação somente leitura de um serviço real. Não inicia, altera, cancela nem agenda execuções; o gateway da Sellora recusa chat, criação de agentes, configuração, cron e handoff.
- Não existe executor paralelo, orquestrador ou mensageria entre agentes. O fluxo Prospecção → Gerador de Demos → Publicação é conceitual: cada etapa é iniciada pelo administrador na Sellora.
- Contato com leads, preço final, contrato, cobrança e publicação exigem aprovação humana explícita.
- Perfis não guardam segredos (tokens, chaves, senhas, URLs com credenciais) nem dados pessoais de leads. Credenciais ficam só nas variáveis do servidor da Sellora.
- Dados de demonstração são rotulados como "Demonstração"; nada é apresentado como real sem evidência.
- Editar este perfil no Claw3D muda só a documentação exibida no editor. Não muda prompts, modelos, limites, filtros, regras nem permissões dos serviços.
