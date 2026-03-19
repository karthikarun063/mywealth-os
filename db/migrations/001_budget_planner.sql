-- MyWealth OS — Budget Planner Migration v2 (idempotent)
BEGIN;

-- Drop old budgets table entirely and recreate with correct schema
DROP TABLE IF EXISTS budgets CASCADE;

CREATE TABLE budgets (
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

CREATE INDEX IF NOT EXISTS idx_budgets_year_month ON budgets(year, month);
CREATE INDEX IF NOT EXISTS idx_budgets_user       ON budgets(user_id);

-- Trigger
DROP TRIGGER IF EXISTS budgets_updated_at ON budgets;
CREATE TRIGGER budgets_updated_at
  BEFORE UPDATE ON budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- budget_summary view
DROP VIEW IF EXISTS budget_summary;
CREATE VIEW budget_summary AS
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
  GROUP BY category,
           EXTRACT(MONTH FROM date)::SMALLINT,
           EXTRACT(YEAR  FROM date)::SMALLINT
) t ON t.category = b.category
    AND t.month    = b.month
    AND t.year     = b.year;

COMMIT;
