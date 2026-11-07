# Design system — Sellora Dashboard

**Direção aprovada (2026-11-06):** painel escuro premium, fiel à linguagem de quatro imagens de referência fornecidas pelo usuário (dashboard de cibersegurança dark com neon violeta/magenta). Substitui a direção inicial neutra/teal com sidebar (ver `docs/DECISIONS.md`). A Sellora usa a **linguagem** das referências com identidade, dados e marca próprios; nenhum logo, nome ou ativo das referências é reproduzido.

## Conceito: vitrine acesa à noite
A Sellora leva estabelecimentos para a vitrine digital. O painel é a rua à noite: fundo quase preto, fachadas escuras (cards) e letreiros em neon que acendem conforme o negócio avança. A cor tem significado fixo:

| Neon | Token | Significa |
|---|---|---|
| Magenta | `--neon-magenta` | Demanda, novo, atenção (leads novos, pendências) |
| Violeta | `--neon-violet` | Em andamento (contato, produção, negociação) — cor primária de ação |
| Lilás | `--neon-lilac` | Série secundária em gráficos |
| Menta | `--neon-mint` | Concluído, online, recebido (site publicado, pagamento recebido, venda ganha) |
| Índigo | `--neon-indigo` | Categoria neutra adicional |
| Âmbar / vermelho | `--signal-warn` / `--signal-danger` | Prazo próximo / vencido, destrutivo |

**Assinatura:** barra segmentada "acendendo" (segmentos que acendem até o valor, marcador branco na fronteira). Aparece em origem de leads, pipeline, progresso de projetos, sites contratados, valores de propostas e recebimentos.

## Refinamento de paleta (2026-11-07)
Neon suavizado para uso prolongado: roxo #8866BD, lilás #A891D1, magenta #BB6BA5, menta #5FBF9F, índigo #7473C4, âmbar #D8A75A, vermelho #D9677B; superfícies grafite-roxo (#101014 → #1A1920 → #24222B). Glow apenas onde reforça hierarquia (item ativo, ponto selecionado), com blur curto e baixa opacidade.

## Financeiro
Usa a paleta principal da Sellora: entradas/recebimentos em lilás (`--fin-in` → `--neon-lilac`), saídas em magenta (`--fin-out` → `--neon-magenta`), cards `.fin-card` (raio 26px) com as superfícies globais, pills com `pill-active` e tooltip lilás com texto escuro.

## Tokens (fonte: `src/app/globals.css`)
- **Superfícies:** `--night` (fundo), `--facade` (card), `--facade-raised` (popover, cabeçalho de tabela), `--facade-inset` (inputs). Elevação = passos de luminosidade de poucos pontos, mesma matiz.
- **Texto:** `--ink` (primário), `--ink-soft` (secundário), `--ink-faint` (terciário/eixos), `--ink-ghost` (segmentos apagados, desabilitado).
- **Bordas:** `--seam` (padrão, rgba baixa), `--seam-strong` (ênfase), `--seam-lit` (item ativo, contorno claro), `--focus` (anel de foco).
- **Raios:** card 18px · tile/ícone 10px · controles e navegação em pill (999px) · células de heatmap 5px.
- **Espaço:** base 4px; gap entre cards 12–16px; padding de card 16–20px.
- **Profundidade:** bordas finas + brilho interno discreto (inset highlight no topo) + glow radial apenas em cards de gráfico principal. Sem sombras pesadas.

## Tipografia
Manrope (variável, Google Fonts via `next/font`), uma família só. Geométrica e levemente arredondada como os pills; mais caráter que Inter e compacta o suficiente para densidade. Números sempre com `tabular-nums`. Escala: 12 (eixos/metadados) · 13 (tabelas, labels) · 14 (corpo) · 15–16 (títulos de card) · 20–28 (números de destaque). Sem caixa-alta espaçada.

## Layout
- Header superior: logo · navegação em pill com 7 destinos (ícone + nome) · busca global · notificações/configurações · perfil. Sem sidebar no desktop.
- Grid de cards de 12 colunas, alto aproveitamento da área útil, `max-width` 1600px.
- < 1280px: navegação com overflow horizontal acessível; < 768px: menu compacto (sheet) com os 7 destinos; cards empilhados; tabelas viram lista de cartões.

## Motion (`src/lib/motion.ts`)
- Entrada: header fade; cards sobem 12px com fade em 320ms, stagger 50ms.
- Gráficos: linhas desenhadas (stroke-dashoffset) 900ms; barras crescem 700ms; donut revela 800ms; contadores até 900ms.
- Navegação: indicador ativo desliza (shared layout); conteúdo troca em 200ms sem flash.
- Interação: hover/press 120–160ms; popover/modal 180–220ms; saída mais curta que entrada.
- `prefers-reduced-motion` **e** preferência em Configurações (Completo / Reduzido / Sistema): no modo reduzido não há deslocamento, desenho ou contagem; estados e conteúdo aparecem prontos.
- Só `transform`/`opacity`/`stroke-dashoffset`; sem scroll-jacking, parallax ou loops infinitos.

## Dados e visualização
- Todo número é derivado do repositório de dados; dados iniciais são **fictícios** com selo **Demonstração** permanente no header.
- KPIs com período e definição; gráficos com legenda, tooltip por ponteiro **e teclado**, `aria-label` com resumo e estado vazio.
- Radar usa métricas normalizadas 0–100 com fórmula explicada no tooltip.

## Qualidade de UI
Rótulo pelo resultado; labels persistentes; validação inline (Zod); confirmação em ações destrutivas; toasts com `aria-live`; foco visível em todo controle; Kanban operável por menu "Mover para…"; testes em 360 / 768 / 1366 / 1440 / 1920. Revisão: `design-review`; gate P0/P1/P2 em `docs/WORKFLOW.md` §6.
