import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { domains } from "@notionworker/db";
import type { Env } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { generateId, getOwnedSite, purgeSiteCache } from "../lib/util.js";

type Variables = { userId: string; userName: string | null };

const domainsRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

domainsRouter.use("/*", requireAuth);

const HOSTNAME_RE = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

/** GET /sites/:siteId/domains — list domains */
domainsRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;

  if (!(await getOwnedSite(c.env.DB, siteId, userId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const d1 = drizzle(c.env.DB);
  const siteDomains = await d1.select().from(domains).where(eq(domains.siteId, siteId));
  return c.json({ domains: siteDomains });
});

/** POST /sites/:siteId/domains — add custom domain */
domainsRouter.post("/", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;

  const site = await getOwnedSite(c.env.DB, siteId, userId);
  if (!site) {
    return c.json({ error: "Site not found" }, 404);
  }

  // Check plan (custom domains require paid plan)
  if (site.plan === "free") {
    return c.json({ error: "Custom domains require a paid plan" }, 403);
  }

  const body = await c.req.json<{ hostname: string }>();
  const hostname = (body.hostname ?? "").trim().toLowerCase().replace(/^www\./, "");
  if (!HOSTNAME_RE.test(hostname)) {
    return c.json({ error: "Invalid hostname" }, 400);
  }

  const d1 = drizzle(c.env.DB);
  const domainId = generateId();
  const now = new Date();

  // Create CF Custom Hostname if API token is configured
  let cfCustomHostnameId: string | null = null;
  let sslStatus: string | null = null;

  if (c.env.CF_API_TOKEN && c.env.CF_ZONE_ID) {
    try {
      const cfRes = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${c.env.CF_ZONE_ID}/custom_hostnames`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${c.env.CF_API_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            hostname,
            ssl: {
              method: "http",
              type: "dv",
              settings: { min_tls_version: "1.2" },
            },
          }),
        },
      );
      const cfData = (await cfRes.json()) as {
        success: boolean;
        result?: { id: string; ssl?: { status: string } };
      };
      if (cfData.success && cfData.result) {
        cfCustomHostnameId = cfData.result.id;
        sslStatus = cfData.result.ssl?.status ?? "initializing";
      }
    } catch (err) {
      console.error(`[domains] CF Custom Hostname creation failed: ${err}`);
    }
  }

  await d1.insert(domains).values({
    id: domainId,
    siteId,
    hostname,
    status: cfCustomHostnameId ? "active" : "pending",
    cfCustomHostnameId,
    sslStatus,
    isPrimary: false,
    createdAt: now,
    updatedAt: now,
  });

  await purgeSiteCache(c.env, siteId);

  return c.json({
    domain: { id: domainId, hostname, status: cfCustomHostnameId ? "active" : "pending" },
    instructions: cfCustomHostnameId
      ? "SSL provisioning in progress. Add a CNAME record pointing to your platform domain."
      : "Add a CNAME record pointing to your platform domain, then verify.",
  }, 201);
});

/** DELETE /sites/:siteId/domains/:domainId — remove custom domain */
domainsRouter.delete("/:domainId", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;
  const domainId = c.req.param("domainId") as string;

  if (!(await getOwnedSite(c.env.DB, siteId, userId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const d1 = drizzle(c.env.DB);
  const [domain] = await d1
    .select()
    .from(domains)
    .where(and(eq(domains.id, domainId), eq(domains.siteId, siteId)))
    .limit(1);

  if (!domain) {
    return c.json({ error: "Domain not found" }, 404);
  }

  // Delete CF Custom Hostname
  if (domain.cfCustomHostnameId && c.env.CF_API_TOKEN && c.env.CF_ZONE_ID) {
    try {
      await fetch(
        `https://api.cloudflare.com/client/v4/zones/${c.env.CF_ZONE_ID}/custom_hostnames/${domain.cfCustomHostnameId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${c.env.CF_API_TOKEN}` },
        },
      );
    } catch (err) {
      console.error(`[domains] CF Custom Hostname deletion failed: ${err}`);
    }
  }

  // Purge before deleting so the custom hostname's cache entry is removed
  await purgeSiteCache(c.env, siteId);
  await d1.delete(domains).where(eq(domains.id, domainId));
  return c.json({ ok: true });
});

export default domainsRouter;
