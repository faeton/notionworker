import type { SiteConfig } from "../types.js";

export function handleRobots(config: SiteConfig): Response {
  const body = `User-agent: *
Allow: /

Sitemap: https://${config.hostname}/sitemap.xml`;
  return new Response(body, {
    headers: { "content-type": "text/plain" },
  });
}
