CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS repositories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  github_repo_id bigint NOT NULL UNIQUE,
  full_name text NOT NULL,
  owner text NOT NULL,
  name text NOT NULL,
  html_url text NOT NULL,
  default_branch text NOT NULL DEFAULT 'main',
  installation_id bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  commit_sha text NOT NULL,
  status text NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS analysis_runs_repository_started_idx
  ON analysis_runs (repository_id, started_at DESC);

CREATE TABLE IF NOT EXISTS repository_files (
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path text NOT NULL,
  content_sha text NOT NULL,
  language text NOT NULL CHECK (language IN ('markdown', 'typescript', 'javascript')),
  content text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repository_id, path)
);

CREATE TABLE IF NOT EXISTS findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_run_id uuid NOT NULL REFERENCES analysis_runs(id) ON DELETE CASCADE,
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path text,
  finding_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  title text NOT NULL,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS findings_repository_created_idx
  ON findings (repository_id, created_at DESC);

CREATE TABLE IF NOT EXISTS document_embeddings (
  repository_id uuid NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
  path text NOT NULL,
  content_hash text NOT NULL,
  embedding vector(1536) NOT NULL,
  model text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (repository_id, path)
);

CREATE INDEX IF NOT EXISTS document_embeddings_cosine_idx
  ON document_embeddings USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  delivery_id text PRIMARY KEY,
  event_name text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
