"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceIdForUser } from "@/lib/workspaces";

function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (siteUrl) return siteUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  throw new Error("NEXT_PUBLIC_SITE_URL must be configured in production.");
}

export async function login(formData: FormData): Promise<void> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    redirect("/?mode=login&error=credentials");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/?mode=login&error=credentials");
  redirect("/");
}

export async function signUp(formData: FormData): Promise<void> {
  const email = formData.get("email");
  const password = formData.get("password");
  if (
    typeof email !== "string"
    || typeof password !== "string"
    || !email
    || password.length < 8
  ) {
    redirect("/?mode=signup&error=signup");
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/callback` },
  });
  if (error) redirect("/?mode=signup&error=signup");
  if (data.session) redirect("/");
  redirect("/?mode=login&notice=check-email");
}

export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  redirect("/");
}

export async function connectGitHubApp(): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user) redirect("/");

  const appSlug = process.env.GITHUB_APP_SLUG;
  if (!appSlug) redirect("/?error=github");

  const workspaceId = await getWorkspaceIdForUser(user.id);
  if (!workspaceId) throw new Error("No workspace is associated with this user.");

  const state = randomUUID();
  await getPool().query(
    `INSERT INTO github_installation_states (state, user_id, workspace_id, expires_at)
     VALUES ($1, $2, $3, now() + interval '10 minutes')`,
    [state, user.id, workspaceId],
  );

  redirect(`https://github.com/apps/${encodeURIComponent(appSlug)}/installations/new?state=${encodeURIComponent(state)}`);
}
