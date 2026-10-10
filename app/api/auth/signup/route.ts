import { env } from "cloudflare:workers";
import { createSession, sameOrigin } from "@/lib/app-auth";
import { hashPassword, normalizeEmail, validPassword } from "@/lib/password-auth.mjs";
import { enforceRequestLimit, rateLimitResponse } from "@/lib/request-rate-limit.mjs";

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
  if (!env.DB) return Response.json({ error: "Account storage is unavailable in this preview." }, { status: 503 });
  const retryAfter = await enforceRequestLimit(env.DB, request, { scope: "signup", limit: 5, windowSeconds: 60 * 60 });
  if (retryAfter) return rateLimitResponse(retryAfter, "Too many account-creation attempts. Try again later.");

  let input: { email?: unknown; password?: unknown };
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "Enter an email and password." }, { status: 400 });
  }
  const email = normalizeEmail(input.email);
  if (!email) return Response.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!validPassword(input.password)) return Response.json({ error: "Password must be 8–128 characters." }, { status: 400 });

  const id = crypto.randomUUID();
  try {
    await env.DB.prepare("INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)")
      .bind(id, email, await hashPassword(input.password as string))
      .run();
  } catch {
    return Response.json({ error: "An account already exists for this email." }, { status: 409 });
  }

  return Response.json(
    { user: { id, email } },
    { status: 201, headers: { "Set-Cookie": await createSession(id, request) } },
  );
}
