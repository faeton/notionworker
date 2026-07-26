import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { sites, pages, themes, domains } from "@notionworker/db";
import { deleteSiteContent } from "@notionworker/renderer";
import type { Env } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { generateId, getOwnedSite, purgeSiteCache } from "../lib/util.js";

type Variables = { userId: string; userName: string | null };

const sitesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

sitesRouter.use("/*", requireAuth);

const SUBDOMAIN_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const RESERVED_SUBDOMAINS = new Set(["www", "api", "app", "cdn", "admin", "dashboard", "mail"]);

/** Normalize and validate a subdomain. Returns null if invalid. */
function normalizeSubdomain(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const subdomain = raw.trim().toLowerCase();
  if (!SUBDOMAIN_RE.test(subdomain) || RESERVED_SUBDOMAINS.has(subdomain)) return null;
  return subdomain;
}

/** GET /sites — list user's sites */
sitesRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const d1 = drizzle(c.env.DB);

  const userSites = await d1
    .select()
    .from(sites)
    .where(eq(sites.userId, userId));

  return c.json({ sites: userSites });
});

/** POST /sites — create a new site */
sitesRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{
    name: string;
    subdomain: string;
    platformDomainId: string;
    notionUsername: string;
  }>();

  if (!body.name || !body.platformDomainId || !body.notionUsername) {
    return c.json({ error: "name, subdomain, platformDomainId and notionUsername are required" }, 400);
  }

  const subdomain = normalizeSubdomain(body.subdomain);
  if (!subdomain) {
    return c.json({ error: "Invalid subdomain" }, 400);
  }

  const d1 = drizzle(c.env.DB);

  const taken = await d1
    .select({ id: sites.id })
    .from(sites)
    .where(and(eq(sites.subdomain, subdomain), eq(sites.platformDomainId, body.platformDomainId)))
    .limit(1);
  if (taken.length > 0) {
    return c.json({ error: "Subdomain is already taken" }, 409);
  }

  const now = new Date();
  const siteId = generateId();

  await d1.insert(sites).values({
    id: siteId,
    name: body.name,
    subdomain,
    platformDomainId: body.platformDomainId,
    notionUsername: body.notionUsername,
    userId,
    createdAt: now,
    updatedAt: now,
  });

  // Create default theme
  await d1.insert(themes).values({
    id: generateId(),
    siteId,
    hideTopbar: true,
    showNavigation: false,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({ site: { id: siteId } }, 201);
});

/** GET /sites/:id — get site details */
sitesRouter.get("/:id", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("id") as string;

  const site = await getOwnedSite(c.env.DB, siteId, userId);
  if (!site) {
    return c.json({ error: "Site not found" }, 404);
  }

  const d1 = drizzle(c.env.DB);
  const sitePages = await d1.select().from(pages).where(eq(pages.siteId, siteId));
  const [siteTheme] = await d1.select().from(themes).where(eq(themes.siteId, siteId)).limit(1);
  const siteDomains = await d1.select().from(domains).where(eq(domains.siteId, siteId));

  return c.json({ site, pages: sitePages, theme: siteTheme, domains: siteDomains });
});

/** PUT /sites/:id — update site */
sitesRouter.put("/:id", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("id") as string;
  const body = await c.req.json<{
    name?: string;
    subdomain?: string;
    notionUsername?: string;
  }>();

  const site = await getOwnedSite(c.env.DB, siteId, userId);
  if (!site) {
    return c.json({ error: "Site not found" }, 404);
  }

  // Whitelist updatable fields — never spread the raw body into the update
  const updates: { name?: string; subdomain?: string; notionUsername?: string } = {};
  if (typeof body.name === "string" && body.name) updates.name = body.name;
  if (typeof body.notionUsername === "string" && body.notionUsername) {
    updates.notionUsername = body.notionUsername;
  }
  if (body.subdomain !== undefined) {
    const subdomain = normalizeSubdomain(body.subdomain);
    if (!subdomain) {
      return c.json({ error: "Invalid subdomain" }, 400);
    }
    updates.subdomain = subdomain;
  }

  const d1 = drizzle(c.env.DB);

  if (updates.subdomain && updates.subdomain !== site.subdomain) {
    const taken = await d1
      .select({ id: sites.id })
      .from(sites)
      .where(and(eq(sites.subdomain, updates.subdomain), eq(sites.platformDomainId, site.platformDomainId)))
      .limit(1);
    if (taken.length > 0) {
      return c.json({ error: "Subdomain is already taken" }, 409);
    }
  }

  // Purge the old hostname's cache before the subdomain changes
  await purgeSiteCache(c.env, siteId);

  await d1
    .update(sites)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(sites.id, siteId));

  await purgeSiteCache(c.env, siteId);

  return c.json({ ok: true });
});

/** DELETE /sites/:id — delete site */
sitesRouter.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("id") as string;

  const site = await getOwnedSite(c.env.DB, siteId, userId);
  if (!site) {
    return c.json({ error: "Site not found" }, 404);
  }

  // Purge caches while hostname rows still exist
  await purgeSiteCache(c.env, siteId);

  // Delete rendered content from R2
  try {
    await deleteSiteContent(c.env.CONTENT, siteId);
  } catch (err) {
    console.error(`[sites] Failed to delete R2 content for ${siteId}: ${err}`);
  }

  // Delete related data
  const d1 = drizzle(c.env.DB);
  await d1.delete(pages).where(eq(pages.siteId, siteId));
  await d1.delete(themes).where(eq(themes.siteId, siteId));
  await d1.delete(domains).where(eq(domains.siteId, siteId));
  await d1.delete(sites).where(eq(sites.id, siteId));

  return c.json({ ok: true });
});

export default sitesRouter;
