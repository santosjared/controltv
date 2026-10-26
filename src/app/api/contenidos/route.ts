import { proxyMedia } from "@/features/media-library/api/server-proxy";

export function GET(request: Request) {
  const incoming = new URL(request.url).searchParams;
  const params = new URLSearchParams({ page: String(Math.max(1, Number(incoming.get("page")) || 1)), limit: String(Math.max(1, Math.min(100, Number(incoming.get("limit")) || 4))) });
  const search = incoming.get("search")?.trim();
  if (search) params.set("search", search);
  const type = incoming.get("type");
  if (type === "VIDEO" || type === "IMAGEN") params.set("type", type);
  return proxyMedia(`contenidos?${params}`, request);
}
