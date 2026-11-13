import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthenticatedUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";
import { getWorkspaceIdForUser } from "@/lib/workspaces";

export async function GET(): Promise<NextResponse> {
  const user = await getAuthenticatedUser(await cookies());
  if (!user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }
  const workspaceId = await getWorkspaceIdForUser(user.id);
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace is configured for this user." }, { status: 503 });
  }
  const { repositories } = await getDashboardData(workspaceId);
  return NextResponse.json({ repositories });
}
