import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { sessions, users } from "@notionworker/db";
import type { SessionUser } from "../types.js";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function generateId(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSession(
  db: D1Database,
  userId: string,
): Promise<string> {
  const d1 = drizzle(db);
  const sessionId = generateId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await d1.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt,
    createdAt: now,
  });

  return sessionId;
}

export async function validateSession(
  db: D1Database,
  sessionId: string,
): Promise<SessionUser | null> {
  const d1 = drizzle(db);
  const now = new Date();

  const [row] = await d1
    .select({
      userId: users.id,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return null;

  if (row.expiresAt < now) {
    // Expired — delete it
    await d1.delete(sessions).where(eq(sessions.id, sessionId));
    return null;
  }

  const { expiresAt, ...user } = row;
  return user;
}

export async function deleteSession(
  db: D1Database,
  sessionId: string,
): Promise<void> {
  const d1 = drizzle(db);
  await d1.delete(sessions).where(eq(sessions.id, sessionId));
}

export function getSessionCookie(sessionId: string, domain?: string): string {
  const domainAttr = domain ? `; Domain=${domain}` : "";
  return `nw_session=${sessionId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${domainAttr}`;
}

export function clearSessionCookie(domain?: string): string {
  const domainAttr = domain ? `; Domain=${domain}` : "";
  return `nw_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0${domainAttr}`;
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/nw_session=([a-f0-9]+)/);
  return match ? match[1] : null;
}
