import { NextResponse } from "next/server";
import { authCookiesSecure, ACCESS_TOKEN_COOKIE, encodeSessionUser, normalizeLoginResponse, REFRESH_TOKEN_COOKIE, SESSION_COOKIE } from "@/features/auth/auth-config";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { username?: string; password?: string; remember?: boolean } | null;
  if (!body?.username?.trim() || !body.password) return NextResponse.json({ message: "Ingrese su usuario y contraseña." }, { status: 400 });
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return NextResponse.json({ message: "Falta configurar API_BASE_URL." }, { status: 500 });
  try {
    const backendResponse = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/login`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ usuario: body.username.trim(), password: body.password }), cache: "no-store", signal: AbortSignal.timeout(10000) });
    const payload = await backendResponse.json().catch(() => null) as Parameters<typeof normalizeLoginResponse>[0] | { message?: string } | null;
    if (!backendResponse.ok) return NextResponse.json({ message: payload && "message" in payload ? payload.message : "Usuario o contraseña incorrectos." }, { status: backendResponse.status });
    const session = normalizeLoginResponse(payload as Parameters<typeof normalizeLoginResponse>[0]);
    if (!session) return NextResponse.json({ message: "La respuesta de autenticación no contiene un usuario activo, rol o token válido." }, { status: 502 });
    session.user.persistent = body.remember === true;
    const options = { httpOnly: true, sameSite: "lax" as const, secure: authCookiesSecure(), path: "/" };
    const response = NextResponse.json({ user: session.user });
    response.cookies.set(ACCESS_TOKEN_COOKIE, session.accessToken, { ...options, maxAge: session.expiresIn });
    response.cookies.set(REFRESH_TOKEN_COOKIE, session.refreshToken, { ...options, ...(body.remember ? { maxAge: session.refreshExpiresIn } : {}) });
    response.cookies.set(SESSION_COOKIE, encodeSessionUser(session.user), { ...options, ...(body.remember ? { maxAge: session.refreshExpiresIn } : {}) });
    return response;
  } catch { return NextResponse.json({ message: "No se pudo conectar con el servicio de autenticación." }, { status: 502 }); }
}
