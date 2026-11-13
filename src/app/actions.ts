"use server";

import { redirect } from "next/navigation";
import { clearSession, createSession, verifyDashboardPassword } from "@/lib/auth";

export async function login(formData: FormData): Promise<void> {
  const password = formData.get("password");
  if (typeof password !== "string" || !verifyDashboardPassword(password)) {
    redirect("/?error=1");
  }
  await createSession();
  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/");
}
