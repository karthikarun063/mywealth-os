-- MyWealth OS — Financial Strategy Engine Migration
-- Run: node db/migrate.js (appends to existing migrations)

BEGIN;

CREATE TABLE IF NOT EXISTS financial_reports (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL DEFAULT 'default',
  score      SMALLINT    NOT NULL CHECK (score BETWEEN 0 AND 100),
  risk_level TEXT        NOT NULL CHECK (risk_level IN ('Low','Moderate','High','Critical')),
  summary    JSONB       NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_user_id   ON financial_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_created   ON financial_reports(created_at DESC);

COMMIT;
