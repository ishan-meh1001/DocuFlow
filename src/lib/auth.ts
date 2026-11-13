import type { User } from "@supabase/supabase-js";
import type { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export function isSupabaseAuthConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export async function getAuthenticatedUser(
  cookieStore?: Awaited<ReturnType<typeof cookies>>,
): Promise<User | null> {
  const supabase = await createSupabaseServerClient(cookieStore);
  const { data, error } = await supabase.auth.getUser();
  if (error && error.name !== "AuthSessionMissingError") throw error;
  return data.user;
}
