import { NextResponse } from "next/server";
import { isAuthenticated } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";

export async function GET(): Promise<NextResponse> {
  if (!await isAuthenticated()) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: "DATABASE_URL is not configured." }, { status: 503 });
  }
  const { repositories } = await getDashboardData();
  return NextResponse.json({ repositories });
}
