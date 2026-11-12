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
