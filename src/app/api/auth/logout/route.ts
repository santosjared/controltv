import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, SESSION_COOKIE } from "@/features/auth/auth-config";

export async function POST() {
  const refresh = (await cookies()).get(REFRESH_TOKEN_COOKIE)?.value;
  const base = process.env.API_BASE_URL;
  if (refresh && base) {
    try { await fetch(`${base.replace(/\/$/, "")}/auth/logout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: refresh }), cache: "no-store", signal: AbortSignal.timeout(5000) }); } catch { /* Las cookies se eliminan también si el backend no está disponible. */ }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
