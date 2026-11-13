import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "docuflow_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export function isDashboardConfigured(): boolean {
  const password = process.env.DOCUFLOW_DASHBOARD_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  return Boolean(password && secret && secret.length >= 32);
}

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters.");
  }
  return secret;
}

function sign(expiration: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(`docuflow:${expiration}`)
    .digest("hex");
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return false;

  const [expiration, signature, extra] = value.split(".");
  if (!expiration || !signature || extra || !/^\d+$/.test(expiration)) return false;
  if (Number(expiration) <= Math.floor(Date.now() / 1000)) return false;

  const expected = sign(expiration);
  const providedBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

export function verifyDashboardPassword(password: string): boolean {
  const expected = process.env.DOCUFLOW_DASHBOARD_PASSWORD;
  if (!expected) {
    throw new Error("DOCUFLOW_DASHBOARD_PASSWORD is not configured.");
  }

  const providedBuffer = Buffer.from(password);
  const expectedBuffer = Buffer.from(expected);
  return providedBuffer.length === expectedBuffer.length
    && timingSafeEqual(providedBuffer, expectedBuffer);
}

export async function createSession(): Promise<void> {
  const expiration = String(Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS);
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, `${expiration}.${sign(expiration)}`, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
