import { getPool } from "@/lib/db";

export async function getWorkspaceIdForUser(userId: string): Promise<string | null> {
  const result = await getPool().query<{ workspace_id: string }>(
    `SELECT workspace_id::text
     FROM workspace_members
     WHERE user_id = $1
     ORDER BY created_at
     LIMIT 1`,
    [userId],
  );
  return result.rows[0]?.workspace_id ?? null;
}
