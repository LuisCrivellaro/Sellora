---
name: modernizar-sites-locais
description: Diagnostique e modernize o site de um negócio local a partir de uma URL, gere uma prévia navegável e produza um comparativo visual em computador e celular. Use para redesign, reconstrução demonstrativa ou avaliação de um site comercial existente.
---

# Modernizar sites locais

Trabalhe em português do Brasil por padrão. Comece pela URL do site atual. Se o usuário já tiver escolhido o negócio e houver um único site oficial identificável, use esse endereço e cite a fonte. Se houver mais de um candidato plausível, peça a URL antes de reconstruir. Se o pedido for só diagnóstico, entregue o diagnóstico e as evidências.

## Escopo obrigatório

Exclua pagamentos, checkout, assinaturas, cobranças, Pix, links de pagamento, carrinho e integrações financeiras da prévia, dos scripts e dos materiais de apresentação. Se o site atual tiver esses elementos, capture páginas ou regiões que os excluam. Se ainda aparecerem em uma captura, recorte ou oculte a região antes de incluí-la no comparativo e registre a edição. Um botão de agendamento pode apontar para um canal público confirmado desde que o destino dispense pagamento.

## Fluxo

1. **Diagnóstico.** Registre o estado da página atual em computador e celular antes de editar. Identifique problemas reproduzíveis, as respectivas páginas e a consequência para o visitante. Consulte [critérios e evidências](references/diagnostico.md). Se o site estiver inacessível, use capturas fornecidas pelo usuário quando disponíveis e identifique a origem. Sem evidência do original, entregue a prévia com a comparação pendente.
2. **Conteúdo.** Monte um inventário curto de serviços, horários, endereço e canais comerciais, com URL de origem ou confirmação do usuário para cada dado usado. Marque divergências como pendências. Use imagens autorizadas ou ilustrativas claramente identificadas. Preserve o sentido do conteúdo e omita depoimentos, credenciais, avaliações e promessas sem confirmação.
3. **Prévia.** Use a tecnologia e os padrões do projeto existente, quando houver. Para uma demonstração independente simples, HTML e CSS podem bastar. Priorize serviços, localização e contato verificável. Rode a prévia localmente e use destinos reais para os botões disponíveis. Evite formulários que simulem envio bem-sucedido. Publicação e contato externo dependem de solicitação explícita.
4. **Verificação.** Abra a prévia no navegador. Teste navegação por teclado, foco visível, links e destinos de contato, e verifique erros de página, rolagem horizontal e conteúdo cortado. Em formulários existentes, use um ambiente de teste. Faça as correções e registre pendências.
5. **Apresentação.** Capture páginas equivalentes nas mesmas dimensões e compare desktop com desktop e celular com celular. Revise as quatro imagens e o cartão. Destaque apenas melhorias demonstradas pelas capturas ou pelos testes. Entregue a prévia, o diagnóstico com fontes, o cartão e as pendências. Inclua rascunho de abordagem somente se solicitado.

## Capturas e cartão

Prefira as ferramentas de navegador e dependências disponíveis no projeto. Para automatizar as quatro capturas com Node.js e Playwright, siga [capturas e cartão](references/capturas.md). Use esse mesmo guia para montar o cartão a partir de imagens já obtidas, sem precisar de Playwright.
