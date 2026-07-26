import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { sites, domains, platformDomains } from "@notionworker/db";
import type { Env } from "../types.js";

export function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type SiteRow = typeof sites.$inferSelect;

/** Load a site only if it belongs to the given user. Returns null otherwise. */
export async function getOwnedSite(
  db: D1Database,
  siteId: string,
  userId: string,
): Promise<SiteRow | null> {
  const d1 = drizzle(db);
  const [site] = await d1
    .select()
    .from(sites)
    .where(eq(sites.id, siteId))
    .limit(1);
  return site && site.userId === userId ? site : null;
}

/**
 * Purge the proxy's cached site config from KV for every hostname
 * pointing at this site (platform subdomain + custom domains).
 * Call after any mutation that changes what the proxy serves.
 */
export async function purgeSiteCache(env: Env, siteId: string): Promise<void> {
  if (!env.SITE_CACHE) return;
  const d1 = drizzle(env.DB);

  const [site] = await d1
    .select({ subdomain: sites.subdomain, domain: platformDomains.domain })
    .from(sites)
    .innerJoin(platformDomains, eq(sites.platformDomainId, platformDomains.id))
    .where(eq(sites.id, siteId))
    .limit(1);

  const customDomains = await d1
    .select({ hostname: domains.hostname })
    .from(domains)
    .where(eq(domains.siteId, siteId));

  const hostnames = [
    ...(site ? [`${site.subdomain}.${site.domain}`] : []),
    ...customDomains.map((d) => d.hostname),
  ];

  await Promise.all(
    hostnames.map((h) =>
      env.SITE_CACHE!.delete(`site:${h}`).catch((err) =>
        console.error(`[cache] Failed to purge site:${h}: ${err}`),
      ),
    ),
  );
}
