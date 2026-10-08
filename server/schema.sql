CREATE TABLE IF NOT EXISTS searches (
 code uuid PRIMARY KEY, config jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS reports (
 id uuid PRIMARY KEY, code uuid NOT NULL REFERENCES searches(code) ON DELETE CASCADE,
 source text NOT NULL CHECK (source IN ('manual','cron')), status text NOT NULL CHECK (status IN ('running','completed','failed')),
 results jsonb NOT NULL DEFAULT '[]', warnings jsonb NOT NULL DEFAULT '[]', error text,
 created_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS reports_code_date ON reports(code,created_at DESC);
