---
name: local-client-prospector
description: Encontrar e qualificar estabelecimentos locais (lojas, academias, restaurantes, salões, clínicas, serviços) perto de uma cidade que podem precisar de site, verificando se têm site próprio ou só redes sociais e classificando em HOT/WARM/LOW/SKIP com score 0–100 justificado. Usar ao montar listas de prospecção da Sellora, no chat ou para conferir resultados da aba "Prospecção IA".
---

# local-client-prospector (adaptada para Claude Code / Sellora)

Adaptação da skill MIT `Kappaemme-git/local-client-prospector-skill` (commit `2340d02`, ver `ORIGEM.md`), escrita para o Codex. Mantém o fluxo original — **pesquisa → verificação de presença digital → classificação** — com as regras da Sellora (`CLAUDE.md`, `docs/PRODUCT_CONTEXT.md`) e os critérios de classificação do código do app (`src/lib/prospecting/classify.ts`), para que o chat e a aba "Prospecção IA" deem o mesmo resultado.

## Dois modos de uso

1. **Aba "Prospecção IA" em `/leads`** (executor do app): o servidor do Next.js consulta o OpenStreetMap (Nominatim + Overpass), confere os sites encontrados por HTTP e classifica. Não usa navegador nem IA generativa; só fontes abertas. Ativação: `PROSPECCAO_EXECUTOR=osm` em `.env.local` (ver README). Use esta skill para **revisar** esses resultados quando a ausência de site estiver marcada como "não verificada".
2. **No chat do Claude Code** (pesquisa assistida): siga o fluxo abaixo com as ferramentas que existirem **de fato** na sessão. Verifique antes de usar; não presuma:
   - `WebSearch` (busca na web) e `WebFetch` (ler uma página pública);
   - navegador embutido do app desktop (`mcp__Claude_Browser__*`) ou Claude in Chrome, se o usuário pedir;
   - sem nenhuma ferramenta de busca, diga isso e pare: não invente candidatos.

## Entradas

Se faltar algo, use o padrão e siga; pergunte só se faltar a cidade.

- `cidade` e `uf` (obrigatório), ou um endereço/ponto de referência.
- `raio_km`: 5, 10, 20 (padrão) ou 50.
- `segmento`: restaurantes, saúde, academias, beleza, serviços, comércio ou todos.
- `maximo`: 10, 20 (padrão), 50 ou 100. Prefira menos leads verificados a muitos palpites.
- `oportunidade`: sem site, site desatualizado, só redes sociais ou todas (padrão).
- `saida`: tabela no chat (padrão), CSV/JSON (colunas abaixo) ou importação no CRM pela aba.

## Regras de conformidade (LGPD e plataformas)

- Pesquisa assistida, **não** raspagem em massa. Não contornar CAPTCHA, login, limites de requisição, bloqueios ou paywall.
- Não extrair nem revender dados do Google Maps em escala; usar o Maps só como apoio de descoberta e conferir em fontes independentes.
- Só dados **comerciais públicos**: nome, telefone comercial, site, perfil comercial, endereço do estabelecimento. Nada de CPF, telefone/e-mail pessoal ou dados de funcionários.
- **Nunca** enviar mensagens, ligar ou seguir perfis. O contato é humano, individual e posterior (skill `sales-strategy`).
- Dados do OpenStreetMap: © colaboradores do OpenStreetMap, licença ODbL — citar a fonte.

## Fluxo de pesquisa

1. Buscar a categoria perto da cidade (busca web, OpenStreetMap ou diretórios públicos) e montar a lista de candidatos.
2. Para cada candidato, consultar fontes públicas suficientes para preencher os campos.
3. **Buscar o nome exato + cidade** para saber se existe site próprio. Sem essa busca, a ausência de site fica "não verificada".
4. Classificar a presença digital:
   - `sem_site`: nenhum site próprio crível após a busca;
   - `so_redes`: só Instagram, Facebook, WhatsApp, Linktree, iFood, página de agendamento ou marketplace;
   - `site_com_problemas`: site próprio desatualizado, quebrado, sem versão mobile, sem HTTPS, em domínio gratuito ou sem contato claro;
   - `site_adequado`: site próprio crível e funcional.
5. Registrar o nível de evidência de cada afirmação:
   - **verificado**: conferido por ferramenta (a página respondeu, a tag existe ou não existe);
   - **fonte**: declarado por uma fonte pública e não conferido de forma independente;
   - **não verificado**: pendente (ex.: ausência de site sem busca pelo nome).

## Classificação (mesma regra do app)

| Classe | Quando |
|---|---|
| **HOT** | Sem site próprio (`sem_site` ou `so_redes`) e com algum canal comercial público. |
| **WARM** | Site próprio com pelo menos um problema **verificável** (fora do ar, sem HTTPS, sem meta viewport, rodapé com ano antigo, sem link de telefone/WhatsApp, domínio gratuito, sem título). |
| **LOW** | Site próprio no ar sem problemas detectados (presença adequada). |
| **SKIP** | Duplicado, rede/franquia, fechado, sem nome ou sem nenhum canal de contato (dados insuficientes), fora do raio ou categoria irrelevante. |

Nunca marque HOT se um site próprio foi encontrado. Problema só entra na lista se for verificável; impressões subjetivas ("visual ruim") vão para observações como hipótese.

## Score 0–100 (critérios documentados)

- **Presença digital (até 50):** sem site 50 · só redes/plataforma 45 · site fora do ar 40 · site com problemas 15 + 7 por problema (máx. 40) · site adequado 5.
- **Contato comercial (até 25):** telefone 15 · rede social 5 · e-mail comercial 5.
- **Sinais de atividade (até 15):** horário de funcionamento publicado 8 · endereço completo 7.
- **Proximidade (até 10):** até 25% do raio 10 · até 50% 6 · além disso 3.
- **SKIP = 0.**

Confiança: **alta** quando o site foi conferido por HTTP; **média** quando a fonte aponta só redes sociais como site; **baixa** quando a ausência de site vem de uma única fonte, sem busca pelo nome.

## Saída

Tabela no chat:

| Classe | Score | Estabelecimento | Segmento | Cidade | Distância | Presença | Site/Redes | Telefone | Por que é oportunidade | Confiança |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |

- "Não encontrado" em vez de campo vazio; justificativa curta e acionável.
- Depois da tabela: **Melhores primeiros alvos** (3 leads, um motivo prático cada) e o que ficou incerto.
- Informar cidade, raio, segmentos, data e ferramentas usadas.

CSV (mesmas colunas da exportação da aba, `assets/lead-template.csv`):

```csv
classificacao,score,confianca,nome,segmento,cidade,uf,distancia_km,presenca,website,instagram,outras_redes,telefone,problemas,justificativa,fontes,data_pesquisa
```

## Antes de entregar

- Remover duplicados (nome normalizado + cidade, telefone, domínio ou @).
- Conferir se já existe no CRM da Sellora antes de sugerir importação.
- Toda afirmação de "sem site" tem a busca pelo nome registrada ou está marcada como não verificada.
- Nada de avaliações, problemas ou contatos inventados. Lista vai para revisão humana antes de qualquer contato.
