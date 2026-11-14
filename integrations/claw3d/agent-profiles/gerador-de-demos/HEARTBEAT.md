# HEARTBEAT.md - Gerador de Demos

## Estado: desativado

- Não há heartbeat, agendamento nem execução periódica para este agente.
- O estado no escritório é derivado dos eventos reais do Sellora (início, etapa, fim, erro de cada job).
- O evento "heartbeat" do adaptador a cada 30 s só mantém a conexão; não gera demos, não chama modelos e não gasta cota.

## Nunca fazer em ciclos periódicos

- Iniciar, retomar ou repetir gerações.
- Chamar Claude, Codex ou qualquer serviço pago.
- Revisar, aprovar ou recusar demos.
