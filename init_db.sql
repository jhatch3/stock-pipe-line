BEGIN;

-- Drop in dependency order (optional "from scratch")
DROP TABLE IF EXISTS stock_features;
DROP TABLE IF EXISTS stock_ai_data;
DROP TABLE IF EXISTS clean_stock_news_data;
DROP TABLE IF EXISTS raw_stock_news_data;
DROP TABLE IF EXISTS clean_stock_data_yf;
DROP TABLE IF EXISTS raw_stock_data_yf;
DROP TABLE IF EXISTS tickers;

-- -------------------------
-- Dimension: tickers
-- -------------------------
CREATE TABLE tickers (
  ticker TEXT PRIMARY KEY
);

-- -------------------------
-- Raw OHLCV (Yahoo Finance)
-- -------------------------
CREATE TABLE raw_stock_data_yf (
  ticker       TEXT        NOT NULL,
  interval     TEXT        NOT NULL,
  payload      JSONB       NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT raw_stock_data_yf_ticker_fk
    FOREIGN KEY (ticker) REFERENCES tickers(ticker)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX raw_stock_data_yf_lookup_idx
  ON raw_stock_data_yf (ticker, interval, last_updated DESC);

-- -------------------------
-- Clean OHLCV (typed bars)
-- -------------------------
CREATE TABLE clean_stock_data_yf (
  ticker       TEXT        NOT NULL,
  interval     TEXT        NOT NULL,
  "timestamp"  TIMESTAMPTZ NOT NULL,
  open         NUMERIC(18,8) NOT NULL,
  high         NUMERIC(18,8) NOT NULL,
  low          NUMERIC(18,8) NOT NULL,
  close        NUMERIC(18,8) NOT NULL,
  volume       BIGINT      NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clean_stock_data_yf_pk PRIMARY KEY (ticker, interval, "timestamp"),
  CONSTRAINT clean_stock_data_yf_ticker_fk
    FOREIGN KEY (ticker) REFERENCES tickers(ticker)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX clean_stock_data_yf_lookup_idx
  ON clean_stock_data_yf (ticker, interval, "timestamp" DESC);

-- -------------------------
-- Raw News (json payload)
-- -------------------------
CREATE TABLE raw_stock_news_data (
  id           TEXT        NOT NULL PRIMARY KEY,
  ticker       TEXT        NOT NULL,
  data         JSONB       NOT NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT raw_stock_news_data_ticker_fk
    FOREIGN KEY (ticker) REFERENCES tickers(ticker)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX raw_stock_news_data_lookup_idx
  ON raw_stock_news_data (ticker, last_updated DESC);

-- -------------------------
-- Clean News (typed)
-- -------------------------
CREATE TABLE clean_stock_news_data (
  id           TEXT        NOT NULL PRIMARY KEY,
  ticker       TEXT        NOT NULL,
  author       TEXT        NULL,
  url          TEXT        NOT NULL,
  source       TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL,
  headline     TEXT        NOT NULL,
  summary      TEXT        NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT clean_stock_news_data_ticker_fk
    FOREIGN KEY (ticker) REFERENCES tickers(ticker)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX clean_stock_news_data_lookup_idx
  ON clean_stock_news_data (ticker, created_at DESC);

CREATE UNIQUE INDEX clean_stock_news_data_unique_ticker_url
  ON clean_stock_news_data (ticker, url);

-- -------------------------
-- AI Summary (latest per ticker)
-- -------------------------
CREATE TABLE stock_ai_data (
  ticker       TEXT        NOT NULL PRIMARY KEY,
  name         TEXT        NULL,
  summary      TEXT        NOT NULL,
  sources      JSONB       NULL,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT stock_ai_data_ticker_fk
    FOREIGN KEY (ticker) REFERENCES tickers(ticker)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX stock_ai_data_lookup_idx
  ON stock_ai_data (ticker, last_updated DESC);

-- -------------------------
-- Feature Layer (OHLCV + engineered features)
-- NOTE: engineered features are NULLable (lookback windows)
-- -------------------------
CREATE TABLE stock_features (
  ticker       TEXT        NOT NULL,
  interval     TEXT        NOT NULL,
  "timestamp"  TIMESTAMPTZ NOT NULL,

  -- base OHLCV (same as clean_stock_data_yf)
  open         NUMERIC(18,8) NOT NULL,
  high         NUMERIC(18,8) NOT NULL,
  low          NUMERIC(18,8) NOT NULL,
  close        NUMERIC(18,8) NOT NULL,
  volume       BIGINT      NOT NULL,

  -- engineered features (NULLable)
  ret_1        DOUBLE PRECISION NULL,
  ret_5        DOUBLE PRECISION NULL,
  log_ret_1    DOUBLE PRECISION NULL,

  sma_10       DOUBLE PRECISION NULL,
  sma_20       DOUBLE PRECISION NULL,
  sma_50       DOUBLE PRECISION NULL,

  ema_10       DOUBLE PRECISION NULL,
  ema_20       DOUBLE PRECISION NULL,
  ema_50       DOUBLE PRECISION NULL,

  bb_mid_20    DOUBLE PRECISION NULL,
  bb_upper_20  DOUBLE PRECISION NULL,
  bb_lower_20  DOUBLE PRECISION NULL,
  bb_width_20  DOUBLE PRECISION NULL,
  bb_pctb_20   DOUBLE PRECISION NULL,

  vol_20       DOUBLE PRECISION NULL,
  vol_60       DOUBLE PRECISION NULL,

  rsi_14       DOUBLE PRECISION NULL,
  atr_14       DOUBLE PRECISION NULL,
  vwap         DOUBLE PRECISION NULL,

  macd_12_26   DOUBLE PRECISION NULL,
  macd_signal_9 DOUBLE PRECISION NULL,
  macd_hist    DOUBLE PRECISION NULL,

  momentum_10  DOUBLE PRECISION NULL,
  zscore_20    DOUBLE PRECISION NULL,

  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT stock_features_pk PRIMARY KEY (ticker, interval, "timestamp"),
  CONSTRAINT stock_features_ticker_fk
    FOREIGN KEY (ticker) REFERENCES tickers(ticker)
    ON UPDATE CASCADE ON DELETE RESTRICT
);

CREATE INDEX stock_features_lookup_idx
  ON stock_features (ticker, interval, "timestamp" DESC);

COMMIT;