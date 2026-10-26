import { proxyPlaylists } from "@/features/playlists/api/server-proxy";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) { return proxyPlaylists(`playlists/${encodeURIComponent((await params).id)}`, request); }
export async function PUT(request: Request, { params }: Context) { return proxyPlaylists(`playlists/${encodeURIComponent((await params).id)}`, request, "PUT"); }
export async function DELETE(request: Request, { params }: Context) { return proxyPlaylists(`playlists/${encodeURIComponent((await params).id)}`, request, "DELETE"); }
