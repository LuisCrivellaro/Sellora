-- Sellora 2.0 · Parte 1: novas etapas de projeto, novos status de proposta e escopo descritivo.
-- Só AMPLIA listas aceitas e ACRESCENTA uma coluna com padrão; nenhum dado é alterado ou removido.
-- Rodar depois de 20261109120000_lead_source_prospeccao_ia.sql.
-- Os nomes *_check são o padrão do Postgres para os checks inline das colunas.

alter table public.proposals add column if not exists scope text not null default '';

alter table public.proposals drop constraint if exists proposals_status_check;
alter table public.proposals
  add constraint proposals_status_check
  check (status in ('rascunho', 'pronta', 'enviada', 'negociacao', 'aprovada', 'recusada', 'expirada'));

alter table public.projects drop constraint if exists projects_stage_check;
alter table public.projects
  add constraint projects_stage_check
  check (stage in ('briefing', 'briefing_recebido', 'planejamento', 'design', 'desenvolvimento', 'revisao', 'aprovacao', 'publicacao', 'entrega'));

alter table public.project_tasks drop constraint if exists project_tasks_stage_check;
alter table public.project_tasks
  add constraint project_tasks_stage_check
  check (stage in ('briefing', 'briefing_recebido', 'planejamento', 'design', 'desenvolvimento', 'revisao', 'aprovacao', 'publicacao', 'entrega'));
