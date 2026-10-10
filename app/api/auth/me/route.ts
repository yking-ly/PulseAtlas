import { getAppUser } from "@/lib/app-auth";

export async function GET(request: Request) {
  return Response.json(
    { user: await getAppUser(request) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
