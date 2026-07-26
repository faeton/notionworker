import type { Env, SiteConfig } from "../types.js";
import { applyRewriters } from "../rewriters/index.js";

/**
 * Try to serve pre-rendered HTML from R2.
 * Returns null if not found (caller should fall back to live proxy).
 */
async function tryR2(
  env: Env,
  config: SiteConfig,
  slug: string,
): Promise<Response | null> {
  if (!env.CONTENT) return null;

  const r2Key = slug
    ? `${config.siteId}/${slug}/index.html`
    : `${config.siteId}/index.html`;

  try {
    const obj = await env.CONTENT.get(r2Key);
    if (!obj) return null;

    console.log(`[proxy] R2 hit: ${r2Key}`);
    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType ?? "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "X-Served-By": "r2",
      },
    });
  } catch {
    return null;
  }
}

/**
 * Try to serve a static file (robots.txt, sitemap.xml) from R2.
 */
export async function tryR2Static(
  env: Env,
  config: SiteConfig,
  path: string,
): Promise<Response | null> {
  if (!env.CONTENT) return null;

  const r2Key = `${config.siteId}/${path}`;
  try {
    const obj = await env.CONTENT.get(r2Key);
    if (!obj) return null;

    return new Response(obj.body, {
      headers: {
        "Content-Type": obj.httpMetadata?.contentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
        "X-Served-By": "r2",
      },
    });
  } catch {
    return null;
  }
}

export async function handlePage(
  request: Request,
  url: URL,
  config: SiteConfig,
  env: Env,
): Promise<Response> {
  // Determine which page this is
  const pathId = url.pathname.slice(1).slice(-32);
  const currentPage = config.pageMeta[pathId] || null;

  // Try R2 first (static fast path)
  if (currentPage) {
    const r2Response = await tryR2(env, config, currentPage.slug);
    if (r2Response) return r2Response;
  } else if (url.pathname === "/" || url.pathname === "") {
    // Homepage
    const r2Response = await tryR2(env, config, "");
    if (r2Response) return r2Response;
  }

  // Fall back to live Notion proxy
  console.log(`[proxy] R2 miss, proxying live: ${url.pathname}`);
  url.hostname = `${config.notionUsername}.notion.site`;

  const response = await fetch(url.toString(), {
    body: request.body,
    headers: request.headers,
    method: request.method,
  });

  const newResponse = new Response(response.body, response);
  newResponse.headers.delete("Content-Security-Policy");
  newResponse.headers.delete("X-Content-Security-Policy");

  return applyRewriters(newResponse, config, currentPage);
}
