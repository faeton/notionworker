import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { pages } from "@notionworker/db";
import type { Env } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { generateId, getOwnedSite, purgeSiteCache } from "../lib/util.js";

type Variables = { userId: string; userName: string | null };

const pagesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

pagesRouter.use("/*", requireAuth);

/** GET /sites/:siteId/pages — list pages */
pagesRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;

  if (!(await getOwnedSite(c.env.DB, siteId, userId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const d1 = drizzle(c.env.DB);
  const sitePages = await d1.select().from(pages).where(eq(pages.siteId, siteId));
  return c.json({ pages: sitePages });
});

/** POST /sites/:siteId/pages — add page(s) */
pagesRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;

  if (!(await getOwnedSite(c.env.DB, siteId, userId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const body = await c.req.json<{
    pages: Array<{
      notionPageId: string;
      slug: string;
      title?: string;
      description?: string;
      ogImage?: string;
      isHomepage?: boolean;
    }>;
  }>();

  if (!Array.isArray(body.pages) || body.pages.length === 0) {
    return c.json({ error: "pages array is required" }, 400);
  }

  const d1 = drizzle(c.env.DB);
  const now = new Date();

  const values = body.pages.map((p, i) => ({
    id: generateId(),
    siteId,
    notionPageId: p.notionPageId,
    slug: p.slug,
    title: p.title ?? null,
    description: p.description ?? null,
    ogImage: p.ogImage ?? null,
    isHomepage: p.isHomepage ?? false,
    sortOrder: i,
    createdAt: now,
    updatedAt: now,
  }));

  await d1.insert(pages).values(values);
  await purgeSiteCache(c.env, siteId);

  return c.json({ ok: true, count: values.length }, 201);
});

/** PUT /sites/:siteId/pages/:pageId — update page */
pagesRouter.put("/:pageId", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;
  const pageId = c.req.param("pageId") as string;

  if (!(await getOwnedSite(c.env.DB, siteId, userId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const body = await c.req.json<{
    slug?: string;
    title?: string;
    description?: string;
    ogImage?: string;
    isHomepage?: boolean;
    sortOrder?: number;
  }>();

  // Whitelist updatable fields — never spread the raw body into the update
  const updates: Record<string, unknown> = {};
  if (typeof body.slug === "string") updates.slug = body.slug;
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.ogImage !== undefined) updates.ogImage = body.ogImage;
  if (typeof body.isHomepage === "boolean") updates.isHomepage = body.isHomepage;
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;

  const d1 = drizzle(c.env.DB);
  await d1
    .update(pages)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(pages.id, pageId), eq(pages.siteId, siteId)));

  await purgeSiteCache(c.env, siteId);

  return c.json({ ok: true });
});

/** DELETE /sites/:siteId/pages/:pageId — remove page */
pagesRouter.delete("/:pageId", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;
  const pageId = c.req.param("pageId") as string;

  if (!(await getOwnedSite(c.env.DB, siteId, userId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const d1 = drizzle(c.env.DB);
  await d1.delete(pages).where(and(eq(pages.id, pageId), eq(pages.siteId, siteId)));
  await purgeSiteCache(c.env, siteId);

  return c.json({ ok: true });
});

export default pagesRouter;
