export const runtime = "nodejs";

export function GET() {
  return Response.json({
    service: "photo-website",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
