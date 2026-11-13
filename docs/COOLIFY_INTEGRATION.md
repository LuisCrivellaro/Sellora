# Publicação das demos (Coolify + GitHub)

Estado em 2026-11-13: **integração implementada e testada com mocks; nunca executada contra um Coolify real** (não há VPS, domínio nem credenciais configurados). Nada foi contratado, criado ou publicado.

O Coolify é infraestrutura interna: o lead só recebe o link da demo, enviado manualmente pelo administrador. Nenhuma mensagem é enviada pela Sellora.

## Como funciona

```
Leads → Demos / ficha do lead → "Publicação da demo" (botão Publicar, com confirmação)
        │ POST /api/publications/<leadId>  (só no app local, login/localhost, mesma origem)
        ▼
Serviço de publicação (src/lib/publishing/service.ts), uma operação por lead por vez
  1. Preparando: lê os arquivos do site V6 (<dados>/sites/<id>, hash conferido)
     e grava em <repo>/demos/<subdominio>/ num único commit (API Git Data do GitHub; sem commit se nada mudou)
  2. Preparando: aplicação Coolify do lead → do registro; senão procura pelo nome "sellora-demo-<subdominio>";
     senão cria (build pack static, nginx:alpine, base_directory = pasta da demo, sem deploy automático)
  3. Publicando: POST /api/v1/deploy?uuid=… e acompanha GET /api/v1/deployments/{uuid}
     (queued → in_progress → finished | failed | cancelled-by-user)
  4. Verificação: lê o fqdn da aplicação, baixa a página e compara o SHA-256 com o index.html gravado.
     Só então: "Publicado", URL salva no registro e no lead.
```

- Registro por lead em `<dados>/publications/<leadId>.json` (fora do Git), com histórico das operações, eventos e erros. O lead guarda um resumo em `leads.demo.publication` (JSONB já existente: **sem migration**).
- Estados: Aguardando publicação, Preparando aplicação, Publicando, Publicado, Falha na publicação, Suspenso (aplicação parada no Coolify), Removido (aplicação apagada no Coolify). **Verificar no Coolify** reconcilia o estado real e confere se o endereço responde com o conteúdo certo. Ao reabrir o app no meio de um deploy, a verificação retoma o acompanhamento.
- **Republicar** usa a mesma aplicação e o mesmo subdomínio, trocando a pasta pela versão atual da demo. Uma versão nova ainda não publicada não reaproveita o link anterior na mensagem copiada.
- Idempotência: uma operação ativa por lead (cliques repetidos devolvem a mesma), uuid da aplicação gravado logo após a criação, busca por nome antes de criar, no máximo 6 tentativas por hora por demo e 3 publicações simultâneas.
- **Coolify Deploy Agent** (Cloud 3D): representação do serviço, alimentada só pelas operações reais. Estados: `working` (preparando), `deploying` (publicando), `success` (por 3 min após a confirmação), `error` (falha na última publicação, até a próxima) e `idle`. Ver `docs/CLAW3D_INTEGRATION.md`.

## Variáveis de ambiente (servidor; `.env.local`, nunca no Git)

| Variável | Obrigatória | Para quê |
| --- | --- | --- |
| `COOLIFY_API_URL` | sim | Origem da instância, ex. `https://coolify.seudominio.com.br` (sem `/api/v1`). HTTPS obrigatório fora de localhost. |
| `COOLIFY_API_TOKEN` | sim | Token da API (Keys & Tokens → API tokens) com permissões **read, write e deploy**. Não use `root`. |
| `COOLIFY_PROJECT_UUID` | sim | Projeto do Coolify onde as demos ficam (crie um projeto "Sellora Demos"). |
| `COOLIFY_SERVER_UUID` | sim | Servidor onde as demos rodam. |
| `COOLIFY_ENVIRONMENT_NAME` | não | Ambiente do projeto (padrão `production`). |
| `COOLIFY_DESTINATION_UUID` | não | Destino Docker, se o servidor tiver mais de um. |
| `COOLIFY_GITHUB_APP_UUID` | não | GitHub App cadastrado no Coolify para repositório **privado**. Sem ele, o repositório das demos precisa ser público. |
| `SELLORA_DEMOS_GITHUB_REPO` | sim | `dono/repositorio` exclusivo das demos (ex. `LuisCrivellaro/sellora-demos`), com um primeiro commit. |
| `SELLORA_DEMOS_GITHUB_TOKEN` | sim | Token *fine-grained* com acesso **só a esse repositório**, permissão Contents: read and write. |
| `SELLORA_DEMOS_GITHUB_BRANCH` | não | Ramo (padrão `main`). |
| `SELLORA_DEMOS_GITHUB_PATH` | não | Pasta das demos no repositório (padrão `demos`). |
| `SELLORA_DEMOS_BASE_DOMAIN` | não | Domínio principal das demos, ex. `demos.seudominio.com.br` → `clinica-x.demos.seudominio.com.br`. Sem ele, o Coolify gera o endereço (curinga do servidor ou sslip.io, possivelmente sem HTTPS). |
| `COOLIFY_ALLOW_INSECURE_HTTP` | não | `1` aceita `http://IP:8000` (token sem criptografia). Só para o primeiro teste. |

O status (`GET /api/publications`) devolve apenas nomes de variáveis ausentes ou inválidas, nunca valores. Tokens são removidos de mensagens de erro e logs.

## Procedimento de conexão (o que falta fazer fora do código)

1. **VPS**: um servidor com Coolify v4 instalado (a Sellora não contrata nem cria servidores). Recomendação de baixo custo: uma VPS pequena só para demos estáticas (nginx:alpine usa poucos MB de RAM por demo).
2. **Domínio e DNS**: registro **curinga** `*.demos.seudominio.com.br` (A/AAAA) apontando para o IP da VPS; `SELLORA_DEMOS_BASE_DOMAIN=demos.seudominio.com.br`.
3. **HTTPS**: o Coolify emite os certificados Let's Encrypt pelo proxy (Traefik) quando o domínio da aplicação começa com `https://` — a integração já cria assim e força HTTPS. Para evitar um certificado por demo, dá para configurar um certificado curinga (desafio DNS) no proxy do Coolify; opcional.
4. **Painel do Coolify**: ativar a API (Settings → Advanced → API), criar o token (read, write, deploy), criar o projeto e anotar os UUIDs de projeto e servidor.
5. **GitHub**: criar o repositório das demos com um README; criar o token fine-grained restrito a ele. Para repositório privado, cadastrar o GitHub App no Coolify (Sources) e informar `COOLIFY_GITHUB_APP_UUID`.
6. Preencher o `.env.local`, reiniciar o app e testar a autenticação: `GET /api/publications?test=1` (responde a versão do Coolify ou o erro).
7. Publicar uma demo de teste ("… Teste Sellora") e conferir o endereço antes de publicar a de um lead real.

## Segurança

- Tudo passa pelo servidor local: as rotas exigem o app local (`requireLocalDemoAccess`), login no modo Supabase, e mesma origem nas escritas. O navegador nunca recebe tokens.
- Escopo mínimo: token do GitHub restrito ao repositório das demos; token do Coolify sem `root`. A integração não chama nenhum endpoint de exclusão: remover aplicações é decisão humana, no painel do Coolify.
- Endereços aceitos só com http(s), sem credenciais, sem portas incomuns e, havendo domínio principal, só dentro dele. Redirecionamento para outro host não conta como publicação.
- As demos publicadas recebem `X-Robots-Tag: noindex` (campo `noindex_domains` do Coolify) quando há domínio principal.
- Os arquivos publicados são o HTML gerado pela V6. No app local eles são servidos com CSP `sandbox`; no Coolify (nginx padrão) não há essa CSP. O HTML já passa pelo pós-processamento que remove scripts inline e atributos de evento.

## Limitações e pontos não validados

- Endpoints e campos conferidos no `openapi.yaml` oficial (branch v4.x, 2026-11-13) e no `ApplicationsController`; **não testados em instância real**. Em especial, conferir no primeiro uso se o build pack `static` serve a pasta definida em `base_directory` (o controlador define a porta 80 automaticamente para estáticos).
- O formato do campo `status` da aplicação (`running:healthy`, `exited:unhealthy`…) segue o padrão do Coolify; valores desconhecidos não mudam o estado nem viram sucesso.
- Repositório muito grande (árvore truncada pela API do GitHub) bloqueia a publicação com aviso; arquivar demos antigas em outro repositório.
- Os registros ficam no computador que publica (como as demos V6). Dois computadores publicando o mesmo lead não compartilham o registro; a busca por nome no Coolify evita aplicação duplicada, mas o histórico fica separado.
