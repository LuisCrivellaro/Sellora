# Direção de design — Sellora Dashboard

**Conceito:** cockpit comercial elegante: claro, consistente, decisivo. Mistura de rigor de ferramenta operacional com acabamento premium. Inspirar-se em produtos SaaS sólidos sem copiar marcas ou layouts.

## Direção inicial (ajustável via revisão)
- Base: superfícies neutras, contraste cuidadoso, acento azul-petróleo / teal só em ações/estados úteis; evitar degradês roxos genéricos.
- Sidebar esquerda compacta, topbar com contexto, busca, ação primária.
- Tipografia: escolher fonte contemporânea legível (não exagerar pesos), números tabulares em métricas e valores.
- Layout: grid consistente, densidade equilibrada, tabelas com informações realmente operacionais.
- Ícones Lucide, poucos emojis ou ilustrações decorativas.
- Escalas de espaçamento e raio via tokens CSS; garantir contraste WCAG AA quando possível.
- Mobile: menu colapsável, tabela adaptada, Kanban em lista ou scroll horizontal acessível.

## Tokens (nomes fixos; valores a definir na Entrega 0)
Cor semântica: `background`, `surface`, `surface-raised`, `text`, `text-muted`, `border`, `primary`, `accent`, `danger`, `success`, `warning`, `focus`. Também escalas de espaço, raio, sombra, tipografia (display, H1–H4, body, caption, números tabulares) e breakpoints. Valores literais não entram em componentes. Detalhes e critérios: `docs/FRONTEND_PLAYBOOK.md` §2.

## Motion no dashboard
Somente funcional: feedback de hover/press ~100–150 ms; drawer, modal, dropdown e reordenação do Kanban ~180–250 ms com ease-out; toasts discretos. Sem scroll animations, parallax ou animação decorativa em KPIs. CSS/Tailwind transitions por padrão; biblioteca de motion apenas com justificativa em `docs/DECISIONS.md`. Respeitar `prefers-reduced-motion`. Detalhes: `docs/FRONTEND_PLAYBOOK.md` §7.

## Dados e visualização
KPIs com unidade, período e definição do denominador; valores nulos tratados explicitamente; dados demo com selo **Demonstração** visível. Gráfico só quando responde a uma pergunta operacional; preferir lista de próximas ações a gráfico cosmético.

## Páginas
1. **Overview**: quatro a seis KPIs úteis, funil resumido, atividades vencidas, lista 'Próximas ações'. Evite gráficos sem dados.
2. **Leads**: tela central com toolbar, busca instantânea, filtros, colunas de empresa/status/fonte/valor/próximo contato; drawer de detalhes; CRUD.
3. **Pipeline**: colunas por estágio com contagem, cartões compactos, estado de interação claro, movimento persistido com fallback para menu acessível.
4. **Propostas**: editor simples com itens/valores/termos e preview imprimível.
5. **Projetos**: tabela por cliente, fase, prazo, valor e preview.
6. **Configurações**: pacotes e dados básicos de operação.

## Qualidade de UI
Cada botão deve ter ação real e rótulo pelo resultado ("Salvar lead", "Criar proposta"); form com labels persistentes e validação inline + servidor; skeletons onde a estrutura é previsível; empty states com CTA; confirmação proporcional ao risco em ações destrutivas; feedback de sucesso/erro; foco visível e Kanban operável por teclado (menu "Mover para…"). Testar 360px, 768px e 1440px. Sem mock charts com números apresentados como reais. Revisão: skill `design-review`; gate P0/P1/P2 em `docs/WORKFLOW.md` §6.
