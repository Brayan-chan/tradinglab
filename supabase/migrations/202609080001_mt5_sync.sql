create table if not exists public.mt5_accounts (
  account_key text primary key,
  login_masked text not null,
  server text not null,
  currency text not null,
  balance numeric not null,
  equity numeric not null,
  margin numeric not null,
  free_margin numeric not null,
  margin_level numeric not null,
  snapshot_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.mt5_positions (
  account_key text not null references public.mt5_accounts(account_key) on delete cascade,
  ticket text not null,
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  volume numeric not null check (volume > 0),
  price_open numeric not null,
  price_current numeric not null,
  stop_loss numeric,
  take_profit numeric,
  profit numeric not null,
  swap numeric not null,
  observed_at timestamptz not null,
  primary key (account_key,ticket)
);

create table if not exists public.mt5_deals (
  account_key text not null references public.mt5_accounts(account_key) on delete cascade,
  ticket text not null,
  order_ticket text not null,
  position_ticket text not null,
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  volume numeric not null,
  price numeric not null,
  profit numeric not null,
  commission numeric not null,
  swap numeric not null,
  executed_at timestamptz not null,
  primary key (account_key,ticket)
);

create table if not exists public.mt5_symbols (
  account_key text not null references public.mt5_accounts(account_key) on delete cascade,
  symbol text not null,
  contract_size numeric not null,
  tick_size numeric not null,
  tick_value numeric not null,
  volume_min numeric not null,
  volume_step numeric not null,
  bid numeric not null,
  ask numeric not null,
  observed_at timestamptz not null,
  primary key (account_key,symbol)
);

create index if not exists mt5_deals_executed_idx on public.mt5_deals(account_key,executed_at desc);
alter table public.mt5_accounts enable row level security;
alter table public.mt5_positions enable row level security;
alter table public.mt5_deals enable row level security;
alter table public.mt5_symbols enable row level security;
revoke all on public.mt5_accounts, public.mt5_positions, public.mt5_deals, public.mt5_symbols from anon, authenticated;
grant all on public.mt5_accounts, public.mt5_positions, public.mt5_deals, public.mt5_symbols to service_role;
