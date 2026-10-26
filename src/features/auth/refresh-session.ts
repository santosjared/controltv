import "server-only";
import { normalizeRefreshResponse, type AuthUser } from "./auth-config";

type Session = NonNullable<ReturnType<typeof normalizeRefreshResponse>>;
const pending = new Map<string, Promise<Session | null>>();

// La rotación del backend es de un solo uso. Las peticiones paralelas deben
// compartir su resultado mientras el navegador recibe las cookies renovadas.
export function refreshBackendSession(token: string, user: AuthUser, baseUrl: string): Promise<Session | null> {
  const key = baseUrl + ":" + token;
  const current = pending.get(key);
  if (current) return current;
  const work = (async () => {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/auth/refresh`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ refresh_token: token }), cache: "no-store", signal: AbortSignal.timeout(10000) });
    if (response.status === 401 || response.status === 403) return null;
    if (!response.ok) throw new Error("No se pudo renovar la sesión");
    return normalizeRefreshResponse(await response.json(), user);
  })();
  pending.set(key, work);
  const release = () => { const timer = setTimeout(() => { if (pending.get(key) === work) pending.delete(key); }, 3000); timer.unref?.(); };
  void work.then(release, () => { if (pending.get(key) === work) pending.delete(key); });
  return work;
}
