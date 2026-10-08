alter table public.mt5_bot_pending_orders add column if not exists position_ticket text;
create index if not exists mt5_bot_pending_orders_position_ticket_idx on public.mt5_bot_pending_orders(position_ticket) where position_ticket is not null;
