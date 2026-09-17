-- Cola de señales que requieren tu aprobación explícita antes de ejecutarse en demo
create table if not exists public.mt5_bot_pending_orders (
  id bigint generated always as identity primary key,
  account_key text not null references public.mt5_accounts(account_key) on delete cascade,
  decision_id bigint not null references public.mt5_bot_decisions(id) on delete cascade,
  symbol text not null,
  side text not null check (side in ('buy','sell')),
  entry_price numeric not null,
  stop_loss numeric not null,
  take_profit numeric not null,
  volume numeric not null,
  candle_time timestamptz not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','filled')),
  expires_at timestamptz not null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mt5_bot_pending_orders_status_idx
  on public.mt5_bot_pending_orders(account_key, status, expires_at);

alter table public.mt5_bot_pending_orders enable row level security;
revoke all on public.mt5_bot_pending_orders from anon, authenticated;
grant all on public.mt5_bot_pending_orders to service_role;

-- Post-mortem de cada señal (ganada, perdida o aún pendiente de resultado)
create table if not exists public.mt5_trade_reviews (
  id bigint generated always as identity primary key,
  account_key text not null references public.mt5_accounts(account_key) on delete cascade,
  decision_id bigint not null references public.mt5_bot_decisions(id) on delete cascade,
  pending_order_id bigint references public.mt5_bot_pending_orders(id) on delete set null,
  outcome_status text not null check (outcome_status in ('pending','tp','sl','ambiguous','incomplete','invalid')),
  r_multiple numeric,
  resolved_at timestamptz,
  llm_summary text,
  llm_model text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists mt5_trade_reviews_account_idx
  on public.mt5_trade_reviews(account_key, created_at desc);

alter table public.mt5_trade_reviews enable row level security;
revoke all on public.mt5_trade_reviews from anon, authenticated;
grant all on public.mt5_trade_reviews to service_role;
