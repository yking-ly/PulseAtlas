import { env } from "cloudflare:workers";
import { createSession, sameOrigin } from "@/lib/app-auth";
import { normalizeEmail, verifyPassword } from "@/lib/password-auth.mjs";
import { enforceRequestLimit, rateLimitResponse } from "@/lib/request-rate-limit.mjs";

type StoredUser = {
  id: string;
  email: string;
  password_hash: string;
  failed_attempts: number;
  locked_until: number | null;
};

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "Account storage is unavailable in this preview." }, { status: 503 });
  const retryAfter = await enforceRequestLimit(env.DB, request, { scope: "login", limit: 20, windowSeconds: 15 * 60 });
  if (retryAfter) return rateLimitResponse(retryAfter, "Too many sign-in attempts. Try again later.");

  let input: { email?: unknown; password?: unknown };
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Enter an email and password." }, { status: 400 });
  }
  const email = normalizeEmail(input.email);
  const password = typeof input.password === "string" ? input.password : "";
  if (!email || !password) return Response.json({ error: "Email or password is incorrect." }, { status: 401 });

  const user = await env.DB.prepare(
    "SELECT id, email, password_hash, failed_attempts, locked_until FROM users WHERE email = ? LIMIT 1",
  ).bind(email).first<StoredUser>();
  const now = Date.now();
  if (user?.locked_until && user.locked_until > now) {
    return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
  }
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    if (user) {
      const attempts = user.failed_attempts + 1;
      await env.DB.prepare("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?")
        .bind(attempts, attempts >= 5 ? now + 15 * 60 * 1000 : null, user.id)
        .run();
    }
    return Response.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  await env.DB.prepare("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = ?")
    .bind(user.id)
    .run();
  return Response.json(
    { user: { id: user.id, email: user.email } },
    { headers: { "Set-Cookie": await createSession(user.id, request) } },
  );
}
