# Histórico de criação das demos

## Conceitos aprovados em 12 de novembro de 2026

O usuário aprovou as duas propostas após a revisão local com Unique Site Designer. Os nomes, o segmento e a localização vieram do cadastro exibido no Sellora. Serviços específicos, endereço completo e horários aguardam confirmação. O telefone disponível no snapshot comercial aparece na seção de contato.

| Conceito e negócio | Composição e sequência | Tipografia e paleta | Mídia criativa | Copy e mensagem | Estado |
| --- | --- | --- | --- | --- | --- |
| `cravo-20261112`, Cravo e Canela, Beleza | Retrato lateral e abertura serifada, inspiração, visita e contato centralizado | Instrument Serif e DM Sans, creme, ameixa e terracota | Modelo fictícia criada por IA. Hash `d43965f9f268f486d2e0c4f107f074e231a190462524affcdcf74f42af04280d` | “Deixe aparecer quem você é.”, chamada “Comece pela sua inspiração” e abordagem sobre a criação de uma direção orgânica | Aprovado pelo usuário e integrado à v4 |
| `headmasters-20261112`, Headmasters Cabelo & Estética, Beleza | Abertura tipográfica larga, imagem horizontal, orientações em três colunas, perspectiva e contato azul | Barlow Condensed e DM Sans, grafite, branco e azul-cobalto | Natureza-morta criada por IA. Hash `c30cd256966365addc386d1e7ae4045e5b2c6af56d2d7eae0d07c24ca9aab1db` | “Seu visual. Sua assinatura.”, chamada “Encontre uma nova perspectiva” e mensagem que começa pedindo avaliação ao responsável pelo negócio | Aprovado pelo usuário e integrado à v4 |

## Comparação e cobertura

Foram comparados o catálogo de seis fotos em `public/demos/`, seus textos de segmento, as versões anteriores dos dois negócios vistas nesta conversa e as novas propostas renderizadas em computador e celular. Os retratos e a natureza-morta são gerações independentes, com origens e aparência diferentes da foto anterior do salão. Títulos, narrativa e mensagem foram relidos após retirar nomes e cidade. A conclusão de distinção cobre esse acervo e esse lote. Os avisos de demonstração e rótulos utilitários são compartilhados.

## Verificação no aplicativo

Os testes verificam geração individual e importação em lote, reimportação idempotente, aplicação sobre v3, persistência e validação do snapshot, conservação de mensagem editada e envio anterior, propriedade do conceito e rejeição de mídia arbitrária. A revisão detecta a mesma foto em outro negócio e mensagens com o mesmo molde após retirar os campos variáveis.

A verificação de navegador usa dados fictícios em contexto isolado. Abrange cartões, aplicação em lote, revisão incorporada, alternância computador/celular, aprovação de conceito próprio, pendência de foto repetida, abertura pública em outro navegador, recarga e larguras de 360, 390, 768 e 1440 pixels. As capturas locais estão em `test-results/approved-concepts/`. As propostas anteriores e sua verificação de contraste estão em `test-results/unique-site-review/`.

O painel tem um aviso preexistente de hidratação ao iniciar com a preferência de movimento reduzido, ligado a `useMotionEnabled`. A rota pública das novas demos usa a estrutura sem animações do painel. A checagem de composição tipográfica na v1 permanece manual. O catálogo v4 foi criado pelo agente. A geração integrada v5 descrita abaixo passa a executar a skill dentro do aplicativo.

## Geração integrada v5 em 2026-11-12

O Sellora executa a skill com a conta ChatGPT do Codex local, produz JSON validado, gera uma imagem com a ferramenta nativa e persiste o resultado no diretório de dados do aplicativo. A comparação inclui snapshots acessíveis no CRM e criações anteriores salvas pelo próprio gerador. São conferidos origem SHA-256, copy sem campos variáveis, contraste e composição efetiva da primeira dobra. A distinção visual e semântica além dessas verificações permanece na revisão interna.

O teste real usou dois leads fictícios do mesmo segmento com uma foto e uma mensagem repetidas em contexto isolado. A ação individual da revisão gerou para **Studio Horizonte de Teste** a abertura “O espelho é só o começo.” e uma natureza-morta de espelho e vidro azul, com origem `4bf7cae2d4008078b3715f189f76b5e5e008668a482c5f6b670fdf41a6b89ba7`. A imagem foi criada pelo Codex acionado pelo aplicativo, sem uma aprovação intermediária da imagem. A mensagem editada no teste foi conservada e a nova demo permaneceu pendente.

Capturas e resultado local em `test-results/runtime-generator/`. A prévia, a miniatura, a recarga, as âncoras e as larguras 360, 768 e 1440 px foram verificadas. Os seis layouts suportados também passaram pelas três larguras e por reflow com zoom de 200% em 1440 px. O lote e seu histórico sequencial, idempotência, edição concorrente, proteção da conta local e falha por limite foram verificados nos testes automatizados. A retomada da revisão do resultado usou o trabalho já concluído para repetir a QA sem consumir outra geração de imagem. Esse teste não substitui a revisão criativa de cada futura demo.

## Demos V6 de teste em 2026-11-12 (negócios fictícios "… Teste Sellora")

Sites locais em `.sellora-data/sites/<id>` (fora do Git). Textos e código: Claude Sonnet 5.5; imagens: Codex (3 por demo).

| Demo | Site | Hero (arquétipo) | Fontes | Observação |
| --- | --- | --- | --- | --- |
| Barbearia, Campinas/SP | `f2d9b0ce-…` | foto-painel (painel creme no canto inferior esquerdo) | Big Shoulders Display + Figtree | Telefone válido: WhatsApp e ligação |
| Restaurante, Ribeirão Preto/SP | `871275a1-…` | foto-painel (faixa escura) | Young Serif + Hanken Grotesk | Telefone inválido no teste: "Ligar para" sem número (bug corrigido depois) |
| Clínica odontológica, Sorocaba/SP | `9469cd61-…` | foto-painel (painel creme) | Young Serif + Figtree | Mesmo bug do telefone |
| Oficina Motor Certo (lead fictício do CRM de demonstração), Sumaré/SP | `562f0fac-…` | colunas (texto à esquerda, foto recortada à direita) | Big Shoulders Display + corpo sem serifa | Gerada pela UI; telefone fictício válido do seed: WhatsApp e ligação |
| Pet Shop, Indaiatuba/SP (no `.exe`, perfil isolado) | `dd4ed016-…` | tipografico | serifada de destaque + Figtree | Histórico vazio no perfil isolado |
| Restaurante v2 | `fd67a0e7-…` | tipografico (fundo verde, título gigante, foto em faixa) | Bricolage Grotesque + Source Serif 4 | Depois da rotação de arquétipos e da correção do telefone: só "Ver como chegar" |

Achado da comparação: as três primeiras variavam paleta e tipografia, mas repetiam a estrutura do hero. O guia V6 passou a exigir um arquétipo nomeado e o gerador recusa o arquétipo das duas demos mais recentes de qualquer segmento. Fontes já usadas no acervo de teste: Young Serif aparece duas vezes (restaurante e clínica), um ponto a vigiar se a repetição de fontes entre segmentos virar padrão.

## Identidade estruturada e calibração (2026-11-13)

O V6 passou a gravar em cada demo uma identidade visual (`summary.identity`: arquétipo do hero, funções das seções, fontes e categoria, tom, fundo e destaque, proporção da imagem, palavras do estilo fotográfico, título sem nome/cidade, chamadas). A comparação (`src/lib/demos/v6/identity.ts`) pesa hero 22%, seções 20%, tipografia 16%, paleta 12%, título 10%, imagem 8%, fotografia 6% e chamadas 6%. Repetição: ≥ 62% no mesmo segmento, ≥ 72% entre segmentos; "parecida" (nota para revisão): ≥ 45% e ≥ 50%. Estrutura igual com troca de cor é tratada como repetição.

Calibração com os briefs reais das cinco demos de teste acima (fixture `src/lib/demos/v6/fixtures/calibration-history.json`, só campos de comparação):

| Par | Semelhança | Veredito | Por quê |
| --- | --- | --- | --- |
| Restaurante v1 × Clínica | 81% | repetição com troca de cor | mesmo hero foto-painel, mesmo esqueleto, Young Serif nas duas |
| Barbearia × Clínica | 72% | repetida | mesmo hero e esqueleto, paleta creme |
| Barbearia × Restaurante v1 | 68% | parecida | mesmo hero; fontes diferentes |
| Oficina × Barbearia | 53% | parecida | hero diferente, mas Big Shoulders + Figtree e o mesmo esqueleto |
| Restaurante v2 × Restaurante v1 | 26% | distinta | tipográfico, fundo escuro, outras fontes e seções |

Regras de acervo aplicadas além da comparação par a par: hero fora das duas demos mais recentes; fonte de destaque fora das quatro mais recentes e do mesmo segmento; fonte de leitura em no máximo uma das quatro mais recentes; esqueleto de funções de seção em no máximo uma das seis mais recentes. Com essas regras, a oficina e a clínica teriam sido replanejadas antes do código (teste `identity.test.ts`).

Limites: demos gravadas antes de 2026-11-13 só têm hero, fontes, paleta, seções e título — a comparação usa esses eixos e o relatório informa quantas demos tinham identidade parcial. O histórico comparado é o do CRM e o dos trabalhos salvos neste computador; demos de outros computadores não entram. Qualidade estética, adequação da imagem e naturalidade do texto continuam na revisão humana (capturas no relatório).
