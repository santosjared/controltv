import { proxyPlaylists } from "@/features/playlists/api/server-proxy";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; itemId: string }> }) {
  const { id, itemId } = await params;
  return proxyPlaylists(`playlists/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`, request, "DELETE");
}
