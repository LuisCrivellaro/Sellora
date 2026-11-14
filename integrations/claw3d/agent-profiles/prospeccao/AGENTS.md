# AGENTS.md - Prospecção (Local Business Prospecting)

## Missão

Mostrar no escritório 3D, com fidelidade, o andamento das pesquisas reais de estabelecimentos locais que podem precisar de site, iniciadas pelo administrador em Leads → Prospecção IA.

## O que este agente representa

O executor de prospecção da Sellora (`src/lib/prospecting/`, regras da skill `local-client-prospector`), **sem IA generativa**:

1. Município oficial (IBGE) da UF escolhida, com coordenada embutida.
2. Busca de estabelecimentos no OpenStreetMap via Overpass, com servidores alternativos e tentativas limitadas.
3. Verificação HTTP dos sites encontrados (no ar, HTTPS, meta viewport, ano do rodapé, links de telefone/WhatsApp, domínio gratuito, título).
4. Classificação por regras com score 0–100 justificado:
   - **HOT** — sem site próprio (nenhum ou só redes/plataforma) e com algum canal comercial público.
   - **WARM** — site próprio com pelo menos um problema verificável.
   - **LOW** — site próprio no ar sem problemas detectados.
   - **SKIP** — duplicado, rede/franquia, fechado, sem nome ou contato, fora do raio ou categoria irrelevante.
5. Seleção de até dez HOT/WARM por score, confiança e distância; os resultados ficam salvos para revisão.

Depois da pesquisa, o administrador revisa e decide o que importar para o CRM (e se quer iniciar demos). Nada é importado ou gerado automaticamente.

## Como os estados aparecem no escritório

| Sellora | Claw3D |
| --- | --- |
| Pesquisa em andamento | Trabalhando, balão com a etapa real; Kanban **In progress** |
| Pesquisa concluída | Ocioso; Kanban **Done** com as contagens |
| Falha ou interrupção | Erro (motivo no histórico); Kanban **Blocked** |
| Sem pesquisa | Ocioso |

## Diretrizes

- Relatar só o que o Sellora Agent Bridge informa (cidade, UF, segmento, raio, etapas, contagens e erro).
- Encaminhar qualquer ação para a Sellora: pesquisar, revisar, importar e gerar demo acontecem em Leads.
- Classificação e limites são definidos no código e na skill; este perfil só os descreve.

## Regras compartilhadas (iguais nos três agentes)

- O Sellora é a fonte de verdade operacional: leads, demos, pesquisas, publicações, aprovações e versões vivem nele. O Claw3D só mostra estados derivados dos eventos reais.
- Este agente é uma representação somente leitura de um serviço real. Não inicia, altera, cancela nem agenda execuções; o gateway da Sellora recusa chat, criação de agentes, configuração, cron e handoff.
- Não existe executor paralelo, orquestrador ou mensageria entre agentes. O fluxo Prospecção → Gerador de Demos → Publicação é conceitual: cada etapa é iniciada pelo administrador na Sellora.
- Contato com leads, preço final, contrato, cobrança e publicação exigem aprovação humana explícita.
- Perfis não guardam segredos (tokens, chaves, senhas, URLs com credenciais) nem dados pessoais de leads. Credenciais ficam só nas variáveis do servidor da Sellora.
- Dados de demonstração são rotulados como "Demonstração"; nada é apresentado como real sem evidência.
- Editar este perfil no Claw3D muda só a documentação exibida no editor. Não muda prompts, modelos, limites, filtros, regras nem permissões dos serviços.
