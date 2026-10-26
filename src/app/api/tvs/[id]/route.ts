import { backendAuthHeaders } from "@/features/auth/server-auth";

type RouteContext = { params: Promise<{ id: string }> };

async function forward(request: Request, context: RouteContext, method: "PUT" | "DELETE") {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return Response.json({ message: "Falta API_BASE_URL en .env." }, { status: 500 });

  const { id } = await context.params;
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/tvs/${encodeURIComponent(id)}`, {
      method,
      headers: await backendAuthHeaders({ "Content-Type": "application/json", Accept: "application/json" }),
      ...(method === "PUT" ? { body: JSON.stringify(await request.json()) } : {}),
      signal: AbortSignal.timeout(10000),
    });
    const text = await response.text();
    return text
      ? new Response(text, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } })
      : new Response(null, { status: response.status });
  } catch {
    return Response.json({ message: "No se pudo comunicar con el backend de televisores." }, { status: 502 });
  }
}

export function PUT(request: Request, context: RouteContext) {
  return forward(request, context, "PUT");
}

export function DELETE(request: Request, context: RouteContext) {
  return forward(request, context, "DELETE");
}
