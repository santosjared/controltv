import type { PermissionKey } from "@/features/access-control/types";

export const SESSION_COOKIE = "tv_master_session";
export const ACCESS_TOKEN_COOKIE = "tv_master_access_token";
export const REFRESH_TOKEN_COOKIE = "tv_master_refresh_token";

export type AuthUser = { id: string; name: string; username: string; roleId: string; roleName: string; persistent?: boolean; permissions: PermissionKey[] };
type BackendPermission = { clave?: string };
type BackendLoginResponse = {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  usuario?: { id?: string; nombre_completo?: string; usuario?: string; estado?: string; rol?: { id?: string; nombre?: string; permisos?: BackendPermission[] } };
};

const backendPermissionAliases: Record<string, PermissionKey> = {
  "dashboard.view": "dashboard.view",
  "tvs.view": "televisions.view",
  "tvs.register": "televisions.register",
  "tvs.edit": "televisions.edit",
  "tvs.delete": "televisions.delete",
  "tvs.control": "televisions.control",
  "content.view": "content.view",
  "content.upload": "content.upload",
  "content.send": "content.broadcast",
  "content.delete": "content.delete",
  "playlists.view": "playlists.view",
  "playlists.manage": "playlists.manage",
  "users.manage": "users.manage",
  "roles.manage": "roles.manage",
  "reports.view": "reports.view",
};

export const routePermissions: Record<string, PermissionKey> = {
  "/": "dashboard.view", "/usuarios": "users.manage", "/roles": "roles.manage", "/televisores": "televisions.view", "/contenido": "content.view", "/listas": "playlists.view",
};

export function normalizeLoginResponse(payload: BackendLoginResponse): { accessToken: string; refreshToken: string; expiresIn: number; refreshExpiresIn: number; user: AuthUser } | null {
  const source = payload.usuario;
  const role = source?.rol;
  if (!payload.access_token || !payload.refresh_token || !source?.id || !source.nombre_completo || !source.usuario || !role?.id || !role.nombre || source.estado !== "ACTIVO") return null;
  const permissions = Array.from(new Set((role.permisos ?? []).flatMap(({ clave }) => clave && backendPermissionAliases[clave] ? [backendPermissionAliases[clave]] : [])));
  return { accessToken: payload.access_token, refreshToken: payload.refresh_token, expiresIn: typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in : 60 * 60 * 8, refreshExpiresIn: typeof payload.refresh_expires_in === "number" && payload.refresh_expires_in > 0 ? payload.refresh_expires_in : 60 * 60 * 24 * 30, user: { id: source.id, name: source.nombre_completo, username: source.usuario, roleId: role.id, roleName: role.nombre, permissions } };
}

export function normalizeRefreshResponse(payload: BackendLoginResponse, currentUser: AuthUser) {
  const completeSession = normalizeLoginResponse(payload);
  if (completeSession) return { ...completeSession, user: { ...completeSession.user, persistent: currentUser.persistent } };
  if (payload.usuario) return null;
  if (!payload.access_token || !payload.refresh_token) return null;
  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresIn: typeof payload.expires_in === "number" && payload.expires_in > 0 ? payload.expires_in : 60 * 60 * 8,
    refreshExpiresIn: typeof payload.refresh_expires_in === "number" && payload.refresh_expires_in > 0 ? payload.refresh_expires_in : 60 * 60 * 24 * 30,
    user: currentUser,
  };
}

export function encodeSessionUser(user: AuthUser) { return Buffer.from(JSON.stringify(user), "utf8").toString("base64url"); }
export function decodeSessionUser(value?: string): AuthUser | null {
  if (!value) return null;
  try { const user = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as AuthUser; return user?.id && Array.isArray(user.permissions) ? user : null; } catch { return null; }
}
export function hasValidAccessToken(token?: string) {
  if (!token) return false;
  try {
    const [, payload] = token.split(".");
    if (!payload) return false;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: number };
    return typeof claims.exp === "number" && claims.exp * 1000 > Date.now() + 30_000;
  } catch {
    return false;
  }
}
export function canAccessPath(user: AuthUser, pathname: string) {
  const route = Object.keys(routePermissions).filter((path) => path === "/" ? pathname === "/" : pathname.startsWith(path)).sort((a, b) => b.length - a.length)[0];
  return route ? user.permissions.includes(routePermissions[route]) : true;
}
