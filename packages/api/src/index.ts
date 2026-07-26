import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./types.js";
import auth from "./routes/auth.js";
import sitesRouter from "./routes/sites.js";
import pagesRouter from "./routes/pages.js";
import themesRouter from "./routes/themes.js";
import domainsRouter from "./routes/domains.js";
import publishRouter from "./routes/publish.js";
import webhooksRouter from "./routes/webhooks.js";
import { searchPages } from "./lib/notion.js";
import { requireAuth } from "./middleware/auth.js";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { users } from "@notionworker/db";

type Variables = { userId: string; userName: string | null };

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// CORS: credentialed requests are only allowed from the dashboard origin
app.use(
  "/api/*",
  cors({
    origin: (origin, c) => {
      const dashboard = c.env.DASHBOARD_URL;
      if (!dashboard) return null;
      return origin === new URL(dashboard).origin ? origin : null;
    },
    credentials: true,
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

// Health check
app.get("/api/health", (c) => c.json({ ok: true }));

// Auth routes
app.route("/auth", auth);

// Notion page discovery (authenticated)
app.get("/api/notion/pages", requireAuth, async (c) => {
  const userId = c.get("userId");
  const d1 = drizzle(c.env.DB);

  const [user] = await d1
    .select({ accessToken: users.accessToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  const query = c.req.query("q") ?? "";
  const pages = await searchPages(user.accessToken, query);
  return c.json({ pages });
});

// CRUD routes (all scoped under /api/sites)
app.route("/api/sites", sitesRouter);
app.route("/api/sites/:siteId/pages", pagesRouter);
app.route("/api/sites/:siteId/theme", themesRouter);
app.route("/api/sites/:siteId/domains", domainsRouter);
app.route("/api/sites/:siteId/publish", publishRouter);

// Webhook routes
app.route("/webhooks", webhooksRouter);

export default app;
