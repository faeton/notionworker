import type { SiteConfig } from "../types.js";

export function handleSitemap(config: SiteConfig): Response {
  const urls = config.slugs.map(
    (slug) =>
      `  <url><loc>https://${config.hostname}/${slug}</loc></url>`
  );
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
  return new Response(xml, {
    headers: { "content-type": "application/xml" },
  });
}
