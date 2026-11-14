# Histórico de atualizações do Sellora

## Próxima atualização

- Corrigido o alcance dos controles na ficha individual. Pausar, retomar e cancelar afetam o estabelecimento exibido. A tela do lote mantém os controles globais.
- A geração individual mantém as demais demos pausadas e cada pedido usa o identificador do lead escolhido. Cliques repetidos são deduplicados.
- Adicionado cancelamento seguro após a etapa atual, com preservação das demos já existentes.
- Mantida a retomada das etapas salvas.
- Centralizada a versão em `version.json`, com sequência de dois componentes e avanço de 1.9 para 2.0.
- Adicionado o comando de atualização validada, com proteção contra incrementos repetidos, restauração da versão em caso de falha e atualização do atalho do Windows.
- Incluídos testes de isolamento entre gerações individuais, lote e controles, além da validação do desktop em perfil separado.
- Gerador V6 reestruturado: o Claude escreve textos, design e código e o Codex gera só as imagens, a partir de uma especificação fotográfica detalhada.
- Demos com uma ou duas páginas. A segunda página só entra quando melhora a experiência e passa pelas mesmas verificações, com links entre páginas conferidos.
- Direção de arte justificada antes do código, com perfis de apresentação por segmento e dois novos arquétipos de hero (faixa panorâmica e índice).
- Originalidade por identidade visual estruturada: hero, esqueleto de seções, tipografia, imagem, paleta e título. Trocar só a cor não diferencia mais, e a revisão do briefing é conferida de novo a cada rodada.
- QA mais rigoroso: cinco larguras por página (incluindo 360 px), sobreposição, títulos cortados, imagens distorcidas, menu do celular por toque, foco do teclado, página sem JavaScript, movimento reduzido, fontes carregadas, fatos não confirmados e botões sem ação.
- Problemas críticos impedem a entrega e permitem retomar das etapas salvas. Problemas não resolvidos, originalidade pendente ou imagem substituída deixam a demo pendente de revisão. O relatório separa corrigíveis, avisos, originalidade e revisão humana.
- Correções que trocam o título, as fontes, as seções ou as páginas são descartadas, e a melhor versão é mantida.
- Conta Claude separada para as demos (`SELLORA_DEMO_CLAUDE_CONFIG_DIR`), isolada da conta principal e sem troca silenciosa.
- Skills `demo-generator-v6` e `unique-site-designer` reorganizadas por etapa, com espelhos conferidos por teste.
- Demos V6 mais marcantes: direção de arte "sofisticada, expressiva e memorável", momento visual de assinatura obrigatório no planejamento, composições variadas por seção, tipografia com personalidade e movimento moderado por padrão (inclusive escritórios e clínicas), com revelação ao rolar, microinterações e respeito ao movimento reduzido.
- Até três imagens por demo (`SELLORA_DEMO_MAX_IMAGES=3`), cada uma com papel próprio, usada por uma seção e com cena diferente das outras. Fotografias ilustrativas podem ter pessoas fictícias, mãos em ação e ambientes em funcionamento, sempre identificadas como ilustrativas.
- Revisão de impacto visual: o Claude avalia capturas reais (desktop e celular) em seis critérios ponderados, com meta 8/10; abaixo da meta, até duas rodadas de correção direcionada, novo QA técnico e reavaliação. Nota, critérios, problemas e rodadas aparecem no relatório de QA, com custo registrado à parte.
- QA de sobreposição corrigido: perguntas recolhidas em `<details>` e links que quebram linha não contam mais como texto sobreposto (falso positivo que deixou a demo AJ Santos pendente em todas as larguras). As mensagens trazem trecho do texto e posição, a auditoria rola a página inteira antes de medir e conteúdo que continua invisível é detectado.
- Defeitos de leitura (texto sobreposto, título cortado, rolagem horizontal, conteúdo invisível, menu que não abre) são bloqueantes: vêm primeiro na correção e, se persistirem, a demo fica salva como pendente, com o defeito listado.
- O aviso de demonstração e de imagens ilustrativas não pode mais ser escondido pelo CSS da demo.
- Cloud 3D: perfis completos dos agentes Gerador de Demos, Prospecção e Coolify Deploy Agent no Agent Editor do Claw3D (Identity, Soul, Agents, User, Tools, Memory, Heartbeat). Perfis versionados em `integrations/claw3d/agent-profiles/`; edições feitas no escritório ficam no estado local do Claw3D, com cópia de segurança, e não alteram nenhum serviço. Nome, credenciais e agentes continuam sob controle da Sellora.
- Cloud 3D: agentes exibidos como Website Designer, Lead Generation Specialist e Deployment Manager (ids internos inalterados). Renomear pelo Agent Editor do Claw3D agora funciona e o nome persiste após recarregar e reiniciar o app.

## 1.0 — 2026-11-13

- Incluídas as alterações da branch Cloud 3D e do gerador V6.
- Adicionados pausa após a etapa atual, retomada e checkpoints locais.
- Reduzida a geração para uma imagem por demo.
- Criado o atalho Sellora 1.0 e validada a abertura do desktop com o escritório 3D.
