# Capturas e cartão

Use caminhos absolutos quando o script estiver fora do projeto. Em ambos os comandos, use uma pasta de saída nova ou reservada para as capturas do caso.

## Capturar no navegador

O script aceita Playwright ou Playwright Core já disponível no projeto. Caso a resolução automática falhe, informe em `PLAYWRIGHT_MODULE` o caminho absoluto para o pacote. É preciso ter um Chromium compatível disponível no Playwright. Em caso de indisponibilidade, use o navegador disponível para gerar as imagens e passe à montagem do cartão.

```text
node <skill>/scripts/capturar.mjs <url-atual> <url-da-previa> <pasta-de-capturas>
```

O comando abre as duas páginas em 1440 × 900 e 390 × 844 e salva quatro PNGs. Também informa URLs finais, erros de JavaScript, erros de console e rolagem horizontal observada. Se falhar em uma captura, verifique a página e repita antes de montar o cartão. Revise visualmente os arquivos para identificar páginas de erro, banners que ocultem conteúdo e elementos excluídos pelo escopo. Se precisar recapturar ou editar uma região, preserve as dimensões equivalentes.

## Montar o cartão

Salve as imagens na pasta de capturas com os nomes abaixo. Use PNGs da mesma área da página em cada par.

- `antes-desktop.png`
- `depois-desktop.png`
- `antes-celular.png`
- `depois-celular.png`

```text
node <skill>/scripts/comparar.mjs <pasta-de-capturas> "Nome do negócio"
```

Abra `antes-e-depois.html` no navegador e confira os pares. O arquivo incorpora as quatro imagens e pode ser aberto offline. Para entregar como imagem, capture o cartão renderizado em uma largura que mantenha os rótulos e as duas colunas legíveis.
