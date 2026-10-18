-- One row per ticker for the dashboard: latest price, % changes, 30-day sparkline,
-- and headline risk metrics. Filled by `python -m pipelines.snapshot --run --all`.
-- Run once in the Supabase SQL editor (also included in init_db.sql).

create table if not exists ticker_snapshot (
  ticker        text primary key,
  last_close    double precision,
  last_ts       timestamptz,
  chg_1d        double precision,   -- fractions: 0.012 = +1.2%
  chg_1w        double precision,
  chg_1m        double precision,
  spark         jsonb,              -- last 30 daily closes, oldest first
  rsi           double precision,
  sharpe_ratio  double precision,
  volatility    double precision,
  updated_at    timestamptz not null default now()
);

alter table ticker_snapshot enable row level security;
drop policy if exists "public read" on ticker_snapshot;
create policy "public read" on ticker_snapshot for select to anon, authenticated using (true);
grant select on ticker_snapshot to anon, authenticated;

notify pgrst, 'reload schema';
