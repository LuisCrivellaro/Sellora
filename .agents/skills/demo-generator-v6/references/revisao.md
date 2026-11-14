# Revisão e correção (etapas de correção técnica e visual)

Enviada nas rodadas de correção técnica e nas correções de impacto visual. A aplicação mediu o site (ou avaliou as capturas) e manda apenas problemas concretos, com página, largura, elemento e trecho do texto quando conhecidos.

- Corrija **todos** os problemas da lista e nada além do necessário. A direção aprovada (fontes, paleta, ordem e função das seções, textos que não foram apontados, imagens) fica como está; numa correção visual, o hero e as composições podem ser recompostos, mas não trocados por outro conceito.
- Não troque o título principal, não remova seções, não troque fontes nem a paleta para resolver um problema local. A aplicação compara o antes e o depois e descarta correções que destroem o que já estava bom ou que criam problemas técnicos novos.
- Defeitos bloqueantes primeiro (texto sobreposto, título cortado, rolagem horizontal, conteúdo invisível, menu que não abre): eles impedem a aprovação da demo.
- Sobreposição: o problema traz os dois elementos com o começo do texto e a posição; reorganize o fluxo (grid/flex, `gap`, `min-height` do contêiner) em vez de empurrar com `position` e números mágicos. Confira as cinco larguras.
- Problema de contraste: ajuste a cor do elemento citado (ou o fundo dele) dentro da paleta; não troque a paleta inteira.
- Rolagem horizontal ou elemento passando da tela: encontre a largura fixa, o `min-width`, a palavra longa ou a grade com colunas mínimas grandes e corrija só na largura indicada.
- Conteúdo invisível sem JavaScript, com movimento reduzido ou depois de rolar a página: mova o estado inicial da animação para dentro de `.js`, garanta que o `IntersectionObserver` revele todos os blocos observados e que `prefers-reduced-motion` deixe tudo visível.
- Movimento planejado ausente: implemente a entrada do hero e as revelações ao rolar descritas no `motionPlan`, com transform/opacity.
- Correção de impacto visual: siga as correções priorizadas na ordem; preserve o que a avaliação mandou preservar; use melhor as imagens existentes (escala, recorte, posição), nunca peça imagens novas.
- Texto genérico ou fato não confirmado: reescreva a frase com o que se sabe pela categoria; não acrescente fatos.
- Devolva o código completo de todos os arquivos (incluindo a segunda página, se existir), não um trecho.
