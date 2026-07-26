import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "@notionworker/db";
import type { Env } from "../types.js";
import {
  getAuthorizationUrl,
  exchangeCodeForToken,
} from "../lib/notion.js";
import {
  createSession,
  deleteSession,
  getSessionCookie,
  clearSessionCookie,
  parseSessionCookie,
  validateSession,
} from "../lib/session.js";

const auth = new Hono<{ Bindings: Env }>();

const STATE_COOKIE = "nw_oauth_state";

function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function dashboardUrl(env: Env): string {
  return env.DASHBOARD_URL || "/";
}

/** GET /auth/notion — redirect to Notion OAuth */
auth.get("/notion", (c) => {
  const state = generateId();
  const url = getAuthorizationUrl(
    c.env.NOTION_CLIENT_ID,
    c.env.NOTION_REDIRECT_URI,
    state,
  );
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Set-Cookie": `${STATE_COOKIE}=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
    },
  });
});

/** GET /auth/callback — handle Notion OAuth callback */
auth.get("/callback", async (c) => {
  if (c.req.query("error")) {
    // User denied access (or Notion returned an error) — back to dashboard
    return c.redirect(dashboardUrl(c.env));
  }

  const code = c.req.query("code");
  if (!code) {
    return c.json({ error: "Missing authorization code" }, 400);
  }

  // Verify OAuth state against the cookie set in /auth/notion (CSRF protection)
  const state = c.req.query("state");
  const cookieHeader = c.req.header("Cookie") ?? "";
  const stateMatch = cookieHeader.match(new RegExp(`${STATE_COOKIE}=([a-f0-9]+)`));
  if (!state || !stateMatch || stateMatch[1] !== state) {
    return c.json({ error: "Invalid OAuth state" }, 400);
  }

  // Exchange code for token
  let token;
  try {
    token = await exchangeCodeForToken(
      code,
      c.env.NOTION_CLIENT_ID,
      c.env.NOTION_CLIENT_SECRET,
      c.env.NOTION_REDIRECT_URI,
    );
  } catch (err) {
    console.error(`[auth] Token exchange failed: ${err}`);
    return c.json({ error: "OAuth token exchange failed" }, 502);
  }

  const notionUser = token.owner.user;
  if (!notionUser) {
    return c.json({ error: "OAuth response missing user info" }, 400);
  }

  const d1 = drizzle(c.env.DB);
  const now = new Date();

  // Upsert user
  const existing = await d1
    .select()
    .from(users)
    .where(eq(users.notionUserId, notionUser.id))
    .limit(1);

  let userId: string;

  if (existing.length > 0) {
    userId = existing[0].id;
    await d1
      .update(users)
      .set({
        accessToken: token.access_token,
        notionWorkspaceId: token.workspace_id,
        name: notionUser.name,
        email: notionUser.person?.email ?? existing[0].email,
        avatarUrl: notionUser.avatar_url,
        updatedAt: now,
      })
      .where(eq(users.id, userId));
  } else {
    userId = generateId();
    await d1.insert(users).values({
      id: userId,
      notionUserId: notionUser.id,
      notionWorkspaceId: token.workspace_id,
      accessToken: token.access_token,
      name: notionUser.name,
      email: notionUser.person?.email ?? null,
      avatarUrl: notionUser.avatar_url,
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create session
  const sessionId = await createSession(c.env.DB, userId);

  // Redirect to dashboard with session cookie; clear the state cookie
  const headers = new Headers({ Location: dashboardUrl(c.env) });
  headers.append("Set-Cookie", getSessionCookie(sessionId, c.env.COOKIE_DOMAIN));
  headers.append("Set-Cookie", `${STATE_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 302, headers });
});

/** POST /auth/logout */
auth.post("/logout", async (c) => {
  const cookieHeader = c.req.header("Cookie");
  const sessionId = parseSessionCookie(cookieHeader ?? null);

  if (sessionId) {
    await deleteSession(c.env.DB, sessionId);
  }

  return new Response(null, {
    status: 302,
    headers: {
      Location: dashboardUrl(c.env),
      "Set-Cookie": clearSessionCookie(c.env.COOKIE_DOMAIN),
    },
  });
});

/** GET /auth/me — get current user info */
auth.get("/me", async (c) => {
  const cookieHeader = c.req.header("Cookie");
  const sessionId = parseSessionCookie(cookieHeader ?? null);

  if (!sessionId) {
    return c.json({ user: null });
  }

  const user = await validateSession(c.env.DB, sessionId);
  return c.json({ user });
});

export default auth;
