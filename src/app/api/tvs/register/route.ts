export async function POST(request: Request) {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) return Response.json({ message: "Falta API_BASE_URL en .env." }, { status: 500 });

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/tvs/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(await request.json()),
      signal: AbortSignal.timeout(10000),
    });
    const contentType = response.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json") ? await response.json() : { message: await response.text() };
    return Response.json(body, { status: response.status });
  } catch {
    return Response.json({ message: "No se pudo registrar el televisor." }, { status: 502 });
  }
}
