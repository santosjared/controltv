import { proxyAccessControl } from "@/features/access-control/api/server-proxy";
export function GET() { return proxyAccessControl("roles/opciones"); }
