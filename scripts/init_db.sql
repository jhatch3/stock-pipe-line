-- Schema for the Supabase project. Run once in the Supabase SQL editor.
-- Matches what the pipelines write (db/commander.py, data/stock_yf.py,
-- pipelines/features.py, pipelines/ai_agent.py) and what the frontend reads.
-- WARNING: drops existing tables.

begin;

drop table if exists stock_ai_analysis;
drop table if exists stock_features;
drop table if exists clean_stock_news_data;
drop table if exists stock_clean_data_yf;
drop table if exists tickers;

-- Ticker universe. Filled by `python -m scripts.seed_tickers`.
create table tickers (
  symbol  text primary key,
  name    text,
  sector  text
);

-- 1h and 1d OHLCV bars.
create table stock_clean_data_yf (
  ticker        text             not null,
  interval      text             not null,
  "timestamp"   timestamptz      not null,
  open          double precision not null,
  high          double precision not null,
  low           double precision not null,
  close         double precision not null,
  volume        bigint           not null,
  last_updated  timestamptz      not null default now(),
  primary key (ticker, interval, "timestamp")
);

-- Per-bar features from data/features.py:compute_features_df. Percent-type values are fractions.
create table stock_features (
  ticker        text        not null,
  interval      text        not null,
  "timestamp"   timestamptz not null,
  computed_at   timestamptz not null default now(),

  -- technical
  rsi double precision, macd double precision, macd_signal double precision, macd_histogram double precision,
  bb_middle double precision, bb_upper double precision, bb_lower double precision, bb_bandwidth double precision,
  vwap double precision, vix double precision,

  -- risk / return
  volatility double precision, sharpe_ratio double precision, sortino_ratio double precision,
  max_drawdown double precision, var_95 double precision, skewness double precision, kurtosis double precision,

  -- vs benchmark
  beta double precision, correlation double precision, r_squared double precision,
  alpha double precision, information_ratio double precision,

  -- fundamentals
  pe_ratio double precision, forward_pe double precision, pb_ratio double precision, ps_ratio double precision,
  ev_ebitda double precision, pcf_ratio double precision, peg_ratio double precision, eps double precision,
  roe double precision, roa double precision, net_profit_margin double precision,
  debt_to_equity double precision, current_ratio double precision, interest_coverage_ratio double precision,

  primary key (ticker, interval, "timestamp")
);

create table clean_stock_news_data (
  id          bigint primary key,
  ticker      text not null,
  author      text,
  url         text,
  source      text,
  created_at  timestamptz,
  headline    text,
  summary     text
);
create index clean_stock_news_data_ticker_idx on clean_stock_news_data (ticker, created_at desc);

-- One row per ticker (latest GPT summary).
create table stock_ai_analysis (
  ticker     text primary key,
  as_of_utc  timestamptz not null,
  summary    text,
  sources    jsonb
);

-- The frontend uses the anon key: allow read-only access. Pipelines use the
-- service_role key, which bypasses RLS.
do $$
declare t text;
begin
  foreach t in array array['tickers','stock_clean_data_yf','stock_features','clean_stock_news_data','stock_ai_analysis'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "public read" on %I for select to anon, authenticated using (true)', t);
    execute format('grant select on %I to anon, authenticated', t);
  end loop;
end $$;

commit;

notify pgrst, 'reload schema';
