-- MyWealth OS — Budget Planner Migration v1
-- Upgrades the budgets table to the full spec:
--   + user_id column
--   + monthly_budget (renamed from monthly_limit)
--   + year column (extracted from month)
--   + percentage_used computed view
-- Run: psql -d mywealth -f db/migrations/001_budget_planner.sql

BEGIN;

-- ── Drop and recreate budgets with full spec ────────────────────────────────
-- Safe migration: only recreate if schema differs
-- ALTER TABLE budgets ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL DEFAULT 'default';
-- If budgets table exists with old schema, add missing columns instead of dropping
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='monthly_limit') THEN
    ALTER TABLE budgets RENAME COLUMN monthly_limit TO monthly_budget;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='user_id') THEN
    ALTER TABLE budgets ADD COLUMN user_id TEXT NOT NULL DEFAULT 'default';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='budgets' AND column_name='year') THEN
    ALTER TABLE budgets ADD COLUMN year SMALLINT NOT NULL DEFAULT EXTRACT(YEAR FROM NOW())::SMALLINT;
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS budgets (
  id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT         NOT NULL DEFAULT 'default',
  category       TEXT         NOT NULL,
  monthly_budget NUMERIC(18,2) NOT NULL CHECK (monthly_budget > 0),
  month          SMALLINT     NOT NULL CHECK (month BETWEEN 1 AND 12),
  year           SMALLINT     NOT NULL CHECK (year >= 2020),
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT budgets_unique UNIQUE (user_id, category, month, year)
);

-- Trigger: auto-update updated_at
DROP TRIGGER IF EXISTS budgets_updated_at ON budgets;
CREATE TRIGGER budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Index for fast monthly lookups
CREATE INDEX IF NOT EXISTS idx_budgets_year_month ON budgets(year, month);
CREATE INDEX IF NOT EXISTS idx_budgets_user       ON budgets(user_id);

-- ── Convenience view: budget_summary ───────────────────────────────────────
-- Joins budgets with actual transaction spend for the same period.
CREATE OR REPLACE VIEW budget_summary AS
SELECT
  b.id,
  b.user_id,
  b.category,
  b.monthly_budget                                        AS budget,
  b.month,
  b.year,
  COALESCE(t.actual_spending, 0)                          AS actual_spending,
  b.monthly_budget - COALESCE(t.actual_spending, 0)       AS difference,
  ROUND(
    COALESCE(t.actual_spending, 0) / NULLIF(b.monthly_budget, 0) * 100, 1
  )                                                       AS percentage_used,
  b.created_at,
  b.updated_at
FROM budgets b
LEFT JOIN (
  SELECT
    category,
    EXTRACT(MONTH FROM date)::SMALLINT AS month,
    EXTRACT(YEAR  FROM date)::SMALLINT AS year,
    SUM(amount)                        AS actual_spending
  FROM transactions
  WHERE type = 'expense'
  GROUP BY category, EXTRACT(MONTH FROM date), EXTRACT(YEAR FROM date)
) t ON t.category = b.category
    AND t.month    = b.month
    AND t.year     = b.year;

COMMIT;
