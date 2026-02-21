import type { PageData } from "../types.js";

export function generateSitemap(pages: PageData[], baseUrl: string): string {
  const urls = pages.map((page) => {
    const loc = page.slug ? `${baseUrl}/${page.slug}/` : `${baseUrl}/`;
    return `  <url><loc>${escapeXml(loc)}</loc></url>`;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
