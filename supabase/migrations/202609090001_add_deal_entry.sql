alter table public.mt5_deals
  add column if not exists entry text not null default 'out'
  check (entry in ('in','out','inout'));
