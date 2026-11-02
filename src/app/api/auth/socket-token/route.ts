import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GET as validateSession } from "../session/route";
import { ACCESS_TOKEN_COOKIE, type AuthUser } from "@/features/auth/auth-config";

function firstHeaderValue(value: string | null): string | null {
  return value?.split(",", 1)[0]?.trim() || null;
}

function normalizedOrigin(value: string | undefined | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/**
 * Render termina TLS delante de Next. En ese caso request.url puede contener
 * el host interno, mientras que x-forwarded-* conserva el host público.
 */
export function requestAllowedOrigins(request: Request): Set<string> {
  const origins = new Set<string>();
  const requestOrigin = normalizedOrigin(request.url);
  if (requestOrigin) origins.add(requestOrigin);

  const host = firstHeaderValue(request.headers.get("x-forwarded-host"));
  const protocol = firstHeaderValue(request.headers.get("x-forwarded-proto"))?.toLowerCase();
  if (host && protocol && (protocol === "http" || protocol === "https")) {
    const forwardedOrigin = normalizedOrigin(`${protocol}://${host}`);
    if (forwardedOrigin) origins.add(forwardedOrigin);
  }

  const environment: Record<string, string | undefined> =
    typeof process === "undefined" ? {} : process.env;
  for (const configuredOrigin of [environment.APP_URL, environment.NEXT_PUBLIC_APP_URL]) {
    const origin = normalizedOrigin(configuredOrigin);
    if (origin) origins.add(origin);
  }
  return origins;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (
    (origin && !requestAllowedOrigins(request).has(origin)) ||
    request.headers.get("sec-fetch-site") === "cross-site"
  ) return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
  const session = await validateSession();
  session.headers.set("Cache-Control", "no-store");
  if (!session.ok) return session;
  const payload = await session.json() as { user: AuthUser };
  if (!payload.user.permissions.includes("televisions.control") && !payload.user.permissions.includes("televisions.view")) return NextResponse.json({ message: "Necesitas permiso para ver o controlar televisores." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const token = session.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? (await cookies()).get(ACCESS_TOKEN_COOKIE)?.value;
  if (!token) return NextResponse.json({ message: "La sesión expiró." }, { status: 401 });
  let expiresAt: number | null = null;
  try { expiresAt = Number(JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")).exp) * 1000 || null; } catch { /* El token puede ser opaco. */ }
  const response = NextResponse.json({ token, expiresAt }, { headers: { "Cache-Control": "no-store" } });
  for (const cookie of session.cookies.getAll()) response.cookies.set(cookie);
  return response;
}
