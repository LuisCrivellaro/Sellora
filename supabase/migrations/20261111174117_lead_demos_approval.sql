-- Snapshot da demo + rascunho e aprovação pertencem ao lead e herdam seu RLS.
-- Não cria acesso público ao CRM nem altera políticas de autenticação.
alter table public.leads add column if not exists demo jsonb;
alter table public.leads add constraint leads_demo_object_check
  check (demo is null or (jsonb_typeof(demo) = 'object' and octet_length(demo::text) <= 16000));

comment on column public.leads.demo is
  'Demo por segmento e mensagem para aprovação humana; nenhuma mensagem é enviada automaticamente.';
