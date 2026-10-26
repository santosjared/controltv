import "server-only";
import { backendAuthHeaders } from "@/features/auth/server-auth";

export async function proxyPlaylists(path: string, request: Request, method = "GET") {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return Response.json({ message: "Falta API_BASE_URL en .env." }, { status: 500 });
  try {
    const hasBody = ["POST", "PATCH", "PUT"].includes(method);
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${path}`, {
      method, cache: "no-store", headers: await backendAuthHeaders({ Accept: "application/json", ...(hasBody ? { "Content-Type": "application/json" } : {}) }),
      ...(hasBody ? { body: await request.text() || undefined } : {}), signal: AbortSignal.timeout(10000),
    });
    return new Response(response.body, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch { return Response.json({ message: "No se pudo comunicar con el backend de playlists." }, { status: 502 }); }
}
