-- EvidenceCheck AI database schema
-- Safe for public GitHub repositories.
-- This file defines the PostgreSQL structure only. It does not include real data.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS evidencecheck_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  claim TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'processing',

  result JSONB,
  error TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT evidencecheck_jobs_status_check
    CHECK (status IN ('processing', 'completed', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_evidencecheck_jobs_status
  ON evidencecheck_jobs (status);

CREATE INDEX IF NOT EXISTS idx_evidencecheck_jobs_created_at
  ON evidencecheck_jobs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidencecheck_jobs_result_gin
  ON evidencecheck_jobs
  USING GIN (result);

CREATE OR REPLACE FUNCTION set_evidencecheck_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evidencecheck_jobs_updated_at
ON evidencecheck_jobs;

CREATE TRIGGER trg_evidencecheck_jobs_updated_at
BEFORE UPDATE ON evidencecheck_jobs
FOR EACH ROW
EXECUTE FUNCTION set_evidencecheck_jobs_updated_at();
