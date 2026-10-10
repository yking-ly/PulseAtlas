import { env } from "cloudflare:workers";
import { getAppUser, sameOrigin } from "@/lib/app-auth";
import type { NewsEvent } from "@/lib/news-data";

export async function GET(request: Request) {
  if (!env.DB) return Response.json({ bookmarks: [], persistent: false });
  const user = await getAppUser(request);
  if (!user) return Response.json({ error: "Sign in to view saved stories." }, { status: 401 });
  const result = await env.DB.prepare(
    "SELECT event_id, snapshot, created_at FROM bookmarks WHERE user_id = ? ORDER BY created_at DESC LIMIT 100",
  ).bind(user.id).all<{ event_id: string; snapshot: string; created_at: string }>();

  return Response.json(
    {
      persistent: true,
      bookmarks: result.results.map((row) => ({
        eventId: row.event_id,
        event: JSON.parse(row.snapshot) as NewsEvent,
        createdAt: row.created_at,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "Persistent bookmarks are unavailable in this preview." }, { status: 503 });
  const user = await getAppUser(request);
  if (!user) return Response.json({ error: "Sign in to save stories." }, { status: 401 });
  let event: NewsEvent;
  try {
    event = await request.json() as NewsEvent;
  } catch {
    return Response.json({ error: "A complete event snapshot is required." }, { status: 400 });
  }
  let source: URL;
  try {
    source = new URL(event.url);
  } catch {
    return Response.json({ error: "A complete event snapshot is required." }, { status: 400 });
  }
  const snapshot = JSON.stringify(event);
  if (
    typeof event.id !== "string" || event.id.length > 200
    || typeof event.title !== "string" || !event.title.trim() || event.title.length > 500
    || !["http:", "https:"].includes(source.protocol)
    || snapshot.length > 100_000
  ) {
    return Response.json({ error: "A complete event snapshot is required." }, { status: 400 });
  }
  await env.DB.prepare(
    "INSERT INTO bookmarks (user_id, event_id, snapshot) VALUES (?, ?, ?) ON CONFLICT(user_id, event_id) DO UPDATE SET snapshot = excluded.snapshot",
  ).bind(user.id, event.id, snapshot).run();
  return Response.json({ saved: true, eventId: event.id }, { status: 201 });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "Persistent bookmarks are unavailable in this preview." }, { status: 503 });
  const user = await getAppUser(request);
  if (!user) return Response.json({ error: "Sign in to manage saved stories." }, { status: 401 });
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) return Response.json({ error: "eventId is required." }, { status: 400 });
  await env.DB.prepare("DELETE FROM bookmarks WHERE user_id = ? AND event_id = ?")
    .bind(user.id, eventId)
    .run();
  return Response.json({ deleted: true, eventId });
}
