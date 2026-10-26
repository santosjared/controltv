import "server-only";
import { backendAuthHeaders } from "@/features/auth/server-auth";

export async function proxyMedia(path: string, request: Request, method = "GET", file = false) {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return Response.json({ message: "Falta API_BASE_URL en .env." }, { status: 500 });
  try {
    const headers = new Headers(await backendAuthHeaders({ Accept: file ? "*/*" : "application/json" }));
    const contentType = request.headers.get("content-type");
    if (contentType && ["POST", "PATCH"].includes(method)) headers.set("Content-Type", contentType);
    if (file) for (const key of ["range", "if-range"]) { const value = request.headers.get(key); if (value) headers.set(key, value); }
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${path}`, {
      method, headers, cache: "no-store", signal: AbortSignal.timeout(120000),
      ...(["POST", "PATCH"].includes(method) ? { body: await request.arrayBuffer() } : {}),
    });
    const outgoing = new Headers({ "Cache-Control": "no-store" });
    for (const key of ["content-type", "content-disposition", "content-range", "accept-ranges"]) {
      const value = response.headers.get(key); if (value) outgoing.set(key, value);
    }
    return new Response(response.body, { status: response.status, headers: outgoing });
  } catch { return Response.json({ message: "No se pudo comunicar con el backend de contenido." }, { status: 502 }); }
}
