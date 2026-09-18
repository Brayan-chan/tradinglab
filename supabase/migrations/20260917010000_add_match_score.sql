alter table public.mt5_bot_decisions add column if not exists match_score smallint check (match_score is null or match_score between 0 and 3);
