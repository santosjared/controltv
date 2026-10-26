import { proxyMedia } from "@/features/media-library/api/server-proxy";

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, { params }: Context) { return proxyMedia(`contenidos/${encodeURIComponent((await params).id)}`, request); }
export async function PATCH(request: Request, { params }: Context) { return proxyMedia(`contenidos/${encodeURIComponent((await params).id)}`, request, "PATCH"); }
export async function DELETE(request: Request, { params }: Context) { return proxyMedia(`contenidos/${encodeURIComponent((await params).id)}`, request, "DELETE"); }
