import { proxyPlaylists } from "@/features/playlists/api/server-proxy";

export function GET(request: Request) {
  const incoming = new URL(request.url).searchParams;
  const params = new URLSearchParams({ page: String(Math.max(1, Number(incoming.get("page")) || 1)), limit: String(Math.max(1, Math.min(100, Number(incoming.get("limit")) || 10))) });
  const search = incoming.get("search")?.trim();
  if (search) params.set("search", search);
  return proxyPlaylists(`playlists?${params}`, request);
}

export function POST(request: Request) { return proxyPlaylists("playlists", request, "POST"); }
