import crypto from "crypto";
import type { NextRequest } from "next/server";

export const ADMIN_COOKIE_NAME = "traduz_admin_session";
const TOKEN_CONTEXT = "traduz-legendas:admin-logs:v1";

function getAdminSecret(): string | null {
  const secret = process.env.ADMIN_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

export function isAdminSecretConfigured(): boolean {
  return getAdminSecret() !== null;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash("sha256").update(a, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(b, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function verifyAdminPassword(candidate: string): boolean {
  const secret = getAdminSecret();
  if (!secret || !candidate) return false;
  return timingSafeEqualStrings(candidate, secret);
}

export function createAdminSessionToken(): string | null {
  const secret = getAdminSecret();
  if (!secret) return null;
  return crypto
    .createHmac("sha256", secret)
    .update(TOKEN_CONTEXT)
    .digest("hex");
}

export function isAdminCookieValid(cookieValue: string | undefined): boolean {
  const expected = createAdminSessionToken();
  if (!expected || !cookieValue) return false;
  return timingSafeEqualStrings(cookieValue, expected);
}

export function isAdminRequestAuthorized(request: NextRequest): boolean {
  if (!isAdminSecretConfigured()) return false;

  const cookieToken = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (isAdminCookieValid(cookieToken)) {
    return true;
  }

  const headerSecret = request.headers.get("x-admin-secret")?.trim();
  if (headerSecret && verifyAdminPassword(headerSecret)) {
    return true;
  }

  const authHeader = request.headers.get("authorization")?.trim();
  if (authHeader?.toLowerCase().startsWith("bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token && verifyAdminPassword(token)) {
      return true;
    }
  }

  return false;
}
