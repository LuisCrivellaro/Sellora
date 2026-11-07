# Playbook de frontend, UX e motion

Conhecimento técnico-criativo aplicável a **qualquer interface da Sellora** (dashboard interno, sites de clientes, peças de portfólio). Destilado do material `PROMPT_MESTRE_FRONTEND_UX_MOTION_CRIATIVIDADE.md` (fornecido pelo usuário em 2026-11-06) e alinhado às regras do `CLAUDE.md`.

- Específico de **sites de clientes** (storytelling, segmentos, catálogo de referências, pré-publicação): `docs/CLIENT_WEBSITES.md`.
- Específico do **dashboard** (direção visual, páginas): `docs/DESIGN_SYSTEM.md`.
- Processo, prompts, quality gate e relatórios: `docs/WORKFLOW.md`.

**Regra de uso:** consulte apenas as seções pertinentes à tarefa. Nenhum princípio é obrigatório fora de contexto; todos são instrumentos de decisão, não dogmas.

Formato dos princípios: **Resolve** (problema) · **Quando** (aplicar) · **Como** (implementar) · **Resultado** esperado · **Limites** · **Não usar** quando · **Validar** (como comprovar).

---

## 0. Matriz de seleção por tipo de entrega

| Tema | Dashboard interno | Site de cliente | Proposta / portfólio |
|---|---|---|---|
| Direção criativa | Uma, estável (DESIGN_SYSTEM) | Uma **por cliente**, singular | Herda da marca Sellora ou do case |
| Densidade | Moderada-alta, operacional | Baixa-moderada, editorial | Moderada, escaneável |
| Motion | Funcional: feedback, estado, continuidade (≤250 ms) | Narrativo quando o briefing e o pacote justificam | Mínimo; impressão/PDF estático |
| Scroll animations | Não usar | Seletivo, com fallback | Não usar |
| Storytelling | Não se aplica; hierarquia de dados | 6 atos (CLIENT_WEBSITES §3) | Contexto → solução → resultado verificável |
| Prioridade de QA | Dados corretos, estados, teclado, RLS | Mobile, LCP/CLS, CTA, a11y, conteúdo real | Exatidão de valores e escopo |

---

## 1. Diagnóstico e direção

### 1.1 Classificar o conhecimento antes de agir
- **Resolve:** decisões apoiadas em suposições (stack, preços, conteúdo, integrações inventadas).
- **Quando:** início de toda tarefa de design ou código.
- **Como:** listar objetivo, público, marca, stack real, conteúdo aprovado, fluxos críticos, restrições; marcar cada item como **confirmado / inferido / pendente / opcional**. Perguntar só o que bloqueia; não repetir perguntas já respondidas.
- **Resultado:** escopo claro, menos retrabalho, honestidade sobre lacunas.
- **Limites:** não substitui conversa com o cliente.
- **Não usar:** como pretexto para questionários longos em pedidos simples.
- **Validar:** o plano cita a origem de cada premissa relevante.

### 1.2 Uma direção criativa principal
- **Resolve:** indecisão e mistura de estilos incoerentes.
- **Quando:** novo site, redesign, nova área visual.
- **Como:** escolher **uma** direção e justificar em 2–3 frases. Definir conceito, paleta, tipografia, fotografia, grid, componentes, motion e navegação mobile. Comparar 2–3 só se pedido.
- **Resultado:** identidade coerente e defensável.
- **Limites:** direção é hipótese até aprovação.
- **Não usar:** para sobrescrever identidade já aprovada.
- **Validar:** cada decisão visual pode ser rastreada até o conceito.

### 1.3 Anti-genérico ("cara de site de IA")
- **Resolve:** interfaces intercambiáveis que não vendem nem diferenciam.
- **Quando:** sempre que houver liberdade criativa.
- **Como:** evitar o pacote padrão: hero centralizado + três cards iguais + gradiente roxo + glassmorphism gratuito + ícones em excesso + texto inflado. Decidir composição, ritmo e um gesto memorável ligado ao produto.
- **Resultado:** página reconhecível como da marca.
- **Limites:** originalidade não pode quebrar convenções úteis (Lei de Jakob).
- **Não usar:** para justificar inovação em formulários, navegação ou checkout.
- **Validar:** trocando logo e textos por outra marca, a página deixaria de fazer sentido? Se não, está genérica.

### 1.4 Referências: extrair lógica, não copiar
- **Resolve:** plágio, risco de licença e soluções desconectadas do cliente.
- **Quando:** ao usar sites, templates Framer, componentes de bibliotecas.
- **Como:** descrever o **comportamento** (o que move, por quê, quando) e reinterpretar. Separar **observado / documentado pelo criador / hipótese de implementação**. Framer Remix entrega edição visual, não código exportável.
- **Resultado:** inspiração com autoria própria.
- **Limites:** sem navegador interativo, não alegar ter observado scroll, hover ou touch.
- **Não usar:** logos, fotos, textos, layouts ou componentes comerciais sem direito.
- **Validar:** nenhum asset ou trecho de código de terceiros sem licença registrada.

---

## 2. Sistema visual

### 2.1 Tokens semânticos
- **Resolve:** cores e medidas espalhadas, tema escuro impossível, inconsistência.
- **Quando:** antes do primeiro componente de qualquer projeto.
- **Como:** CSS custom properties / tema Tailwind com nomes de função: `background`, `surface`, `surface-raised`, `text`, `text-muted`, `border`, `primary`, `accent`, `danger`, `success`, `warning`, `focus`. Também escalas de espaço, raio, sombra, tipografia e breakpoints. Exemplos não são cores oficiais.
- **Resultado:** mudança de marca ou tema em um só lugar.
- **Limites:** excesso de tokens vira burocracia; começar pequeno.
- **Não usar:** valores literais (`#0f766e`, `13px`) dentro de componentes.
- **Validar:** busca por hex/px soltos em componentes retorna só exceções justificadas.

### 2.2 Escala tipográfica
- **Resolve:** hierarquia fraca e leitura cansativa.
- **Quando:** definição do sistema.
- **Como:** display, H1–H6, body, caption com tamanhos, pesos, line-height e tracking definidos. Títulos podem ser expressivos; corpo em Regular/Medium. Sem Thin/Light em texto corrido, sem tracking largo no corpo. Números tabulares em métricas e valores. Fallbacks e licença das fontes verificados (Fontshare, Google Fonts).
- **Resultado:** escaneabilidade e personalidade.
- **Limites:** máximo de 2 famílias, salvo justificativa; cada peso extra custa performance.
- **Não usar:** fonte decorativa em dados ou formulários.
- **Validar:** medida de linha 45–80 caracteres no corpo; contraste e tamanho legíveis em 360 px.

### 2.3 Cor e contraste
- **Resolve:** ilegibilidade, ambiguidade de estado, saturação gratuita.
- **Quando:** paleta, estados, gráficos.
- **Como:** contraste conforme contexto (meta WCAG AA: 4.5:1 texto, 3:1 texto grande e elementos de UI). Semântica de perigo em ações destrutivas, **nunca só cor** (ícone + texto). Preto/branco puros e off-black/off-white são opções legítimas. Gradientes só com função, sem banding.
- **Resultado:** estados reconhecíveis e acessíveis.
- **Limites:** AA declarado ≠ AA verificado; medir.
- **Não usar:** acento em tudo (o destaque some).
- **Validar:** ferramenta de contraste nos pares reais de tokens; teste em escala de cinza.

### 2.4 Composição e hierarquia
- **Resolve:** páginas que parecem catálogo de cards.
- **Quando:** todo layout.
- **Como:** hierarquia explícita (um foco por tela/seção), assimetria controlada, ritmo entre densidade e respiro, alinhamentos em eixos consistentes. Container só quando sinaliza pertencimento (Gestalt região comum).
- **Resultado:** leitura guiada, menos ruído.
- **Limites:** assimetria exige grid rigoroso por trás.
- **Não usar:** caixas e sombras como substituto de espaçamento.
- **Validar:** teste do "olhar de 5 segundos": o que se vê primeiro é o que importa?

### 2.5 Raios aninhados
- **Resolve:** cantos internos/externos visualmente desencontrados.
- **Quando:** elemento arredondado dentro de outro com padding uniforme.
- **Como:** heurística `raio_externo ≈ raio_interno + padding`.
- **Resultado:** curvas concêntricas.
- **Limites:** heurística, não regra; não é proporção fixa 2:1.
- **Não usar:** quando o padding não é uniforme ou o design pede contraste de formas.
- **Validar:** inspeção visual em zoom.

### 2.6 Fotografia e mídia
- **Resolve:** imagens genéricas que enfraquecem a marca.
- **Quando:** sites de clientes e portfólio.
- **Como:** produto/serviço como protagonista; luz, crop, textura e atmosfera consistentes; sem repetição acidental. Fotos reais do cliente têm prioridade e só são trocadas com autorização. Licença registrada (Pexels etc.).
- **Resultado:** confiança e apetite visual.
- **Limites:** foto ruim do cliente pode exigir orientação de captura, não substituição silenciosa.
- **Não usar:** banco de imagens fingindo ser o estabelecimento real.
- **Validar:** inventário de imagens com origem e licença.

---

## 3. Heurísticas de UX

Use como lente de crítica. Resultado esperado comum: menos atrito e decisões mais rápidas.

| Lei / princípio | Resolve | Quando aplicar | Limite / quando não | Validar |
|---|---|---|---|---|
| Jakob | Estranhamento | Navegação, forms, carrinho, conta | Não engessar áreas de expressão de marca | Usuário completa tarefa sem instrução |
| Hick-Hyman | Paralisia de escolha | Menus, toolbars, pacotes | Não esconder opções essenciais | Contar opções concorrentes por decisão |
| Gestalt proximidade | Grupos ambíguos | Forms, cards, filtros | — | Espaço intra-grupo < inter-grupo |
| Gestalt região comum | Pertencimento | Agrupar controles relacionados | Excesso de caixas | Remover a caixa: o grupo continua legível? |
| Miller (chunking) | Sobrecarga | Telefones, listas, etapas | "7±2" não é limite obrigatório | Blocos legíveis em varredura |
| Von Restorff | Destaque diluído | CTA, KPI crítico, alerta | Muitos destaques anulam todos | 1 destaque primário por tela/seção |
| Estética-usabilidade | Percepção de qualidade | Acabamento | Não substitui teste real | Teste de tarefa, não de opinião |
| Goal-gradient | Abandono | Onboarding, forms longos | Nunca falsificar progresso | Progresso = etapas reais |
| Parkinson | Indefinição | Etapas, prazos | Sem urgência/escassez fictícia | Todo prazo exibido é verdadeiro |
| Keyword-first | Leitura lenta | Títulos, menus, labels | Padrão F não é universal | Primeira palavra carrega o sentido |
| Progressive disclosure | Excesso inicial | Detalhes, configurações | Não esconder o que decide a compra | Essencial visível sem interação |
| Consistência | Confusão | Ações iguais | — | Mesma ação = mesmo componente e rótulo |

---

## 4. Componentes e ações

### 4.1 Rótulos pelo resultado
- **Resolve:** ambiguidade ("OK", "Enviar", "Clique aqui").
- **Quando:** todo botão e link.
- **Como:** verbo + objeto: "Salvar lead", "Criar proposta", "Solicitar orçamento", "Excluir projeto". Botão = ação; link = navegação. Ícone de ação com nome acessível.
- **Resultado:** previsibilidade e acessibilidade.
- **Limites:** rótulos longos em mobile pedem síntese.
- **Não usar:** rótulos que prometem o que não acontece (ex.: "Enviar proposta" quando apenas gera PDF).
- **Validar:** ler só os botões descreve o fluxo; leitor de tela anuncia ícones.

### 4.2 Ações destrutivas
- **Resolve:** perda acidental de dados.
- **Quando:** excluir, arquivar, perder etapa, descartar alterações.
- **Como:** texto inequívoco, cor + ícone de perigo, confirmação **proporcional ao risco** (undo para baixo risco; diálogo nomeando o item para alto risco), caminho de cancelar seguro e com foco padrão.
- **Resultado:** confiança para operar.
- **Limites:** confirmar tudo gera cegueira de diálogo.
- **Não usar:** confirmação em ações reversíveis triviais.
- **Validar:** Esc cancela; foco retorna ao gatilho; dado não some sem confirmação ou undo.

### 4.3 Alvos de toque
- **Resolve:** toques errados em mobile.
- **Quando:** qualquer UI tocável.
- **Como:** conforto ~44×44 px CSS (iOS 44 pt, Android 48 dp); ampliar hit area sem inflar o ícone; espaçamento entre alvos. CTA fixo inferior só se fizer sentido, respeitando safe area e sem cobrir conteúdo.
- **Resultado:** menos erros e frustração.
- **Limites:** mínimos normativos variam (WCAG 2.2 AA: 24×24).
- **Não usar:** alvos minúsculos em tabelas densas sem alternativa (menu de linha).
- **Validar:** inspeção em 360 px e DevTools de toque.

### 4.4 Escolha do controle

| Situação | Controle |
|---|---|
| Uma escolha entre 2–5 opções visíveis | Radio ou cartões selecionáveis (semântica de radio) |
| Várias escolhas | Checkbox |
| Ligar/desligar configuração com efeito imediato | Switch |
| Alternativas mutuamente exclusivas de visualização | Segmented control (áreas equilibradas) |
| Lista longa | Combobox com busca, teclado, leitor de tela e empty state |
| Variantes de produto/pacote | Cartões comparáveis com preço e diferença evidentes |

Validar: navegação por setas/Tab/Espaço funciona e o estado é anunciado.

### 4.5 Estados de interação
- **Resolve:** interface que parece morta ou imprevisível.
- **Quando:** todo componente interativo.
- **Como:** projetar hover, active/press, focus-visible, selected, disabled, loading e success. Hover nunca é a única via para informação essencial.
- **Resultado:** feedback imediato e acessível.
- **Limites:** disabled sem explicação frustra; preferir botão ativo com validação.
- **Não usar:** `outline: none` sem substituto de foco.
- **Validar:** percorrer a tela só com teclado; foco sempre visível.

---

## 5. Formulários e fluxos

### 5.1 Labels persistentes
- **Resolve:** perda de contexto quando o placeholder some.
- **Quando:** todo campo.
- **Como:** label visível acima do campo; placeholder apenas como exemplo. Campos com contorno dão affordance mais clara que underline-only.
- **Resultado:** preenchimento correto e acessível.
- **Limites:** busca pode usar label visualmente oculto, mas acessível.
- **Não usar:** placeholder como único rótulo.
- **Validar:** cada input tem `<label for>` ou `aria-labelledby`.

### 5.2 Tipos, autocomplete e formatos pt-BR
- **Resolve:** teclado errado, autofill quebrado, dados mal formatados.
- **Quando:** e-mail, telefone, moeda, data, CEP, CNPJ, OTP.
- **Como:** `type=email`, `inputmode`, `autocomplete`; formatos BR (R$, dd/mm/aaaa, (11) 9xxxx-xxxx); máscaras que não quebram colagem nem edição. E-mail é um único campo. OTP: entrada semanticamente única com `autocomplete=one-time-code`, aceitando colagem.
- **Resultado:** menos erros, mais conversão.
- **Limites:** máscaras rígidas falham com formatos internacionais.
- **Não usar:** dividir dados contínuos em vários inputs.
- **Validar:** colar, autofill do navegador e leitor de tela funcionam.

### 5.3 Validação inline
- **Resolve:** erros descobertos só no envio, mensagens vagas.
- **Quando:** todo formulário com regras.
- **Como:** validar no blur/submit (não a cada tecla), mensagem perto do campo com causa e correção, `aria-invalid`, `aria-describedby`, foco no primeiro erro. **Sempre revalidar no servidor** (Zod compartilhado). Preservar o que foi digitado em falha.
- **Resultado:** correção rápida, dados íntegros.
- **Limites:** validação cliente é conveniência, não segurança.
- **Não usar:** bloquear digitação ou apagar campos em erro.
- **Validar:** testes de schema + teste de UI do estado de erro.

### 5.4 Obrigatório vs opcional
- **Como:** se quase tudo é obrigatório, marcar os poucos "(opcional)"; política explícita.
- **Validar:** usuário identifica o que pode pular sem tentar enviar.

### 5.5 Formulários longos e onboarding
- **Como:** etapas lógicas, progresso real, voltar sem perder dados, pular apenas o opcional. Onboarding informativo pode ser pulado; consentimentos e segurança não.
- **Não usar:** wizard para formulários curtos.

### 5.6 Sucesso honesto
- **Resolve:** falsa confirmação.
- **Como:** estado de sucesso só após confirmação real do servidor. Nunca simular reserva, pedido, envio ou pagamento. Em modo demo, rotular **"Demonstração"**.
- **Validar:** desligar a rede → a UI mostra erro, não sucesso.

---

## 6. Carregamento e feedback

### 6.1 Skeleton, spinner ou progresso
| Situação | Usar |
|---|---|
| Carregamento perceptível com estrutura previsível (tabela, cards) | Skeleton com a forma do conteúdo |
| Operação curta ou sem progresso mensurável | Spinner / indicador indeterminado |
| Upload ou processamento longo | Barra, concluído/total, ETA só se confiável, cancelar/repetir |

- **Limites:** skeleton para operações de 100 ms gera flicker; usar atraso mínimo (~200 ms) antes de exibir.
- **Validar:** throttling de rede no DevTools; sem salto de layout (CLS).

### 6.2 Estados completos
- **Como:** projetar loading, vazio, erro, sucesso, offline e recuperação para cada tela de dados. Empty state com explicação e CTA real. Erro com causa, ação de repetir e preservação de dados.
- **Validar:** cada estado é alcançável e foi visto renderizado (não só no código).

---

## 7. Motion design

### 7.1 Motion com propósito
- **Resolve:** mudanças de estado abruptas ou, no outro extremo, animação decorativa que distrai.
- **Quando:** explicar estado, dar continuidade espacial, orientar atenção, marcar hierarquia, conduzir narrativa, demonstrar o serviço.
- **Como:** cada animação responde "o que isso comunica?". Preferir uma interação memorável e funcional a muitos efeitos concorrentes.
- **Resultado:** interface compreensível e com personalidade.
- **Limites:** custo de performance, acessibilidade e manutenção.
- **Não usar:** movimento incessante, delays arbitrários, animação que bloqueia navegação ou encobre conteúdo fraco.
- **Validar:** desligar a animação não remove informação.

### 7.2 Vocabulário e tempos
- Feedback rápido (hover, press, toggle): ~100–150 ms.
- Transições de UI (drawer, modal, dropdown, morphing): ~180–300 ms.
- Revelações editoriais: ~300–700 ms.
- Easing: ease-out para entradas, ease-in para saídas, ease-in-out para deslocamentos; spring com elasticidade contida para gestos.
- Técnicas: stagger em grupos relacionados, morphing entre estados, shared element transitions, mask/clip-path reveal, cinematic reveal, parallax moderado, magnetic CTA (só se não prejudicar precisão), tipografia cinética/split text, 2.5D/WebGL quando o produto justifica.
- **Não usar:** a mesma duração para tudo.

### 7.3 prefers-reduced-motion (obrigatório)
- **Como:** `@media (prefers-reduced-motion: reduce)` ou hook equivalente: remover parallax, scrub, autoplay e deslocamentos grandes; manter fades curtos ou estado final estático. Pausar movimentos contínuos. Conteúdo legível com animações desligadas e, para conteúdo essencial, sem JavaScript.
- **Validar:** emular reduced-motion no DevTools e percorrer a página.

### 7.4 Performance de animação
- **Como:** animar `transform` e `opacity`; evitar `transition: all`, animar `width/top/left`, reflows por frame e listeners de scroll sem throttling. Limpar listeners e timelines no unmount; tratar resize/orientação; testar SSR/hidratação.
- **Validar:** painel Performance sem long tasks recorrentes; 60 fps em aparelho intermediário (ou registrar que não foi testado em hardware real).

### 7.5 Escolha de ferramenta (pela necessidade e pela stack real)

| Necessidade | Ferramenta preferida |
|---|---|
| Hover, press, transições leves | CSS / Tailwind transitions |
| Reveal ao entrar na viewport | `IntersectionObserver` ou CSS scroll-driven animations (com fallback) |
| Microinterações, layout animations, gestos em React | Motion (motion.dev) |
| Sequências coreografadas, pin, scrub complexos | GSAP + ScrollTrigger (verificar licença vigente) |
| 3D real (produto, câmera) | Three.js / WebGL com fallback 2D |
| Smooth scroll | Lenis — opcional, raramente necessário; checar acessibilidade |

Regra: não instalar GSAP/Lenis/Three.js por padrão se CSS, IntersectionObserver ou biblioteca já instalada resolvem. Toda dependência nova vai para `docs/DECISIONS.md`.

WebGL exige: orçamento de GPU, ajuste de DPR, loading/compressão de assets e texturas, fallback 2D, versão mobile e recuperação de contexto perdido.

---

## 8. Scroll animations

### 8.1 Gramática

| Efeito | Bom para | Risco principal | Fallback |
|---|---|---|---|
| Scroll-triggered reveal | Entrada de seções/itens | Repetição cansativa, conteúdo invisível sem JS | Conteúdo visível por padrão |
| Scroll-linked / scrub | Processo, transformação | Jank, enjoo | Estado final estático |
| Pinned storytelling / sticky chapters | Narrativa por capítulos | Aprisionar o usuário | Capítulos empilhados |
| Parallax multicamadas | Profundidade, atmosfera | Legibilidade, enjoo | Camadas estáticas |
| Scale/rotate/translate on scroll | Ênfase narrativa | Gratuidade | Sem transformação |
| Galeria horizontal em scroll vertical | Coleções curtas | Quebra navegação/teclado | Grid ou carrossel acessível |
| Clip-path / mask reveal | Revelar foto/vídeo/objeto | Custo de pintura | Imagem já revelada |
| Image sequence / canvas | Montagem, uso do produto | Peso de assets | Vídeo curto ou imagem-chave |
| 3D camera keyframes | Produto persistente (carro, relógio) | GPU, mobile | Sequência de imagens |
| Object → detail → context | Material → produto → uso | Duração excessiva | Três blocos estáticos |
| Scroll typography | Mensagem em etapas | Cortar leitura/seleção | Texto completo |
| Sticky product anatomy / hotspots | Características físicas | Hotspot inacessível | Lista de características |
| Chapter progress | Orientação em narrativa longa | Indicador falso | Omitir |
| Curtain footer / layered transitions | Fechamento de impacto | Puro adorno | Footer normal |

### 8.2 Especificação obrigatória de cada efeito
Gatilho · duração ou mapeamento de scroll · estado inicial e final · easing · pin (sim/não, por quanto) · versão mobile · fallback · comportamento em reduced-motion · critério de aceite observável.

### 8.3 Proibições
Scroll-jacking global; exigir wheel para ações fundamentais; prender rolagem por tempo excessivo; leitura transformada em animação obrigatória; conteúdo inacessível sem JS; presumir que um site de referência usa certo efeito sem observar ou ter documentação.

---

## 9. Responsividade e acessibilidade

### 9.1 Recompor, não encolher
- **Como:** desenhar mobile e desktop separadamente; testar no mínimo **360, 768, 1440 px**, paisagem, teclado virtual aberto, safe-area, zoom 200% e preferências do sistema. Sem scroll horizontal involuntário. Tabelas viram cards/listas ou scroll horizontal acessível; Kanban vira lista por etapa ou scroll com indicador.
- **Validar:** screenshots reais nas larguras; `document.documentElement.scrollWidth <= innerWidth`.

### 9.2 Checklist de acessibilidade
- HTML semântico, headings em ordem, landmarks, alt útil (decorativo = `alt=""`).
- Tab/Shift+Tab/Enter/Espaço/Esc; foco visível; foco preso e devolvido em modais/drawers.
- Labels e mensagens anunciadas (`aria-live` para toasts e erros assíncronos).
- Menus, carrosséis e drag-and-drop com alternativa de teclado/toque (ex.: Kanban com menu "Mover para…").
- Nada essencial dependente só de hover, mouse, cor ou animação.
- Contraste medido; distinguir meta (AA/AAA) de verificação real.
- Sticky CTA, chat, bottom nav e banners não bloqueiam conteúdo nem teclado.
- **Validar:** navegação só por teclado + axe/Lighthouse a11y executados (registrar resultado real) + leitor de tela quando possível.

---

## 10. Performance, SEO e produção

- **Core Web Vitals:** LCP (hero priorizado, imagem responsiva, `fetchpriority`), CLS (dimensões reservadas, fontes com `font-display` adequado), INP (pouco JS no caminho crítico).
- Imagens: formatos modernos, `srcset/sizes`, lazy loading abaixo da dobra. Fontes: poucas famílias/pesos, subset, preload só do essencial.
- Vídeo hero: pôster estático, sem áudio inesperado, autoplay só muted e compatível; versão leve para mobile.
- SEO: título e meta description únicos, headings, URLs claras, Open Graph, canonical, sitemap quando cabível, dados estruturados **verdadeiros** (LocalBusiness com endereço real).
- Segurança: segredos nunca no frontend; `robots.txt` não protege área privada; preservar auth, autorização, dados e regras de negócio.
- **Validar:** só citar scores Lighthouse/CWV após executar a ferramenta; registrar ambiente (local, preview, produção; mobile/desktop).

---

## 11. Arquitetura frontend

- Investigar a estrutura existente antes de criar arquivos; não trocar framework nem migrar sem motivo registrado.
- Componentes pequenos e reutilizáveis, tokens centralizados, responsabilidades claras (UI ↔ serviços ↔ dados), estados previsíveis.
- Server Components por padrão no Next.js App Router; `"use client"` só onde há interação. Consultar a skill `vercel-react-best-practices` para padrões de performance.
- Dependência nova só com justificativa (necessidade, tamanho, licença, manutenção, acessibilidade) registrada em `docs/DECISIONS.md`.
- Bibliotecas de componentes visuais (React Bits, Aceternity, Magic UI etc.) são referência: verificar licença, acessibilidade, peso e aderência aos tokens antes de importar; preferir reimplementar o essencial.
