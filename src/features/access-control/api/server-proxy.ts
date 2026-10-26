import "server-only";
import { backendAuthHeaders } from "@/features/auth/server-auth";

type ProxyOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
};

export async function proxyAccessControl(path: string, options: ProxyOptions = {}) {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return Response.json({ message: "Falta API_BASE_URL en .env." }, { status: 500 });

  try {
    const hasBody = options.body !== undefined;
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`, {
      method: options.method ?? "GET",
      cache: "no-store",
      headers: await backendAuthHeaders({
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
      }),
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(10000),
    });

    if (response.status === 204) return new Response(null, { status: 204 });
    const text = await response.text();
    return new Response(text || JSON.stringify({ ok: response.ok }), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return Response.json({ message: "No se pudo comunicar con el backend de roles y permisos." }, { status: 502 });
  }
}
