---
name: website-builder
description: Criar o site de um cliente da Sellora com Claude Code a partir de briefing aprovado — direção criativa singular, storytelling, responsividade, acessibilidade, performance, preview e aprovação antes de publicar.
---

# website-builder

## Pré-condição
Briefing aprovado e pedido explícito de construção. Local do código definido (ver pendência em `docs/DECISIONS.md`).

## Ler antes
`docs/CLIENT_WEBSITES.md` (fluxo, ficha de direção, storytelling, ambição por pacote, segmento, checklist) e `docs/FRONTEND_PLAYBOOK.md` (princípios técnicos, motion e scroll).
Skills de apoio, se disponíveis na sessão: `frontend-design` (direção estética), `ui-ux-pro-max` (paletas, pares tipográficos), `humanizer` (texto), `design-review` e `quality-assurance` ao final.

## Processo
1. Validar o briefing e os direitos de marca, imagens e textos; marcar pendências.
2. Preencher a ficha de direção criativa (uma direção, justificada) e obter aprovação.
3. Definir sitemap e CTA principal; storyboard com motion especificado (gatilho, estados, easing, mobile, fallback, reduced-motion).
4. Construir: tokens → componentes → páginas; desktop e mobile recompostos; SEO básico; contato funcional.
5. Manter a ambição técnica proporcional ao pacote contratado; dependências de motion só se justificadas.
6. Testar: links, formulários, 360/768/1440, teclado, contraste, reduced-motion, performance real.
7. Gerar preview e pedir **aprovação do cliente** antes de publicar; publicação só com autorização humana.

## Não fazer
Reaplicar o template de outro cliente; copiar referências; inventar avaliações, horários, preços ou integrações; prometer integrações não implementadas; publicar sem aprovação.

## Saída
Preview, checklist pré-publicação preenchido e relatório no formato de `docs/WORKFLOW.md` §7.
