# Dashboard principal — especificação MVP

## Navegação (implementada em 2026-11-07 — 7 destinos, ver `docs/DECISIONS.md`)
- `/dashboard` (Home): indicadores e próximas ações
- `/leads`: CRM em tabela + **Kanban** (`?visao=kanban`); atividades e follow-ups no detalhe do lead; aba **Prospecção IA** (`?aba=prospeccao`): pesquisa por cidade/segmento com executor OpenStreetMap, classificação HOT/WARM/LOW/SKIP, exportação e importação ao CRM com origem `prospeccao_ia` (ver README)
- `/clientes`: clientes convertidos
- `/projetos`: entrega dos websites
- `/propostas`: propostas comerciais
- `/financeiro`: contratos, faturamento, recebimentos e custos
- `/configuracoes`: perfil, aparência, pacotes, integrações e sistema
Antes previstos e incorporados/adiados: `/pipeline` → Kanban em Leads; `/atividades` → detalhe do lead/cliente e Home; `/portfolio` → adiado.

## Regras de cálculo (código em `src/lib/metrics`, cobertas por testes)
- **Temperatura do lead**: novo/qualificado = frio; contatado/respondeu = morno; diagnóstico/proposta/negociação = quente; ganho = convertido; perdido fora.
- **Score de oportunidade** (0–100): situação do site (até 40) + prioridade (até 30) + temperatura (até 30), sempre com os motivos exibidos.
- **Progresso do projeto**: tarefas concluídas ÷ tarefas totais; status derivado da etapa.
- **Lançamento**: pago, parcial, a receber, vencido (saldo aberto com vencimento passado) ou cancelado.
- **Radar comercial**: seis razões 0–100 dos últimos 30 dias, com fórmula no tooltip; meta mensal de leads configurável.

## Entidades mínimas
`leads` (nome, segmento, cidade, uf, site, instagram, email comercial, telefone comercial, origem, status, prioridade, valor potencial, responsável, ultimo_contato, proximo_contato, created_at, updated_at)
`activities` (lead_id, tipo, descrição, data_prevista, completed_at)
`proposals` (lead_id, titulo, pacote, itens, subtotal, condições, status, sent_at)
`clients` (lead_id, nome, dados necessários)
`projects` (client_id, titulo, escopo, valor_contratado, valor_recebido, status, prazo, preview_url, published_url)
`portfolio_items` (titulo, segmento, url, is_concept, imagem)
`settings` (pacotes, valores)
Modelagem final normalizada ao necessário, com índices, integridade referencial e proteção de acesso.

## Etapas do CRM
`novo`, `qualificado`, `contatado`, `respondeu`, `diagnostico`, `proposta`, `negociacao`, `ganho`, `perdido`. Transições registram histórico. Ao ganhar: CTA de conversão sem duplicar cliente.

## Dashboard
KPIs: total leads, contatados, propostas enviadas, vendas ganhas, valor contratado, receita recebida. Filtragem por período; contagens e somas no servidor; não inflar KPIs com demo. Próximas ações e atividades vencidas são prioritárias sobre gráficos cosméticos.

## Lead detail
Resumo + origem/link + contato + score justificado + timeline de atividades + botão 'Criar proposta' + próximo follow-up. Pesquisa/ordenação/paginação para escala moderada.

## Proposta
Incluir serviços, preço editável, escopo, prazo, número de revisões, custos recorrentes excluídos, forma de pagamento, validade e status. Preview para impressão/PDF. Nenhum envio automático.

## Critérios de aceite
- Fluxo lead novo → detalhes → atividade → proposta → etapa ganha → cliente/projeto opera com persistência real (quando banco configurado).
- Dashboard atualiza KPIs sem reload manual onde aplicável.
- Formulários validados; loading/errors/empty states; mobile e teclado utilizáveis.
- Auth obrigatória para qualquer dado real; RLS conferida.
- Testes para criação/edição, pipeline e conversão; lint, typecheck, build passam.
