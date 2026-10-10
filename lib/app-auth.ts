import { env } from "cloudflare:workers";
import { createSessionToken, hashSessionToken, readCookie } from "@/lib/password-auth.mjs";

export const SESSION_COOKIE = "pulse_session";
const SESSION_SECONDS = 60 * 60 * 24 * 30;

export type AppUser = { id: string; email: string };

function cookieValue(token: string, secure: boolean, maxAge = SESSION_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export async function getAppUser(request: Request): Promise<AppUser | null> {
  if (!env.DB) return null;
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (!token) return null;
  return env.DB.prepare(
    "SELECT users.id, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ? LIMIT 1",
  ).bind(await hashSessionToken(token), Date.now()).first<AppUser>();
}

export async function createSession(userId: string, request: Request) {
  if (!env.DB) throw new Error("Account storage is unavailable.");
  const token = createSessionToken();
  await env.DB.prepare(
    "INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)",
  ).bind(await hashSessionToken(token), userId, Date.now() + SESSION_SECONDS * 1000).run();
  return cookieValue(token, new URL(request.url).protocol === "https:");
}

export async function deleteSession(request: Request) {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  if (env.DB && token) {
    await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
      .bind(await hashSessionToken(token))
      .run();
  }
  return cookieValue("", new URL(request.url).protocol === "https:", 0);
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
