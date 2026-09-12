create table public.mt5_market_bars (
 account_key text not null references public.mt5_accounts(account_key) on delete cascade,
 symbol text not null, time bigint not null,
 open double precision not null, high double precision not null,
 low double precision not null, close double precision not null,
 captured_at timestamptz not null,
 primary key(account_key,symbol,time),
 check (low <= least(open,close) and high >= greatest(open,close))
);
alter table public.mt5_market_bars enable row level security;
revoke all on public.mt5_market_bars from anon, authenticated;
grant select, insert, update, delete on public.mt5_market_bars to service_role;
