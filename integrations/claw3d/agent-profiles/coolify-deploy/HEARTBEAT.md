# HEARTBEAT.md - Coolify Deploy Agent

## Estado: desativado

- Não há heartbeat, agendamento nem verificação periódica para este agente.
- O estado no escritório é derivado dos eventos reais do Sellora (preparando, publicando, confirmado, falha de cada operação).
- O evento "heartbeat" do adaptador a cada 30 s só mantém a conexão; não chama o GitHub nem o Coolify.

## Nunca fazer em ciclos periódicos

- Publicar, republicar, suspender ou remover demos.
- Consultar ou alterar o Coolify, o GitHub, domínios ou variáveis.
- Enviar links a leads.
