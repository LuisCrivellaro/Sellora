-- Sellora · Entrega 1 · esquema inicial (Auth + Postgres + RLS)
--
-- Princípios:
-- * Cada linha pertence a um usuário (owner_id = auth.uid()); RLS em TODAS as tabelas.
-- * Chaves estrangeiras compostas (id, owner_id): um registro só pode apontar para
--   registros do MESMO dono, mesmo que alguém conheça o UUID de outro usuário.
-- * FKs adiáveis (deferrable initially deferred): a conversão lead ↔ cliente cria
--   referências cruzadas na mesma transação.
-- * Gravações chegam pela função apply_changes (security invoker → RLS aplica).
-- * Nenhum dado de demonstração é inserido aqui.

-- ───────────────────────────── Tabelas ─────────────────────────────

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  segment text not null check (segment in ('restaurantes', 'saude', 'beleza', 'servicos', 'comercio', 'outros')),
  city text not null check (char_length(city) between 2 and 60),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  source text not null check (source in ('google_maps', 'instagram', 'indicacao', 'manual', 'outros')),
  website text,
  website_situation text not null check (website_situation in ('sem_site', 'desatualizado', 'sem_mobile', 'adequado')),
  stage text not null check (stage in ('novo', 'qualificado', 'contatado', 'respondeu', 'diagnostico', 'proposta', 'negociacao', 'ganho', 'perdido')),
  priority text not null check (priority in ('baixa', 'media', 'alta')),
  phone text not null default '',
  email text not null default '',
  instagram text not null default '',
  potential_value numeric(12, 2) not null default 0 check (potential_value >= 0),
  last_contact_at timestamptz,
  next_action text not null default '',
  next_action_at timestamptz,
  notes text not null default '',
  client_id uuid,
  lost_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid,
  name text not null check (char_length(name) between 2 and 120),
  segment text not null check (segment in ('restaurantes', 'saude', 'beleza', 'servicos', 'comercio', 'outros')),
  city text not null check (char_length(city) between 2 and 60),
  uf text not null check (uf ~ '^[A-Z]{2}$'),
  contact_name text not null default '',
  phone text not null default '',
  email text not null default '',
  status text not null check (status in ('ativo', 'aguardando_cliente', 'pausado', 'encerrado')),
  site_url text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid,
  client_id uuid,
  recipient_name text not null,
  title text not null,
  package_id text not null check (package_id in ('essencial', 'profissional', 'personalizado')),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  deadline_days integer not null check (deadline_days between 1 and 365),
  revisions integer not null check (revisions between 0 and 20),
  payment_terms text not null default '',
  exclusions text not null default '',
  valid_until timestamptz not null,
  status text not null check (status in ('rascunho', 'enviada', 'negociacao', 'aprovada', 'recusada')),
  sent_at timestamptz,
  decided_at timestamptz,
  next_action text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  proposal_id uuid not null,
  description text not null,
  quantity integer not null check (quantity >= 1),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id uuid not null,
  proposal_id uuid,
  title text not null,
  site_type text not null check (site_type in ('landing', 'institucional', 'personalizado')),
  stage text not null check (stage in ('briefing', 'design', 'desenvolvimento', 'revisao', 'publicacao', 'entrega')),
  start_date timestamptz not null,
  due_date timestamptz not null,
  contract_value numeric(12, 2) not null default 0 check (contract_value >= 0),
  preview_url text not null default '',
  published_url text not null default '',
  published_at timestamptz,
  delivered_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id),
  check (due_date >= start_date)
);

create table public.project_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  project_id uuid not null,
  title text not null,
  stage text not null check (stage in ('briefing', 'design', 'desenvolvimento', 'revisao', 'publicacao', 'entrega')),
  done boolean not null default false,
  done_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('receita', 'custo')),
  client_id uuid,
  project_id uuid,
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  due_date timestamptz not null,
  cancelled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, owner_id)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  transaction_id uuid not null,
  amount numeric(12, 2) not null check (amount > 0),
  paid_at timestamptz not null,
  note text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lead_id uuid,
  client_id uuid,
  project_id uuid,
  type text not null check (type in ('ligacao', 'whatsapp', 'email', 'visita', 'reuniao', 'nota', 'follow_up', 'etapa')),
  description text not null,
  due_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma linha de preferências por usuário (perfil, aparência, pacotes, padrões comerciais).
create table public.settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────────── Chaves estrangeiras (mesmo dono) ─────────────────────────────
-- "on delete set null (coluna)" zera só a referência, nunca o owner_id.

alter table public.leads
  add constraint leads_client_fk foreign key (client_id, owner_id)
    references public.clients (id, owner_id) on delete set null (client_id) deferrable initially deferred;

alter table public.clients
  add constraint clients_lead_fk foreign key (lead_id, owner_id)
    references public.leads (id, owner_id) on delete set null (lead_id) deferrable initially deferred;

alter table public.proposals
  add constraint proposals_lead_fk foreign key (lead_id, owner_id)
    references public.leads (id, owner_id) on delete set null (lead_id) deferrable initially deferred,
  add constraint proposals_client_fk foreign key (client_id, owner_id)
    references public.clients (id, owner_id) on delete set null (client_id) deferrable initially deferred;

alter table public.proposal_items
  add constraint proposal_items_proposal_fk foreign key (proposal_id, owner_id)
    references public.proposals (id, owner_id) on delete cascade deferrable initially deferred;

alter table public.projects
  add constraint projects_client_fk foreign key (client_id, owner_id)
    references public.clients (id, owner_id) on delete no action deferrable initially deferred,
  add constraint projects_proposal_fk foreign key (proposal_id, owner_id)
    references public.proposals (id, owner_id) on delete set null (proposal_id) deferrable initially deferred;

alter table public.project_tasks
  add constraint project_tasks_project_fk foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete cascade deferrable initially deferred;

alter table public.transactions
  add constraint transactions_client_fk foreign key (client_id, owner_id)
    references public.clients (id, owner_id) on delete set null (client_id) deferrable initially deferred,
  add constraint transactions_project_fk foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete set null (project_id) deferrable initially deferred;

alter table public.payments
  add constraint payments_transaction_fk foreign key (transaction_id, owner_id)
    references public.transactions (id, owner_id) on delete cascade deferrable initially deferred;

alter table public.activities
  add constraint activities_lead_fk foreign key (lead_id, owner_id)
    references public.leads (id, owner_id) on delete set null (lead_id) deferrable initially deferred,
  add constraint activities_client_fk foreign key (client_id, owner_id)
    references public.clients (id, owner_id) on delete set null (client_id) deferrable initially deferred,
  add constraint activities_project_fk foreign key (project_id, owner_id)
    references public.projects (id, owner_id) on delete set null (project_id) deferrable initially deferred;

-- ───────────────────────────── Índices ─────────────────────────────

create index leads_owner_idx on public.leads (owner_id);
create index leads_stage_idx on public.leads (owner_id, stage);
create index leads_next_action_at_idx on public.leads (owner_id, next_action_at);
create index leads_client_idx on public.leads (client_id);

create index clients_owner_idx on public.clients (owner_id);
create index clients_status_idx on public.clients (owner_id, status);
create index clients_lead_idx on public.clients (lead_id);

create index proposals_owner_idx on public.proposals (owner_id);
create index proposals_status_idx on public.proposals (owner_id, status);
create index proposals_lead_idx on public.proposals (lead_id);
create index proposals_client_idx on public.proposals (client_id);

create index proposal_items_owner_idx on public.proposal_items (owner_id);
create index proposal_items_proposal_idx on public.proposal_items (proposal_id);

create index projects_owner_idx on public.projects (owner_id);
create index projects_stage_idx on public.projects (owner_id, stage);
create index projects_due_date_idx on public.projects (owner_id, due_date);
create index projects_client_idx on public.projects (client_id);
create index projects_proposal_idx on public.projects (proposal_id);

create index project_tasks_owner_idx on public.project_tasks (owner_id);
create index project_tasks_project_idx on public.project_tasks (project_id);

create index transactions_owner_idx on public.transactions (owner_id);
create index transactions_due_date_idx on public.transactions (owner_id, due_date);
create index transactions_client_idx on public.transactions (client_id);
create index transactions_project_idx on public.transactions (project_id);

create index payments_owner_idx on public.payments (owner_id);
create index payments_transaction_idx on public.payments (transaction_id);

create index activities_owner_idx on public.activities (owner_id);
create index activities_due_at_idx on public.activities (owner_id, due_at);
create index activities_lead_idx on public.activities (lead_id);
create index activities_client_idx on public.activities (client_id);
create index activities_project_idx on public.activities (project_id);

-- ───────────────────────────── RLS ─────────────────────────────
-- Somente usuários autenticados, e somente as próprias linhas, nas 4 operações.

do $$
declare
  t text;
begin
  foreach t in array array[
    'leads', 'clients', 'proposals', 'proposal_items', 'projects',
    'project_tasks', 'transactions', 'payments', 'activities', 'settings'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (owner_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (owner_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (owner_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end
$$;

-- ───────────────────────────── Gravação atômica ─────────────────────────────
-- Recebe { upserts: { tabela: [linhas] }, deletes: { tabela: [ids] }, settings?: {...} }
-- já validado pelo servidor (Zod) e aplica tudo em UMA transação.
-- security invoker: roda com as permissões de quem chama → RLS vale aqui também.
-- Os nomes de tabela vêm SEMPRE das listas fixas abaixo, nunca do payload.

create or replace function public.apply_changes(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  t text;
  v_ids uuid[];
  v_cols text;
  v_sets text;
  upsert_order text[] := array[
    'leads', 'clients', 'proposals', 'proposal_items', 'projects',
    'project_tasks', 'transactions', 'payments', 'activities'
  ];
  delete_order text[] := array[
    'activities', 'payments', 'transactions', 'project_tasks', 'projects',
    'proposal_items', 'proposals', 'clients', 'leads'
  ];
begin
  if v_uid is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;
  if jsonb_typeof(payload) <> 'object' then
    raise exception 'payload inválido' using errcode = '22023';
  end if;

  foreach t in array delete_order loop
    if jsonb_typeof(payload -> 'deletes' -> t) = 'array' then
      select coalesce(array_agg(value::uuid), '{}')
        into v_ids
        from jsonb_array_elements_text(payload -> 'deletes' -> t);
      execute format('delete from public.%I where owner_id = $1 and id = any($2)', t)
        using v_uid, v_ids;
    end if;
  end loop;

  foreach t in array upsert_order loop
    if jsonb_typeof(payload -> 'upserts' -> t) = 'array' then
      select
        string_agg(quote_ident(a.attname), ', ' order by a.attnum),
        string_agg(format('%1$I = excluded.%1$I', a.attname), ', ' order by a.attnum)
          filter (where a.attname not in ('id', 'created_at'))
        into v_cols, v_sets
        from pg_catalog.pg_attribute a
       where a.attrelid = format('public.%I', t)::regclass
         and a.attnum > 0
         and not a.attisdropped
         and a.attname <> 'owner_id';

      -- owner_id fica fora da lista: recebe o default auth.uid() no insert
      -- e nunca é alterado no update.
      execute format(
        'insert into public.%1$I (%2$s) select %2$s from jsonb_populate_recordset(null::public.%1$I, $1) '
        'on conflict (id) do update set %3$s',
        t, v_cols, v_sets)
        using payload -> 'upserts' -> t;
    end if;
  end loop;

  if jsonb_typeof(payload -> 'settings') = 'object' then
    insert into public.settings (data)
    values (payload -> 'settings')
    on conflict (owner_id) do update set data = excluded.data, updated_at = now();
  end if;
end;
$$;

revoke all on function public.apply_changes(jsonb) from public, anon;
grant execute on function public.apply_changes(jsonb) to authenticated;
