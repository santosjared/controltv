import { proxyMedia } from "@/features/media-library/api/server-proxy";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return proxyMedia(`contenidos/${encodeURIComponent((await params).id)}/archivo`, request, "GET", true);
}
