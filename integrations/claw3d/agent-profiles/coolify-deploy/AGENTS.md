# AGENTS.md - Coolify Deploy Agent (Deployment & Hosting Operations)

## Missão

Mostrar no escritório 3D, com fidelidade, o andamento das publicações reais de demos V6, iniciadas pelo administrador na ficha do lead (Publicação da demo).

## O que este agente representa

O serviço de publicação existente (`src/lib/publishing/`, guia em `docs/COOLIFY_INTEGRATION.md`):

1. **Preparando** — lê os arquivos do site V6 (hash conferido) e grava a pasta da demo no repositório exclusivo de demos, num único commit (sem commit se nada mudou).
2. **Preparando** — localiza ou cria a aplicação estática da demo no Coolify, sem deploy automático.
3. **Publicando** — solicita o deploy e acompanha até concluir ou falhar.
4. **Verificação** — baixa a página no endereço da aplicação e compara o SHA-256 com o `index.html` gravado. Só então: "Publicado", com o endereço salvo no registro e no lead.

Também representa **Republicar** (mesma aplicação e subdomínio, versão atual da demo) e **Verificar no Coolify** (reconciliação do estado real). Uma operação ativa por lead, tentativas e publicações simultâneas limitadas.

## Como os estados aparecem no escritório

| Sellora | Claw3D |
| --- | --- |
| Preparando | Trabalhando, balão "Preparando: …"; Kanban **In progress** |
| Publicando | Trabalhando, balão "Publicando: …"; Kanban **In progress** |
| Publicado (conteúdo conferido) | Ocioso com "Publicação confirmada"; Kanban **Done** com o endereço |
| Falha na publicação | Erro (motivo no histórico); Kanban **Blocked** |
| Sem publicação | Ocioso |

## Diretrizes

- Relatar só o que o Sellora Agent Bridge informa. Sem credenciais configuradas, o serviço fica ocioso e a Sellora lista o que falta.
- Encaminhar qualquer ação para a Sellora: publicar, republicar e verificar acontecem na ficha do lead.
- Nunca tratar deploy concluído como publicado sem a conferência do conteúdo.

## Regras compartilhadas (iguais nos três agentes)

- O Sellora é a fonte de verdade operacional: leads, demos, pesquisas, publicações, aprovações e versões vivem nele. O Claw3D só mostra estados derivados dos eventos reais.
- Este agente é uma representação somente leitura de um serviço real. Não inicia, altera, cancela nem agenda execuções; o gateway da Sellora recusa chat, criação de agentes, configuração, cron e handoff.
- Não existe executor paralelo, orquestrador ou mensageria entre agentes. O fluxo Prospecção → Gerador de Demos → Publicação é conceitual: cada etapa é iniciada pelo administrador na Sellora.
- Contato com leads, preço final, contrato, cobrança e publicação exigem aprovação humana explícita.
- Perfis não guardam segredos (tokens, chaves, senhas, URLs com credenciais) nem dados pessoais de leads. Credenciais ficam só nas variáveis do servidor da Sellora.
- Dados de demonstração são rotulados como "Demonstração"; nada é apresentado como real sem evidência.
- Editar este perfil no Claw3D muda só a documentação exibida no editor. Não muda prompts, modelos, limites, filtros, regras nem permissões dos serviços.
