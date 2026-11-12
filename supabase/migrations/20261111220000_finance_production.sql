-- Sellora · Financeiro pronto para produção
--
-- Aditiva e reversível: só ADICIONA colunas com padrão neutro e um gatilho de
-- integridade. Nenhuma linha existente é apagada ou reescrita.
--
-- 1. projects.contract_cancelled_at  → contrato cancelado deixa de contar como receita contratada.
-- 2. transactions.category / notes   → categoria de despesa e observações.
-- 3. payments.method                 → forma de pagamento informada.
-- 4. Gatilho: a soma dos pagamentos de um lançamento nunca passa do valor do
--    lançamento (protege contra recebimento duplicado mesmo fora do app).
--
-- apply_changes descobre as colunas pelo catálogo (pg_attribute), então as
-- novas colunas passam a ser gravadas sem alterar a função.
--
-- ── Reverter (rodar manualmente, depois de backup) ──────────────────────────
-- drop trigger if exists payments_within_amount on public.payments;
-- drop trigger if exists transactions_amount_covers_payments on public.transactions;
-- drop function if exists public.check_payments_within_amount();
-- alter table public.payments drop column if exists method;
-- alter table public.transactions drop column if exists notes, drop column if exists category;
-- alter table public.projects drop column if exists contract_cancelled_at;
-- (Reverter apaga as informações dessas colunas; exporte antes em Configurações → Exportar.)

alter table public.projects
  add column if not exists contract_cancelled_at timestamptz;

alter table public.transactions
  add column if not exists category text not null default ''
    check (category in ('', 'ferramentas', 'hospedagem', 'dominio', 'marketing', 'terceiros', 'impostos', 'taxas', 'equipamentos', 'outros')),
  add column if not exists notes text not null default ''
    check (char_length(notes) <= 500);

alter table public.payments
  add column if not exists method text not null default ''
    check (method in ('', 'pix', 'transferencia', 'boleto', 'cartao', 'dinheiro', 'outro'));

-- ───────────── Integridade: pagamentos ≤ valor do lançamento ─────────────
-- Gatilho de restrição adiável: confere no COMMIT, depois que apply_changes
-- gravou lançamento e pagamentos da mesma operação (ordem dentro da transação
-- não importa). security invoker + RLS: só enxerga as linhas do próprio dono.

create or replace function public.check_payments_within_amount()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_tx uuid;
  v_amount numeric(12, 2);
  v_paid numeric(12, 2);
begin
  if tg_table_name = 'payments' then
    v_tx := coalesce(new.transaction_id, old.transaction_id);
  else
    v_tx := new.id;
  end if;

  select t.amount into v_amount from public.transactions t where t.id = v_tx;
  if v_amount is null then
    return null; -- lançamento removido na mesma transação (cascade)
  end if;

  select coalesce(sum(p.amount), 0) into v_paid from public.payments p where p.transaction_id = v_tx;
  if v_paid > v_amount then
    raise exception 'pagamentos (%) maiores que o valor do lançamento (%)', v_paid, v_amount
      using errcode = '23514';
  end if;
  return null;
end;
$$;

drop trigger if exists payments_within_amount on public.payments;
create constraint trigger payments_within_amount
  after insert or update on public.payments
  deferrable initially deferred
  for each row execute function public.check_payments_within_amount();

drop trigger if exists transactions_amount_covers_payments on public.transactions;
create constraint trigger transactions_amount_covers_payments
  after update of amount on public.transactions
  deferrable initially deferred
  for each row execute function public.check_payments_within_amount();
-- Funções de gatilho não podem ser chamadas diretamente (só como gatilho).
