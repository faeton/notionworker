/**
 * Render pipeline orchestrator.
 *
 * renderSite(): fetch all pages → render HTML → upload to R2
 * publishPage(): re-render a single page
 */
import {
  fetchPage,
  fetchPageOfficial,
  renderPage,
  generateSitemap,
  generateRobots,
  type PageData,
} from "@notionworker/static";
import { downloadImagesToR2, type R2Bucket } from "@notionworker/static";
import type { RendererEnv } from "./r2.js";
import { putHtml, putRobots, putSitemap } from "./r2.js";
import { loadRenderConfig, buildRenderConfig, type RenderSiteConfig } from "./config.js";

export type { RendererEnv } from "./r2.js";
export type { RenderSiteConfig } from "./config.js";
export { loadRenderConfig } from "./config.js";
export { publishPage } from "./publish.js";
export { getHtml, getStatic, deleteSiteContent } from "./r2.js";

/**
 * Full site render: fetch all pages, render HTML, upload to R2.
 */
export async function renderSite(
  siteId: string,
  env: RendererEnv,
): Promise<{ pagesRendered: number; errors: string[] }> {
  const config = await loadRenderConfig(siteId, env.DB);
  return renderSiteFromConfig(config, env);
}

/**
 * Render a site from a pre-loaded config.
 */
export async function renderSiteFromConfig(
  config: RenderSiteConfig,
  env: RendererEnv,
): Promise<{ pagesRendered: number; errors: string[] }> {
  const errors: string[] = [];
  const allPages: PageData[] = [];

  // 1. Fetch all pages
  for (const pageEntry of config.pages) {
    try {
      const page = env.NOTION_ACCESS_TOKEN
        ? await fetchPageOfficial(pageEntry.notionPageId, env.NOTION_ACCESS_TOKEN, pageEntry.slug)
        : await fetchPage(pageEntry.notionPageId, pageEntry.slug);

      // Override title/description from DB if set
      if (pageEntry.title) {
        page.title = pageEntry.title;
      }

      allPages.push(page);
    } catch (err) {
      const msg = `Failed to fetch page ${pageEntry.notionPageId}: ${err}`;
      console.error(`[renderer] ${msg}`);
      errors.push(msg);
    }
  }

  if (allPages.length === 0) {
    return { pagesRendered: 0, errors };
  }

  // 2. Download all images to R2
  let imageMap: import("@notionworker/static").ImageMap = new Map();
  try {
    imageMap = await downloadImagesToR2(
      allPages,
      env.CONTENT as unknown as R2Bucket,
      config.siteId,
      env.R2_PUBLIC_URL,
    );
  } catch (err) {
    const msg = `Image download failed: ${err}`;
    console.error(`[renderer] ${msg}`);
    errors.push(msg);
  }

  // 3. Render and upload each page
  const renderConfig = buildRenderConfig(config);
  const homepageSlugs = new Set(config.pages.filter((p) => p.isHomepage).map((p) => p.slug));
  let pagesRendered = 0;

  for (const page of allPages) {
    try {
      const html = renderPage(page, renderConfig, imageMap);
      await putHtml(env.CONTENT, config.siteId, page.slug, html);
      // A homepage with a non-empty slug must also be served at the site root
      if (homepageSlugs.has(page.slug) && page.slug !== "") {
        await putHtml(env.CONTENT, config.siteId, "", html);
      }
      pagesRendered++;
      console.log(`[renderer] Rendered: ${config.siteId}/${page.slug || "index"}`);
    } catch (err) {
      const msg = `Failed to render page ${page.id}: ${err}`;
      console.error(`[renderer] ${msg}`);
      errors.push(msg);
    }
  }

  // 4. Generate and store robots.txt
  const baseUrl = config.hostname ? `https://${config.hostname}` : undefined;
  try {
    const robots = generateRobots(baseUrl);
    await putRobots(env.CONTENT, config.siteId, robots);
  } catch (err) {
    errors.push(`Failed to generate robots.txt: ${err}`);
  }

  // 5. Generate and store sitemap.xml
  if (baseUrl) {
    try {
      const sitemap = generateSitemap(allPages, baseUrl);
      await putSitemap(env.CONTENT, config.siteId, sitemap);
    } catch (err) {
      errors.push(`Failed to generate sitemap.xml: ${err}`);
    }
  }

  // 6. Update last_published_at in D1
  try {
    await env.DB.prepare(
      "UPDATE sites SET last_published_at = ? WHERE id = ?",
    ).bind(Math.floor(Date.now() / 1000), config.siteId).run();
  } catch (err) {
    errors.push(`Failed to update last_published_at: ${err}`);
  }

  console.log(`[renderer] Site ${config.siteId}: ${pagesRendered} pages rendered, ${errors.length} errors`);
  return { pagesRendered, errors };
}
