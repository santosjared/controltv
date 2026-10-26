"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useDispatch } from "react-redux";
import { accessControlApi } from "@/features/access-control/api/access-control-api";
import { televisionsApi } from "@/features/control-tv/api/televisions-api";
import { mediaApi } from "@/features/media-library/api/media-api";
import { playlistsApi } from "@/features/playlists/api/playlists-api";
import { usePathname, useRouter } from "next/navigation";
import type { PermissionKey } from "@/features/access-control/types";
import type { AuthUser } from "./auth-config";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  can: (permission: PermissionKey) => boolean;
  acceptSession: (user: AuthUser) => void;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const dispatch = useDispatch();
  const clearCache = useCallback(() => { for (const api of [accessControlApi, televisionsApi, mediaApi, playlistsApi]) dispatch(api.util.resetApiState()); }, [dispatch]);
  const pathname = usePathname();
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(pathname !== "/login");
  const sessionCheckStarted = useRef(false);
  const refreshSession = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      if (!response.ok && response.status !== 401 && response.status !== 403) { setSessionError("No se pudo verificar la sesión. Revisa la conexión con el servidor."); return; }
      setSessionError(null);
      const payload = response.ok ? await response.json() as { user: AuthUser } : null;
      setUser(payload?.user ?? null);
    } catch {
      setSessionError("No se pudo conectar con el servidor para verificar la sesión.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (pathname === "/login" || sessionCheckStarted.current) return;
    sessionCheckStarted.current = true;
    void refreshSession();
  }, [pathname, refreshSession]);
  useEffect(() => {
    if (!loading && !sessionError && !user && pathname !== "/login") {
      const next = pathname ? `?next=${encodeURIComponent(pathname)}` : "";
      router.replace(`/login${next}`);
    }
  }, [loading, sessionError, pathname, router, user]);
  const authenticated = Boolean(user);
  useEffect(() => {
    if (!authenticated || pathname === "/login") return;
    const update = () => { void refreshSession(); };
    window.addEventListener("focus", update);
    const timer = setInterval(update, 60000);
    return () => { window.removeEventListener("focus", update); clearInterval(timer); };
  }, [authenticated, pathname, refreshSession]);
  const logout = useCallback(async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }); } finally {
    clearCache();
    setUser(null);
    router.replace("/login");
    router.refresh();
    }
  }, [router, clearCache]);
  const acceptSession = useCallback((authenticatedUser: AuthUser) => {
    clearCache();
    setSessionError(null);
    setUser(authenticatedUser);
    setLoading(false);
  }, [clearCache]);
  const value = useMemo<AuthContextValue>(() => ({ user, loading, can: (permission) => Boolean(user?.permissions.includes(permission)), acceptSession, refreshSession, logout }), [user, loading, acceptSession, refreshSession, logout]);
  const checkingProtectedRoute = pathname !== "/login" && (loading || !user);
  return <AuthContext.Provider value={value}>{checkingProtectedRoute ? <SessionCheck error={sessionError} onRetry={() => { void refreshSession(); }} /> : children}</AuthContext.Provider>;
}

function SessionCheck({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return <main className="grid min-h-screen place-items-center bg-[#f4f7f5] text-[#075f45]" role="status" aria-live="polite">
    <span className="flex flex-col items-center gap-3">
      <i className="size-9 animate-spin rounded-full border-3 border-[#b8d6c9] border-t-[#08783f]" />
      <strong className="text-sm">{error ?? "Verificando sesión…"}</strong>
      {error && <button type="button" onClick={onRetry} className="rounded-lg border px-4 py-2">Reintentar</button>}
    </span>
  </main>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}

export function PermissionGate({ permission, children }: { permission: PermissionKey; children: ReactNode }) {
  return useAuth().can(permission) ? children : null;
}
