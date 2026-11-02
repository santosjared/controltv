import { refreshBackendSession } from "./refresh-session";
import "server-only";
import { cookies } from "next/headers";
import { authCookiesSecure, ACCESS_TOKEN_COOKIE, decodeSessionUser, encodeSessionUser, hasValidAccessToken, REFRESH_TOKEN_COOKIE, SESSION_COOKIE } from "./auth-config";

async function resolveAccessToken() {
  const cookieStore = await cookies();
  const currentToken = cookieStore.get(ACCESS_TOKEN_COOKIE)?.value;
  if (hasValidAccessToken(currentToken)) return currentToken;
  const refreshToken = cookieStore.get(REFRESH_TOKEN_COOKIE)?.value;
  const user = decodeSessionUser(cookieStore.get(SESSION_COOKIE)?.value);
  const baseUrl = process.env.API_BASE_URL;
  if (!refreshToken || !user || !baseUrl) return null;
  try {
    const session = await refreshBackendSession(refreshToken, user, baseUrl);
    if (!session) return null;
    const options = { httpOnly: true, sameSite: "lax" as const, secure: authCookiesSecure(), path: "/" };
    cookieStore.set(ACCESS_TOKEN_COOKIE, session.accessToken, { ...options, maxAge: session.expiresIn });
    cookieStore.set(REFRESH_TOKEN_COOKIE, session.refreshToken, { ...options, ...(user.persistent ? { maxAge: session.refreshExpiresIn } : {}) });
    cookieStore.set(SESSION_COOKIE, encodeSessionUser(session.user), { ...options, ...(user.persistent ? { maxAge: session.refreshExpiresIn } : {}) });
    return session.accessToken;
  } catch { return null; }
}

export async function backendAuthHeaders(extra: Record<string, string> = {}) {
  const token = await resolveAccessToken();
  return { ...extra, ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}
