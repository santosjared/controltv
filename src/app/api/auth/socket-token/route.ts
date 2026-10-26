import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { GET as validateSession } from "../session/route";
import { ACCESS_TOKEN_COOKIE, type AuthUser } from "@/features/auth/auth-config";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ message: "Origen no permitido." }, { status: 403 });
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
