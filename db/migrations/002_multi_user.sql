CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('owner', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS github_installations (
  installation_id bigint PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS github_installation_states (
  state uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE repositories
  ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;

ALTER TABLE repositories
  DROP CONSTRAINT IF EXISTS repositories_github_repo_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS repositories_workspace_github_repo_idx
  ON repositories (workspace_id, github_repo_id);

CREATE INDEX IF NOT EXISTS workspace_members_user_idx
  ON workspace_members (user_id, workspace_id);

CREATE INDEX IF NOT EXISTS repositories_workspace_name_idx
  ON repositories (workspace_id, full_name);

CREATE OR REPLACE FUNCTION public.create_default_workspace_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  new_workspace_id uuid;
  workspace_name text;
BEGIN
  workspace_name := COALESCE(
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'My'
  ) || '''s workspace';

  INSERT INTO public.workspaces (name)
  VALUES (workspace_name)
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_create_workspace ON auth.users;
CREATE TRIGGER on_auth_user_created_create_workspace
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_default_workspace_for_user();

DO $$
DECLARE
  existing_user record;
  new_workspace_id uuid;
BEGIN
  FOR existing_user IN
    SELECT u.id, u.email
    FROM auth.users u
    LEFT JOIN public.workspace_members m ON m.user_id = u.id
    WHERE m.user_id IS NULL
  LOOP
    INSERT INTO public.workspaces (name)
    VALUES (
      COALESCE(NULLIF(split_part(COALESCE(existing_user.email, ''), '@', 1), ''), 'My')
      || '''s workspace'
    )
    RETURNING id INTO new_workspace_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (new_workspace_id, existing_user.id, 'owner');
  END LOOP;
END;
$$;

REVOKE ALL PRIVILEGES ON TABLE
  public.repositories,
  public.analysis_runs,
  public.repository_files,
  public.findings,
  public.document_embeddings,
  public.webhook_deliveries,
  public.workspaces,
  public.workspace_members,
  public.github_installations,
  public.github_installation_states
FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.create_default_workspace_for_user()
FROM PUBLIC, anon, authenticated;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_installation_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repository_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;
