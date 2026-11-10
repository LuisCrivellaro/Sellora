-- Sellora · Prospecção IA: nova origem de lead 'prospeccao_ia'.
-- Só amplia a lista aceita; nenhum dado é alterado. Rodar depois de 20261107120000_initial_schema.sql.
-- O nome leads_source_check é o padrão do Postgres para o check inline da coluna source.

alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads
  add constraint leads_source_check
  check (source in ('google_maps', 'instagram', 'indicacao', 'manual', 'outros', 'prospeccao_ia'));
