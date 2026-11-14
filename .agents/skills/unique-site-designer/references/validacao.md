# Comparação e checklist de validação

## Histórico de comparação

Comece pelas demos anteriores, capturas ou catálogo já disponíveis no contexto autorizado. Ao revisar uma nova direção, atualize o histórico existente para que a próxima geração possa consultá-lo. Se for o primeiro registro e a tarefa permitir gravação no repositório, use `docs/DEMO_DESIGN_HISTORY.md`. Se a revisão estiver em outro local, inclua a ficha no material de revisão. Registre apenas referências autorizadas para aquele local. Prefira identificadores internos da demo a links públicos com dados no fragmento.

| Demo, data e nicho | Evidência em computador e celular | Layout, ordem de seções e navegação | Tipografia e paleta | Imagens | Copy e CTA | Resultado da revisão |
| --- | --- | --- | --- | --- | --- | --- |

Em **Imagens**, anote o papel de cada imagem criativa, o ID ou a origem, a licença ou autorização e o hash SHA-256 quando o arquivo estiver disponível. Registre a origem antes do recorte. Em **Copy**, anote títulos, trechos-chave, CTA e a abertura da mensagem, se houver, omitindo dados pessoais e informações internas. Use links autorizados para material mais longo. Registre prévias candidatas dentro do lote assim que forem escolhidas, para que a próxima rodada compare com elas também.

Para a avaliação visual, escolha a demo mais parecida do mesmo nicho e inclua outras prévias relevantes do histórico e do lote. Compare a abertura e as demais seções com larguras equivalentes. Se o nicho ainda estiver sem referência, use demos visualmente próximas. Use todos os registros acessíveis para conferir colisões de imagem ou texto. Quando houver apenas o código ou o catálogo, identifique a revisão como estática e deixe a comparação renderizada pendente.

## Critério de aprovação

A primeira dobra deve continuar distinguível quando o nome e a cor de destaque forem ocultados. A sequência da página e a forma de guiar até a ação principal devem ter uma razão ligada ao conteúdo. Para o vizinho mais semelhante, descreva diferenças concretas em composição, estrutura das seções, tipografia, paleta, direção de imagens, texto e identidade visual. Se a marca já definir fontes ou cores, registre a restrição e obtenha a diferença pelos demais eixos. Rótulos convencionais como **Contato**, avisos de demo e componentes utilitários podem ser compartilhados.

## Originalidade estruturada

Compare por eixos, do mais estrutural ao mais superficial. Semelhança relevante é a que sobrevive quando nome e cor são ocultados; coincidências utilitárias (mesmo rótulo "Ver como chegar", mesma fonte de leitura, seção Contato) não reprovam sozinhas.

| Eixo | Peso no V6 | O que conta como repetição |
| --- | --- | --- |
| Arquétipo do hero | alto | mesmo arquétipo (foto-painel, colunas, tipográfico, moldura, grade, cor sólida, faixa panorâmica, índice) das duas demos mais recentes |
| Esqueleto de seções | alto | mesma sequência de funções (hero → apresentação → oferta → processo → perguntas → contato) em duas das seis mais recentes |
| Tipografia | médio | mesma fonte de destaque entre as quatro mais recentes ou no mesmo segmento; mesma fonte de leitura em duas das quatro mais recentes |
| Paleta | médio | conta, mas trocar só a cor de uma estrutura igual é **repetição com troca de cor** |
| Imagem | médio | mesma proporção e mesmo tipo de cena (ambiente amplo, detalhe, natureza-morta, mãos) |
| Título e chamadas | baixo | mesma construção depois de retirar nome, cidade e UF |

No V6 a comparação é automática (`identity.ts`): acima do limite de repetição o briefing é replanejado antes do código; entre "parecida" e "repetida" a demo segue com nota para revisão humana. Demos gravadas antes da identidade estruturada são comparadas só pelos eixos que existem nelas (hero, fontes, paleta, seções e título); registre essa cobertura parcial.

## Qualidade da imagem

- A especificação nasce da direção de arte (assunto, contexto, estilo, luz, enquadramento, profundidade, proporção, área livre para texto, cores e restrições), nunca de um pedido genérico.
- Pessoas fictícias em situação realista do segmento (atendendo, trabalhando, conversando) são permitidas e ajudam o impacto, desde que a demo nunca as apresente como a equipe, os clientes ou o local reais. Recuse imagem com texto legível, logotipo, placa, pessoa real ou famosa reconhecível, fachada que pareça o local real, produto de marca, ou que sugira credencial, resultado ou serviço não confirmado. Recuse também a que contradiz a paleta ou o tom.
- Num conjunto de até três imagens (V6), cada uma tem papel próprio no layout; duas fotos com o mesmo assunto e enquadramento contam como repetição.
- Uma composição gráfica no lugar da imagem (gerador indisponível) nunca conta como demo aprovada: fica pendente até a imagem ser gerada.

Uma foto criativa reaproveitada entre negócios reprova a revisão. Compare a origem e o hash disponível. Verifique lado a lado reenquadramentos, espelhamentos, filtros, arquivos renomeados e versões exportadas do mesmo original. Quando o acervo disponível estiver esgotado, faça uma nova seleção com direitos verificados ou use um conceito sem fotografia adequado ao briefing.

Uma frase criativa ou mensagem de abordagem reaproveitada entre negócios também reprova. Para detectar o molde, retire temporariamente nomes, cidades, links e variáveis. Ignore diferenças de acento, caixa, pontuação e espaços. Releia o que sobrou e procure uma abertura, construção de promessa ou sequência de argumentos reaproveitada com trocas cosméticas. A nova redação deve refletir informações confirmadas do negócio ou explicar a proposta específica da demo. Trate preços, serviços, avaliações, resultados, endereço e horários sem confirmação como pendências.

## Checklist da prévia

- [ ] Histórico e lote comparados. Registrei as demos usadas, as evidências e as lacunas de cobertura.
- [ ] Abertura, grid, ordem das seções e hierarquia de conteúdo distinguíveis em comparação lado a lado. A prévia apresenta o negócio de forma clara com as informações disponíveis.
- [ ] Fontes, pesos, escala tipográfica, paleta e tratamento de imagem sustentam a direção escolhida. Restrições de marca registradas quando aplicáveis.
- [ ] Imagens criativas sem colisões de origem ou aparência no acervo verificado. Imagem gerada conferida no recorte de computador e celular, com origem, hash e indicação de uso ilustrativo registrados. Mídia de terceiros com autorização ou licença conferida. Texto alternativo revisado.
- [ ] Título, introdução, textos de seção, CTA criativo e mensagem de abordagem no escopo revisados após remover campos variáveis. Alegações conferidas e CTA compatível com a ação disponível.
- [ ] Prévia renderizada em **360, 768 e 1440 px**. Layout recomposto no celular, sem corte ou rolagem horizontal involuntária. Verifique zoom de 200% e se o CTA continua visível e utilizável.
- [ ] Contraste medido, ordem de títulos e navegação por teclado conferidas. Foco visível, elementos com nomes acessíveis, interação por toque e movimento reduzido quando houver animação.
- [ ] Âncoras e chamadas existentes funcionam dentro da prévia. Dados pendentes e recursos conceituais estão identificados. Imagens carregam nas dimensões previstas e fontes têm alternativas legíveis.
- [ ] Miniatura, prévia interna e `/demo#…` mostram a mesma direção quando forem afetadas. A identificação de demonstração aparece na prévia. O visual é consistente ao recarregar.
- [ ] Colisões corrigidas, evidências e verificações pendentes registradas. A demo está pronta para revisão interna.
