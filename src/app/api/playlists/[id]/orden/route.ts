import { proxyPlaylists } from "@/features/playlists/api/server-proxy";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return proxyPlaylists(`playlists/${encodeURIComponent((await params).id)}/orden`, request, "PUT");
}
