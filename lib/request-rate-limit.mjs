function clientAddress(request) {
  return request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}

async function digest(value) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceRequestLimit(db, request, { scope, limit, windowSeconds }) {
  if (!db) return null;
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const expiresAt = now - (now % windowMs) + windowMs;
  const key = await digest(`${scope}:${clientAddress(request)}:${expiresAt}`);

  try {
    const row = await db.prepare(
      "INSERT INTO request_limits (key, count, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count",
    ).bind(key, expiresAt).first();
    if (row?.count === 1) {
      await db.prepare("DELETE FROM request_limits WHERE expires_at <= ?").bind(now).run();
    }
    return Number(row?.count ?? 1) > limit ? Math.max(1, Math.ceil((expiresAt - now) / 1000)) : null;
  } catch {
    // Availability wins if the limiter table is temporarily unavailable.
    return null;
  }
}

export function rateLimitResponse(retryAfter, message) {
  return Response.json(
    { error: message },
    { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(retryAfter) } },
  );
}
