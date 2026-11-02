import { proxyMedia } from "@/features/media-library/api/server-proxy";
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return proxyMedia(`tvs/${encodeURIComponent((await params).id)}/transferencias`, request, "POST");
}
