export async function GET() {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) {
    return Response.json({ message: "Falta API_BASE_URL en .env." }, { status: 500 });
  }

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/tvs`, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return Response.json({ message: `El backend respondió HTTP ${response.status}.` }, { status: response.status });
    }
    return Response.json(await response.json(), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ message: "No se pudo consultar el backend de televisores." }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return Response.json({ message: "Falta API_BASE_URL en .env." }, { status: 500 });
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/tvs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(await request.json()),
      signal: AbortSignal.timeout(10000),
    });
    return Response.json(await response.json(), { status: response.status });
  } catch {
    return Response.json({ message: "No se pudo registrar el televisor." }, { status: 502 });
  }
}
