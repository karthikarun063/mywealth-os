-- MyWealth OS — PostgreSQL Schema v2.0
-- Run: psql -d mywealth -f db/schema.sql

BEGIN;

-- ─── Extensions ───────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Assets ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS assets (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT        NOT NULL,
  asset_class    TEXT        NOT NULL,
  quantity       NUMERIC(18,6) NOT NULL DEFAULT 1,
  purchase_value NUMERIC(18,2) NOT NULL DEFAULT 0,
  current_value  NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency       CHAR(3)     NOT NULL DEFAULT 'INR',
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assets_class_check CHECK (asset_class IN (
    'stocks','mutual_funds','etf','crypto','bank_account','cash',
    'fixed_deposit','epf','ppf','nps','gold','real_estate',
    'vehicle','foreign_assets','others'
  ))
);

-- ─── Liabilities ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liabilities (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT        NOT NULL,
  liability_type     TEXT        NOT NULL,
  outstanding_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  interest_rate      NUMERIC(6,2) NOT NULL DEFAULT 0,
  emi                NUMERIC(18,2) NOT NULL DEFAULT 0,
  lender             TEXT        NOT NULL DEFAULT '',
  due_date           DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT liabilities_type_check CHECK (liability_type IN (
    'home_loan','personal_loan','education_loan','car_loan','credit_card'
  ))
);

-- ─── Transactions ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT        NOT NULL CHECK (type IN ('income','expense')),
  category   TEXT        NOT NULL,
  amount     NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  notes      TEXT,
  recurring  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Budgets ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category      TEXT        NOT NULL,
  monthly_limit NUMERIC(18,2) NOT NULL CHECK (monthly_limit > 0),
  month         CHAR(7)     NOT NULL,  -- YYYY-MM
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(category, month)
);

-- ─── Goals ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_name             TEXT        NOT NULL,
  goal_type             TEXT        NOT NULL DEFAULT 'other',
  target_amount         NUMERIC(18,2) NOT NULL CHECK (target_amount > 0),
  current_amount        NUMERIC(18,2) NOT NULL DEFAULT 0,
  monthly_contribution  NUMERIC(18,2) NOT NULL DEFAULT 0,
  target_date           DATE,
  expected_return       NUMERIC(5,2) NOT NULL DEFAULT 10,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Snapshots ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS snapshots (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  month             CHAR(7)     NOT NULL UNIQUE,  -- YYYY-MM
  total_assets      NUMERIC(18,2) NOT NULL DEFAULT 0,
  total_liabilities NUMERIC(18,2) NOT NULL DEFAULT 0,
  net_worth         NUMERIC(18,2) NOT NULL DEFAULT 0,
  savings_rate      NUMERIC(6,2) NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_transactions_date     ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type     ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_assets_class          ON assets(asset_class);
CREATE INDEX IF NOT EXISTS idx_budgets_month         ON budgets(month);
CREATE INDEX IF NOT EXISTS idx_snapshots_month       ON snapshots(month DESC);

-- ─── Updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS assets_updated_at     ON assets;
DROP TRIGGER IF EXISTS liabilities_updated_at ON liabilities;
DROP TRIGGER IF EXISTS goals_updated_at       ON goals;

CREATE TRIGGER assets_updated_at
  BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER liabilities_updated_at
  BEFORE UPDATE ON liabilities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

COMMIT;
