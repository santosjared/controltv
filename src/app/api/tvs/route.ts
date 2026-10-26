import { backendAuthHeaders } from "@/features/auth/server-auth";

export async function GET(request: Request) {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    return Response.json({ message: "Falta API_BASE_URL en .env." }, { status: 500 });
  }

  try {
    const params = new URLSearchParams();
    const incoming = new URL(request.url).searchParams;
    for (const key of ["page", "limit", "search"]) {
      const value = incoming.get(key);
      if (value) params.set(key, value);
    }
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/tvs${params.size ? `?${params}` : ""}`, {
      cache: "no-store",
      headers: await backendAuthHeaders({ Accept: "application/json" }),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    return new Response(text || null, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json", "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "No se pudo consultar el backend de televisores." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return Response.json({ message: "Falta API_BASE_URL en .env." }, { status: 500 });
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/tvs`, {
      method: "POST",
      headers: await backendAuthHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      body: JSON.stringify(await request.json()),
      signal: AbortSignal.timeout(10000),
    });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ message: "No se pudo registrar el televisor." }, { status: 502 });
  }
}
