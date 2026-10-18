-- Shrinks the database to fit Supabase's free tier (500 MB).
-- Removes data the website and pipelines never read. See README "Free-tier storage".
-- Run in the Supabase SQL editor. Irreversible: export anything you want to keep first.

-- 0. Before: size per table
select relname as table, pg_size_pretty(pg_total_relation_size(relid)) as size
from pg_catalog.pg_statio_user_tables
order by pg_total_relation_size(relid) desc;

-- 1. Raw JSON layers (nothing reads them; the code and init_db.sql use different names, so drop both)
drop table if exists stock_raw_data_yf;
drop table if exists raw_stock_data_yf;
drop table if exists raw_stock_news_data;

-- 2. Price intervals the site doesn't chart (it only uses 1h and 1d)
delete from stock_clean_data_yf where interval not in ('1h', '1d');

-- 3. Feature history: the site only shows the latest row per ticker.
--    Safe to re-run any time to keep the table small.
delete from stock_features where "timestamp" < now() - interval '30 days';

-- 4. Reclaim the space from steps 2-3. VACUUM can't run inside a transaction,
--    so run these two lines on their own after the statements above.
-- vacuum full stock_clean_data_yf;
-- vacuum full stock_features;

-- 5. After: total database size (free tier limit is 500 MB)
-- select pg_size_pretty(pg_database_size(current_database()));
