import { proxyAccessControl } from "@/features/access-control/api/server-proxy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 10));
  const search = searchParams.get("search")?.trim() ?? "";
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (search) params.set("search", search);
  return proxyAccessControl(`usuarios?${params.toString()}`);
}

export async function POST(request: Request) {
  return proxyAccessControl("usuarios", { method: "POST", body: await request.json() });
}
