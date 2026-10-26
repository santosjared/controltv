import { proxyAccessControl } from "@/features/access-control/api/server-proxy";

export async function GET() {
  return proxyAccessControl("permisos");
}
