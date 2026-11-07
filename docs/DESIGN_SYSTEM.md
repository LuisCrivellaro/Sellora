# Design system — Sellora Dashboard

**Direção aprovada (2026-11-07): Premium Monochrome Dark.** Preto, grafite e cinza na estrutura, seguindo o briefing e a referência visual do usuário. Substitui os fundos, navegação e acentos estruturais roxos da direção anterior. Layout, componentes, animações e funcionalidades permanecem iguais; cores informativas dos dados e gráficos são preservadas.

## Conceito: vitrine acesa à noite
A Sellora leva estabelecimentos para a vitrine digital. O painel usa superfícies neutras e discretas, deixando as cores para a informação. A paleta de dados mantém significado fixo e seus tokens históricos `--neon-*`:

| Neon | Token | Significa |
|---|---|---|
| Magenta | `--neon-magenta` | Demanda, novo, atenção (leads novos, pendências) |
| Violeta | `--neon-violet` | Em andamento (contato, produção, negociação); séries de dados |
| Lilás | `--neon-lilac` | Série secundária em gráficos |
| Menta | `--neon-mint` | Concluído, online, recebido (site publicado, pagamento recebido, venda ganha) |
| Índigo | `--neon-indigo` | Categoria neutra adicional |
| Âmbar / vermelho | `--signal-warn` / `--signal-danger` | Prazo próximo / vencido, destrutivo |

**Assinatura:** barra segmentada "acendendo" (segmentos que acendem até o valor, marcador branco na fronteira). Aparece em origem de leads, pipeline, progresso de projetos, sites contratados, valores de propostas e recebimentos.

## Refinamento de paleta (2026-11-07)
**Estrutura:** fundo #111111; sidebar/header #141414; cards #1C1C1C; superfície elevada #202020; inputs #171717; hover #292929; seleção #303030. Botão primário #E5E5E5 com texto #171717; secundário #272727 com hover #343434. Texto principal #F5F5F5, secundário #A3A3A3 e metadados #999999 (ajuste da base #777777 para manter contraste em fontes pequenas e seleções). Bordas #262626/#303030, divisórias de tabela #292929 e hover #454545. Foco neutro. Logo e avatares usam cinzas, sem alterar formas ou tamanhos.

**Dados preservados:** roxo #8866BD, lilás #A891D1, magenta #BB6BA5, menta #5FBF9F, índigo #7473C4, âmbar #D8A75A e vermelho #D9677B. `--data-muted` mantém o neutro semântico anterior (#908C9C) para status, badges e valores zerados, desacoplado do texto estrutural. Não recolorir séries, barras, roscas, heatmaps, progresso, valores financeiros, prioridades, estados e alertas ao mudar o tema. Sombras coloridas ficam restritas aos dados existentes; containers não usam glow roxo.

## Financeiro
Valores monetários positivos usam verde (`--money-positive`), negativos usam vermelho (`--money-negative`) e zero usa texto neutro em todo o dashboard, incluindo formulários, propostas e notificações. Despesas e descontos são apresentados como valores negativos, preservando os valores armazenados. O componente `Money` centraliza a apresentação e mantém os contadores animados. No Financeiro, `--fin-in` e `--fin-out` seguem essas cores; cards `.fin-card` (raio 26px) mantêm as superfícies globais, pills usam `pill-active` e o tooltip usa fundo escuro para preservar o contraste dos valores coloridos.

## Tokens (fonte: `src/app/globals.css`)
- **Superfícies:** `--night` (fundo), `--sidebar-surface`, `--header-surface`, `--facade` (card), `--facade-raised` (popover, cabeçalho de tabela), `--facade-inset` (inputs). Elevação por luminosidade neutra.
- **Texto:** `--ink` (primário), `--ink-soft` (secundário), `--ink-faint` (terciário/eixos), `--ink-ghost` (segmentos apagados, desabilitado).
- **Bordas:** `--seam` (sutil), `--seam-strong` (padrão), `--seam-lit` / `--border-hover` (ênfase), `--table-line` (divisórias), `--focus` / `--focus-ring` (foco neutro).
- **Interação:** `--primary` / `--primary-ink` / `--primary-hover`; `--secondary` / `--secondary-hover`; `--selected`, `--interactive`, `--nav-accent` e `--nav-line`. Independentes dos tokens dos dados.
- **Documento:** a prévia imprimível de proposta mantém papel claro, agora neutro (`--paper-*`), e os valores monetários conservam suas cores.
- **Raios:** card 18px · tile/ícone 10px · controles e navegação em pill (999px) · células de heatmap 5px.
- **Espaço:** base 4px; gap entre cards 12–16px; padding de card 16–20px.
- **Profundidade:** bordas finas e sombras pretas sutis; sem glow ou gradientes roxos em superfícies estruturais.

## Tipografia
Manrope (variável, Google Fonts via `next/font`), uma família só. Geométrica e levemente arredondada como os pills; mais caráter que Inter e compacta o suficiente para densidade. Números sempre com `tabular-nums`. Escala: 12 (eixos/metadados) · 13 (tabelas, labels) · 14 (corpo) · 15–16 (títulos de card) · 20–28 (números de destaque). Sem caixa-alta espaçada.

## Layout
- Sidebar compartilhada com logo e nome Sellora, usando o BranchedMenu do React Bits fornecido no briefing: Visão geral (Home), Comercial (Leads, Clientes, Projetos, Propostas) e Gestão (Financeiro, Configurações). Rotas reais em `nav-config.ts`, links Next.js e seleção controlada pela URL. Linhas ramificadas em cinza, seções expansíveis e indicador ativo branco sobre seleção grafite; animações preservadas.
- Desktop (> 1024px): sidebar fixa de 264px; conteúdo à direita com padding de 24px, sem limite artificial de largura. Header simplificado com identificação da página, busca global, notificações/configurações rápidas e perfil.
- Tablet (768–1024px): sidebar de ícones com 76px, expansível para 264px; conteúdo acompanha a largura com transição suave. Mobile (< 768px): botão no header abre drawer esquerdo com overlay, foco contido, bloqueio da rolagem do fundo e fechamento por seleção, Escape ou clique externo.
- Grid de cards de 12 colunas ocupa o espaço disponível; tabelas mantêm rolagem horizontal própria e viram cartões no celular. CSS do menu e da estrutura fica em arquivos com seletores exclusivos da sidebar.

## Motion (`src/lib/motion.ts`)
- Entrada: header fade; cards sobem 12px com fade em 320ms, stagger 50ms.
- Gráficos: linhas desenhadas (stroke-dashoffset) 900ms; barras crescem 700ms; donut revela 800ms; contadores até 900ms.
- Navegação: traçado SVG da ramificação em 400ms, expansão de seções em 300ms e marcador lateral móvel; conteúdo troca em 200ms sem remontar a sidebar. Preferências de movimento reduzido desativam as transições do menu e do layout.
- Interação: hover/press 120–160ms; popover/modal 180–220ms; saída mais curta que entrada.
- `prefers-reduced-motion` **e** preferência em Configurações (Completo / Reduzido / Sistema): no modo reduzido não há deslocamento, desenho ou contagem; estados e conteúdo aparecem prontos.
- Só `transform`/`opacity`/`stroke-dashoffset`; sem scroll-jacking, parallax ou loops infinitos.

## Dados e visualização
- Todo número é derivado do repositório de dados; dados iniciais são **fictícios** com selo **Demonstração** na sidebar expandida e no drawer. O perfil e o aviso do modo local continuam acessíveis no header/conteúdo.
- KPIs com período e definição; gráficos com legenda, tooltip por ponteiro **e teclado**, `aria-label` com resumo e estado vazio.
- Radar usa métricas normalizadas 0–100 com fórmula explicada no tooltip.

## Qualidade de UI
Rótulo pelo resultado; labels persistentes; validação inline (Zod); confirmação em ações destrutivas; toasts com `aria-live`; foco visível em todo controle; Kanban operável por menu "Mover para…"; testes em 360 / 768 / 1366 / 1440 / 1920. Revisão: `design-review`; gate P0/P1/P2 em `docs/WORKFLOW.md` §6.
