# Histórico de atualizações do Sellora

## 1.7 — 2026-11-16

- Abordagem comercial: novo painel na ficha do lead e na revisão da demo, com rascunhos editáveis sem IA. O primeiro contato é curto, personalizado, sem link e termina com pergunta. Há respostas para lead interessado (com a demo aprovada e o aviso de conceito não oficial com imagens ilustrativas), indeciso e que recusou. As mensagens nunca afirmam que o negócio não tem site, só citam problemas do site verificados pela Prospecção IA e variam entre leads, inclusive do mesmo segmento. "Já enviei" registra o contato no CRM e conta na meta diária.
- Pedidos de ajuste da demo passam a orientar a próxima geração: o gerador recebe os pedidos e o resumo da versão anterior, e a revisão visual confere cada um. Os pedidos ficam pendentes até a geração, podem ser removidos e depois aparecem como aplicados.
- Publicação manual da demo (ZIP + host estático + link registrado) sem depender do Coolify.
- WhatsApp: a Prospecção prefere o celular ou WhatsApp do estabelecimento, e a ficha avisa quando o número é fixo.

## 1.6 — 2026-11-14

- Preparação automática opcional: gerar demo V6, conferir QA técnico/visual e originalidade, publicar no Coolify configurado e preparar mensagem com o link confirmado. O envio continua manual.
- Mantidos os controles e padrões manuais. A Prospecção oferece opção separada para encaminhar os qualificados ao fluxo completo, sem ativar pesquisas antigas.
- Pendências de QA, imagens substitutas, revisão visual ausente e mensagens editadas impedem a liberação automática. Os avisos informativos de categoria ou telefone ausente continuam visíveis.
- Retomar a preparação reutiliza a demo salva e a publicação existente. Pausa e cancelamento preservam outras demos e não desfazem publicações já iniciadas no Coolify.
- Revisão automática identificada no histórico, sem registrar contato ou envio. Testes de integração, edição concorrente, publicação, cancelamento, regressão manual e interface em perfil desktop isolado.

## 1.5 — 2026-11-14

- Escritório com quatro personagens: Agente de Prospecção, Agente Gerador de Demos, Publicação e Revisor de Demos. Papéis e atalhos separados nas áreas da Sellora.
- Revisor acompanha as etapas reais do QA V6 e mostra as pendências do relatório, sem duplicar geração, chamadas de IA ou aprovação humana.
- Nomes padrão antigos do 3D atualizados com preservação dos campos, avatares e nomes personalizados; alterações locais recebem backup.
- Testes ampliados para quatro personagens, troca de chat, perfis, atalhos, estados de QA e cartões independentes no Kanban.

## 1.4 — 2026-11-14

- Corrigida a preparação da sessão de chat do Claw3D: sincronizar opções de conversa não altera modelos, permissões ou tarefas reais da Sellora.
- New session limpa apenas a conversa local e sua deduplicação. Histórico de trabalho, leads, demos e tarefas em execução permanecem preservados.
- Consultas de agentes ociosos reaparecem ao recarregar o escritório, sem simular execução de tarefas.
- Acrescentado teste na interface real do Claw3D com bridge e perfil isolados, cobrindo primeiro envio, resposta, nova sessão e recuperação após recarregar.

## 1.3 — 2026-11-14

- Separadas as áreas Prospecção e Geração de Demos, com controles e progresso independentes; o acompanhamento da pesquisa continua ao navegar pelo aplicativo.
- Leads do CRM ou resultados selecionados podem entrar na fila de demos sem iniciar IA. A automação é opcional por pesquisa, deduplicada e preserva demos existentes.
- Integração entre módulos centralizada sem mudar banco, autenticação ou identificadores históricos; falha do gerador não invalida a pesquisa.
- Acrescentados testes de concorrência, cancelamento entre módulos, retomada de etapas salvas, deduplicação e regressão, além de verificação de interface no desktop e celular em perfis isolados.

- Chat do escritório responde status, histórico, ajuda e onde revisar, usando os registros reais da Sellora e sem chamadas de IA.
- Mensagens livres recebem orientação sobre os comandos disponíveis; o chat não inicia, cancela ou publica tarefas. Consultas indicam quando o bridge está desconectado.
- Histórico de consultas em memória, limitado e com deduplicação de envios; reiniciar o aplicativo limpa essas conversas sem alterar o histórico de execuções.

## 1.2 — 2026-11-14

- Cloud 3D agora mostra o status real dos agentes e permite abrir as demos para testar em computador ou celular e aprovar usando os controles existentes.
- Pedidos de ajuste ficam registrados no histórico do CRM e removem a aprovação anterior, preservando o site. A correção automática não é iniciada.
- Verificação do desktop ampliada para testar a abertura da entrega no escritório, a prévia móvel e o registro do ajuste em perfil isolado.

## 1.1 — 2026-11-14

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
