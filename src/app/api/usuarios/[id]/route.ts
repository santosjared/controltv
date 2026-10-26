import { proxyAccessControl } from "@/features/access-control/api/server-proxy";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, { params }: Context) {
  const { id } = await params;
  return proxyAccessControl(`usuarios/${encodeURIComponent(id)}`, { method: "PUT", body: await request.json() });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { id } = await params;
  return proxyAccessControl(`usuarios/${encodeURIComponent(id)}`, { method: "DELETE" });
}
