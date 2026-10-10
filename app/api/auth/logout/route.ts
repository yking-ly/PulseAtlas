import { deleteSession, sameOrigin } from "@/lib/app-auth";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  return Response.json({ signedOut: true }, { headers: { "Set-Cookie": await deleteSession(request) } });
}
