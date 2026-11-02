import { proxyMedia } from "@/features/media-library/api/server-proxy";
export function POST(request: Request) { return proxyMedia("tvs/transferencias", request, "POST"); }
