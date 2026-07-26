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

// Reserved paths the proxy handles itself — slugs must not shadow them
const RESERVED_SLUGS = new Set(["robots.txt", "sitemap.xml", "api", "app", "image", "images"]);

/** Normalize a slug: "" (homepage) or lowercase [a-z0-9-], not reserved. Null if invalid. */
function normalizeSlug(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const slug = raw.trim().toLowerCase();
  if (slug === "") return "";
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(slug)) return null;
  if (RESERVED_SLUGS.has(slug)) return null;
  return slug;
}

/** Normalize a Notion page ID to 32 hex chars. Null if invalid. */
function normalizeNotionPageId(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const id = raw.trim().toLowerCase().replace(/-/g, "");
  return /^[0-9a-f]{32}$/.test(id) ? id : null;
}

/** Delete a page's published HTML from R2 (stale content must not outlive the page) */
async function deletePublishedHtml(r2: R2Bucket, siteId: string, slug: string): Promise<void> {
  const key = slug ? `${siteId}/${slug}/index.html` : `${siteId}/index.html`;
  try {
    await r2.delete(key);
  } catch (err) {
    console.error(`[pages] Failed to delete R2 object ${key}: ${err}`);
  }
}

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

  const values = [];
  for (const [i, p] of body.pages.entries()) {
    const notionPageId = normalizeNotionPageId(p.notionPageId);
    const slug = normalizeSlug(p.slug);
    if (!notionPageId) {
      return c.json({ error: `Invalid Notion page ID: ${String(p.notionPageId).slice(0, 64)}` }, 400);
    }
    if (slug === null) {
      return c.json({ error: `Invalid slug: ${String(p.slug).slice(0, 64)}` }, 400);
    }
    values.push({
      id: generateId(),
      siteId,
      notionPageId,
      slug,
      title: p.title ?? null,
      description: p.description ?? null,
      ogImage: p.ogImage ?? null,
      isHomepage: p.isHomepage ?? false,
      sortOrder: i,
      createdAt: now,
      updatedAt: now,
    });
  }

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
  if (body.slug !== undefined) {
    const slug = normalizeSlug(body.slug);
    if (slug === null) {
      return c.json({ error: "Invalid slug" }, 400);
    }
    updates.slug = slug;
  }
  if (body.title !== undefined) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.ogImage !== undefined) updates.ogImage = body.ogImage;
  if (typeof body.isHomepage === "boolean") updates.isHomepage = body.isHomepage;
  if (typeof body.sortOrder === "number") updates.sortOrder = body.sortOrder;

  const d1 = drizzle(c.env.DB);

  const [existing] = await d1
    .select({ slug: pages.slug })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.siteId, siteId)))
    .limit(1);
  if (!existing) {
    return c.json({ error: "Page not found" }, 404);
  }

  await d1
    .update(pages)
    .set({ ...updates, updatedAt: new Date() })
    .where(and(eq(pages.id, pageId), eq(pages.siteId, siteId)));

  // If the slug changed, the old published HTML would keep serving — remove it
  if (typeof updates.slug === "string" && updates.slug !== existing.slug) {
    await deletePublishedHtml(c.env.CONTENT, siteId, existing.slug);
  }

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

  const [existing] = await d1
    .select({ slug: pages.slug })
    .from(pages)
    .where(and(eq(pages.id, pageId), eq(pages.siteId, siteId)))
    .limit(1);

  await d1.delete(pages).where(and(eq(pages.id, pageId), eq(pages.siteId, siteId)));
  if (existing) {
    await deletePublishedHtml(c.env.CONTENT, siteId, existing.slug);
  }
  await purgeSiteCache(c.env, siteId);

  return c.json({ ok: true });
});

export default pagesRouter;
