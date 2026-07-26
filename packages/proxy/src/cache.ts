import type { Env, SiteConfig } from "./types.js";
import { loadConfigFromD1 } from "./config.js";

const memoryCache = new Map<string, { config: SiteConfig; expiresAt: number }>();

// Kept short: KV purges on config mutations can't reach warm isolates,
// so this TTL bounds how long a stale/reassigned hostname keeps serving
const MEMORY_TTL_MS = 60 * 1000; // 1 minute
const KV_TTL_SECONDS = 60 * 60; // 1 hour

export async function getSiteConfig(
  hostname: string,
  env: Env
): Promise<SiteConfig | null> {
  // Layer 1: Memory cache
  const memEntry = memoryCache.get(hostname);
  if (memEntry && memEntry.expiresAt > Date.now()) {
    console.log(`[cache] memory hit: ${hostname}`);
    return memEntry.config;
  }

  // Layer 2: KV cache
  const kvKey = `site:${hostname}`;
  const kvData = await env.SITE_CACHE.get(kvKey, "text");
  if (kvData) {
    console.log(`[cache] KV hit: ${hostname}`);
    const config = JSON.parse(kvData) as SiteConfig;
    memoryCache.set(hostname, {
      config,
      expiresAt: Date.now() + MEMORY_TTL_MS,
    });
    return config;
  }

  // Layer 3: D1 database
  console.log(`[cache] D1 lookup: ${hostname}`);
  const config = await loadConfigFromD1(hostname, env.DB);
  if (!config) {
    return null;
  }

  // Populate caches
  const serialized = JSON.stringify(config);
  memoryCache.set(hostname, {
    config,
    expiresAt: Date.now() + MEMORY_TTL_MS,
  });
  await env.SITE_CACHE.put(kvKey, serialized, {
    expirationTtl: KV_TTL_SECONDS,
  });

  return config;
}

export function invalidateMemoryCache(hostname: string): void {
  memoryCache.delete(hostname);
}
