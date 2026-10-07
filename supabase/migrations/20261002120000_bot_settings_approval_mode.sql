create table if not exists public.mt5_bot_settings (
  id boolean primary key default true,
  approval_mode text not null default 'manual' check (approval_mode in ('manual','auto')),
  updated_at timestamptz not null default now(),
  constraint singleton_row check (id)
);
insert into public.mt5_bot_settings (id) values (true) on conflict (id) do nothing;

alter table public.mt5_bot_settings enable row level security;
revoke all on public.mt5_bot_settings from anon, authenticated;
grant all on public.mt5_bot_settings to service_role;
