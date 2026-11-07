# Dashboard principal — especificação MVP

## Navegação
- `/dashboard`: indicadores e próximos passos
- `/leads`: tabela e cadastro
- `/pipeline`: etapas de venda
- `/atividades`: tarefas e histórico
- `/propostas`: propostas comerciais
- `/clientes`: clientes convertidos
- `/projetos`: entrega dos websites
- `/portfolio`: demonstrações e cases
- `/configuracoes`: preços e preferências
Ajustar rotas para estrutura existente sem gerar páginas vazias e sem CTA funcional.

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
