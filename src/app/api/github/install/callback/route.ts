import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const installationId = request.nextUrl.searchParams.get("installation_id");
  const state = request.nextUrl.searchParams.get("state");
  if (
    !installationId
    || !/^\d+$/.test(installationId)
    || !state
    || !z.string().uuid().safeParse(state).success
  ) {
    return NextResponse.redirect(new URL("/?error=github-install", request.url));
  }

  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.redirect(new URL("/?error=github-session", request.url));

  const pool = getPool();
  const stateResult = await pool.query<{ workspace_id: string }>(
    `DELETE FROM github_installation_states
     WHERE state = $1::uuid AND user_id = $2 AND expires_at > now()
     RETURNING workspace_id::text`,
    [state, user.id],
  );
  const workspaceId = stateResult.rows[0]?.workspace_id;
  if (!workspaceId) {
    return NextResponse.redirect(new URL("/?error=github-state", request.url));
  }

  const installationResult = await pool.query(
    `INSERT INTO github_installations (installation_id, workspace_id)
     VALUES ($1, $2)
     ON CONFLICT (installation_id) DO UPDATE
       SET workspace_id = EXCLUDED.workspace_id
       WHERE github_installations.workspace_id = EXCLUDED.workspace_id
     RETURNING installation_id`,
    [installationId, workspaceId],
  );
  if (!installationResult.rowCount) {
    return NextResponse.redirect(new URL("/?error=github-installation-owned", request.url));
  }

  return NextResponse.redirect(new URL("/?github=connected", request.url));
}
