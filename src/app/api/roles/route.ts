import { proxyAccessControl } from "@/features/access-control/api/server-proxy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit")) || 10));
  return proxyAccessControl(`roles?page=${page}&limit=${limit}`);
}

export async function POST(request: Request) {
  return proxyAccessControl("roles", { method: "POST", body: await request.json() });
}
