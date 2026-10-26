import { refreshBackendSession } from "@/features/auth/refresh-session";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, decodeSessionUser, encodeSessionUser, hasValidAccessToken, normalizeLoginResponse, REFRESH_TOKEN_COOKIE, SESSION_COOKIE } from "@/features/auth/auth-config";

export const runtime = "nodejs";

function clearSession(response: NextResponse) {
  const options = { httpOnly: true, path: "/", maxAge: 0 };
  response.cookies.set(ACCESS_TOKEN_COOKIE, "", options);
  response.cookies.set(REFRESH_TOKEN_COOKIE, "", options);
  response.cookies.set(SESSION_COOKIE, "", options);
  return response;
}

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  const storedUser = decodeSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  if (!storedUser) return clearSession(NextResponse.json({ message: "Sesión no válida." }, { status: 401 }));
  if (hasValidAccessToken(accessToken)) {
    const base = process.env.API_BASE_URL;
    if (!base) return NextResponse.json({ message: "Falta configurar API_BASE_URL." }, { status: 503 });
    try {
      const result = await fetch(`${base.replace(/\/$/, "")}/auth/me`, { headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(10000) });
      if (!result.ok) return result.status === 401 || result.status === 403 ? clearSession(NextResponse.json({ message: "La sesión dejó de ser válida." }, { status: 401 })) : NextResponse.json({ message: "No se pudo validar la sesión." }, { status: 503 });
      const claims = await result.json();
      const session = normalizeLoginResponse({ access_token: accessToken, refresh_token: refreshToken ?? "session", usuario: claims.perfil === undefined ? { id: claims.sub, nombre_completo: storedUser.name, usuario: claims.usuario, estado: "ACTIVO", rol: { id: storedUser.roleId, nombre: claims.roles?.[0] ?? storedUser.roleName, permisos: (claims.permissions ?? []).map((clave: string) => ({ clave })) } } : claims.perfil });
      if (!session) return clearSession(NextResponse.json({ message: "El usuario no tiene un rol activo." }, { status: 401 }));
      session.user.persistent = storedUser.persistent;
      const response = NextResponse.json({ user: session.user }, { headers: { "Cache-Control": "no-store" } });
      response.cookies.set(SESSION_COOKIE, encodeSessionUser(session.user), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", ...(storedUser.persistent ? { maxAge: 60 * 60 * 24 * 30 } : {}) });
      return response;
    } catch { return NextResponse.json({ message: "No se pudo validar la sesión." }, { status: 503 }); }
  }
  if (!refreshToken) return clearSession(NextResponse.json({ message: "La sesión expiró. Ingrese nuevamente." }, { status: 401 }));

  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return clearSession(NextResponse.json({ message: "Falta configurar API_BASE_URL." }, { status: 503 }));
  try {
    const session = await refreshBackendSession(refreshToken, storedUser, baseUrl);
    if (!session) return clearSession(NextResponse.json({ message: "No se pudo renovar la sesión." }, { status: 401 }));

    const options = { httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" };
    const response = NextResponse.json({ user: session.user });
    response.cookies.set(ACCESS_TOKEN_COOKIE, session.accessToken, { ...options, maxAge: session.expiresIn });
    response.cookies.set(REFRESH_TOKEN_COOKIE, session.refreshToken, { ...options, ...(session.user.persistent ? { maxAge: session.refreshExpiresIn } : {}) });
    response.cookies.set(SESSION_COOKIE, encodeSessionUser(session.user), { ...options, maxAge: session.refreshExpiresIn });
    return response;
  } catch {
    return NextResponse.json({ message: "No se pudo validar la sesión con el backend." }, { status: 503 });
  }
}
