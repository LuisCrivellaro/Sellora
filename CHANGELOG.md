# Histórico de atualizações do Sellora

## Próxima atualização

- Corrigido o alcance dos controles na ficha individual. Pausar, retomar e cancelar afetam o estabelecimento exibido. A tela do lote mantém os controles globais.
- A geração individual mantém as demais demos pausadas e cada pedido usa o identificador do lead escolhido. Cliques repetidos são deduplicados.
- Adicionado cancelamento seguro após a etapa atual, com preservação das demos já existentes.
- Mantida uma imagem por demo e a retomada das etapas salvas.
- Centralizada a versão em `version.json`, com sequência de dois componentes e avanço de 1.9 para 2.0.
- Adicionado o comando de atualização validada, com proteção contra incrementos repetidos, restauração da versão em caso de falha e atualização do atalho do Windows.
- Incluídos testes de isolamento entre gerações individuais, lote e controles, além da validação do desktop em perfil separado.
- Cloud 3D: perfis completos dos agentes Gerador de Demos, Prospecção e Coolify Deploy Agent no Agent Editor do Claw3D (Identity, Soul, Agents, User, Tools, Memory, Heartbeat). Perfis versionados em `integrations/claw3d/agent-profiles/`; edições feitas no escritório ficam no estado local do Claw3D, com cópia de segurança, e não alteram nenhum serviço. Nome, credenciais e agentes continuam sob controle da Sellora.
- Cloud 3D: agentes exibidos como Website Designer, Lead Generation Specialist e Deployment Manager (ids internos inalterados). Renomear pelo Agent Editor do Claw3D agora funciona e o nome persiste após recarregar e reiniciar o app.

## 1.0 — 2026-11-13

- Incluídas as alterações da branch Cloud 3D e do gerador V6.
- Adicionados pausa após a etapa atual, retomada e checkpoints locais.
- Reduzida a geração para uma imagem por demo.
- Criado o atalho Sellora 1.0 e validada a abertura do desktop com o escritório 3D.
