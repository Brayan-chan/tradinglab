create table if not exists public.mt5_bot_decisions (
  id bigint generated always as identity primary key,
  account_key text not null references public.mt5_accounts(account_key) on delete cascade,
  symbol text not null,
  timeframe text not null,
  mode text not null check (mode in ('shadow','demo')),
  verdict text not null check (verdict in ('outside_session','blocked','no_setup','signal','order_sent','error')),
  side text check (side in ('buy','sell')),
  reason text not null,
  candle_time timestamptz not null,
  evaluated_at timestamptz not null,
  entry_price numeric,
  stop_loss numeric,
  take_profit numeric,
  risk_percent numeric,
  reward_risk numeric,
  spread_points numeric,
  h1_fast numeric,
  h1_slow numeric,
  m15_ema numeric,
  m15_atr numeric,
  m5_ema numeric,
  created_at timestamptz not null default now()
);

create index if not exists mt5_bot_decisions_account_time_idx
  on public.mt5_bot_decisions(account_key,evaluated_at desc);

alter table public.mt5_bot_decisions enable row level security;
revoke all on public.mt5_bot_decisions from anon, authenticated;
grant all on public.mt5_bot_decisions to service_role;
