import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { users } from "@notionworker/db";
import { renderSite, loadRenderConfig, publishPage } from "@notionworker/renderer";
import type { Env } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { getOwnedSite } from "../lib/util.js";

type Variables = { userId: string; userName: string | null };

const publishRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

publishRouter.use("/*", requireAuth);

async function getSiteWithToken(
  db: D1Database,
  siteId: string,
  userId: string,
): Promise<{ notionAccessToken?: string } | null> {
  const site = await getOwnedSite(db, siteId, userId);
  if (!site) return null;

  // Get the user's access token
  const d1 = drizzle(db);
  const [user] = await d1
    .select({ accessToken: users.accessToken })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return { notionAccessToken: user?.accessToken };
}

/** POST /sites/:siteId/publish — render entire site */
publishRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;

  const siteData = await getSiteWithToken(c.env.DB, siteId, userId);
  if (!siteData) {
    return c.json({ error: "Site not found" }, 404);
  }

  const result = await renderSite(siteId, {
    DB: c.env.DB,
    CONTENT: c.env.CONTENT,
    R2_PUBLIC_URL: c.env.R2_PUBLIC_URL,
    NOTION_ACCESS_TOKEN: siteData.notionAccessToken,
  });

  return c.json(result);
});

/** POST /sites/:siteId/publish/:pageId — render single page */
publishRouter.post("/:pageId", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;
  const pageId = c.req.param("pageId") as string;

  const siteData = await getSiteWithToken(c.env.DB, siteId, userId);
  if (!siteData) {
    return c.json({ error: "Site not found" }, 404);
  }

  const config = await loadRenderConfig(siteId, c.env.DB);

  await publishPage(config, pageId, {
    DB: c.env.DB,
    CONTENT: c.env.CONTENT,
    R2_PUBLIC_URL: c.env.R2_PUBLIC_URL,
    NOTION_ACCESS_TOKEN: siteData.notionAccessToken,
  });

  return c.json({ ok: true });
});

export default publishRouter;
