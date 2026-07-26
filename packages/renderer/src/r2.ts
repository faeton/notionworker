/**
 * R2 storage helpers for the render pipeline.
 */

export interface RendererEnv {
  DB: D1Database;
  CONTENT: R2Bucket;
  /** Public URL prefix for R2 objects, e.g. "https://cdn.bl3s.com" */
  R2_PUBLIC_URL: string;
  /** Notion API access token (optional — uses internal API if not set) */
  NOTION_ACCESS_TOKEN?: string;
}

/** Store rendered HTML in R2 */
export async function putHtml(
  r2: R2Bucket,
  siteId: string,
  slug: string,
  html: string,
): Promise<void> {
  const key = slug ? `${siteId}/${slug}/index.html` : `${siteId}/index.html`;
  await r2.put(key, html, {
    httpMetadata: { contentType: "text/html; charset=utf-8" },
  });
}

/** Store robots.txt in R2 */
export async function putRobots(
  r2: R2Bucket,
  siteId: string,
  content: string,
): Promise<void> {
  await r2.put(`${siteId}/robots.txt`, content, {
    httpMetadata: { contentType: "text/plain" },
  });
}

/** Store sitemap.xml in R2 */
export async function putSitemap(
  r2: R2Bucket,
  siteId: string,
  content: string,
): Promise<void> {
  await r2.put(`${siteId}/sitemap.xml`, content, {
    httpMetadata: { contentType: "application/xml" },
  });
}

/** Get rendered HTML from R2 */
export async function getHtml(
  r2: R2Bucket,
  siteId: string,
  slug: string,
): Promise<{ body: ReadableStream; contentType: string } | null> {
  const key = slug ? `${siteId}/${slug}/index.html` : `${siteId}/index.html`;
  const obj = await r2.get(key);
  if (!obj) return null;
  return {
    body: obj.body,
    contentType: obj.httpMetadata?.contentType ?? "text/html; charset=utf-8",
  };
}

/** Get a static file from R2 (robots.txt, sitemap.xml, images) */
export async function getStatic(
  r2: R2Bucket,
  siteId: string,
  path: string,
): Promise<{ body: ReadableStream; contentType: string } | null> {
  const key = `${siteId}/${path}`;
  const obj = await r2.get(key);
  if (!obj) return null;
  return {
    body: obj.body,
    contentType: obj.httpMetadata?.contentType ?? "application/octet-stream",
  };
}

/** Delete all R2 objects for a site (for cleanup/re-render) */
export async function deleteSiteContent(
  r2: R2Bucket,
  siteId: string,
): Promise<void> {
  const listed = await r2.list({ prefix: `${siteId}/` });
  if (listed.objects.length > 0) {
    await r2.delete(listed.objects.map((obj) => obj.key));
  }
  // Handle truncated lists
  let cursor = listed.truncated ? listed.cursor : undefined;
  while (cursor) {
    const more = await r2.list({ prefix: `${siteId}/`, cursor });
    if (more.objects.length > 0) {
      await r2.delete(more.objects.map((obj) => obj.key));
    }
    cursor = more.truncated ? more.cursor : undefined;
  }
}
