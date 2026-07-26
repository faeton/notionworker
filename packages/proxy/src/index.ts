import type { Env, SiteConfig } from "./types.js";
import { getSiteConfig } from "./cache.js";
import { handleRobots } from "./routes/robots.js";
import { handleSitemap } from "./routes/sitemap.js";
import { handleNotionApi } from "./routes/notion-api.js";
import { handleNotionJs } from "./routes/notion-js.js";
import { handlePage, tryR2Static } from "./routes/page.js";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function handleOptions(request: Request): Response {
  if (
    request.headers.get("Origin") &&
    request.headers.get("Access-Control-Request-Method") &&
    request.headers.get("Access-Control-Request-Headers")
  ) {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(null, {
    headers: { Allow: "GET, HEAD, POST, PUT, OPTIONS" },
  });
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const hostname = url.hostname.replace(/^www\./, "");

    // Resolve site config from cache chain
    const config = await getSiteConfig(hostname, env);
    if (!config) {
      return new Response("Site not found", { status: 404 });
    }

    console.log(`[proxy] ${hostname}${url.pathname} → site:${config.siteId}`);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return handleOptions(request);
    }

    // Route dispatch
    if (url.pathname === "/robots.txt") {
      // Try R2 first, fall back to dynamic generation
      const r2 = await tryR2Static(env, config, "robots.txt");
      if (r2) return r2;
      return handleRobots(config);
    }

    if (url.pathname === "/sitemap.xml") {
      const r2 = await tryR2Static(env, config, "sitemap.xml");
      if (r2) return r2;
      return handleSitemap(config);
    }

    if (url.pathname.startsWith("/app") && url.pathname.endsWith("js")) {
      return handleNotionJs(url, config);
    }

    if (url.pathname.startsWith("/api")) {
      return handleNotionApi(request, url, config);
    }

    // Slug → redirect to Notion page ID (only needed for live proxy mode)
    const slug = url.pathname.slice(1);

    // If this slug maps to a page, try serving from R2 directly
    if (config.slugToPage[slug] !== undefined) {
      const r2 = await tryR2Static(env, config, slug ? `${slug}/index.html` : "index.html");
      if (r2) return r2;
      // Fall back to redirect for live proxy
      const pageId = config.slugToPage[slug];
      console.log(`[proxy] slug redirect: /${slug} → /${pageId}`);
      return Response.redirect(`https://${config.hostname}/${pageId}`, 301);
    }

    // Unknown 32-char hex ID not in our page list → redirect to homepage
    if (
      !config.pageIds.includes(slug) &&
      /^[0-9a-f]{32}$/.test(slug)
    ) {
      console.log(`[proxy] unknown page ID, redirecting to homepage`);
      return Response.redirect(`https://${config.hostname}`, 301);
    }

    // Default: try R2 static → fall back to live Notion proxy
    return handlePage(request, url, config, env);
  },
};
