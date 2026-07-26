import { createMiddleware } from "hono/factory";
import type { Env } from "../types.js";
import { validateSession, parseSessionCookie } from "../lib/session.js";

type Variables = {
  userId: string;
  userName: string | null;
};

/**
 * Auth middleware: validates session cookie and sets userId on context.
 * Returns 401 if no valid session.
 */
export const requireAuth = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const cookieHeader = c.req.header("Cookie");
  const sessionId = parseSessionCookie(cookieHeader ?? null);

  if (!sessionId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await validateSession(c.env.DB, sessionId);
  if (!user) {
    return c.json({ error: "Session expired" }, 401);
  }

  c.set("userId", user.userId);
  c.set("userName", user.name);
  await next();
});
