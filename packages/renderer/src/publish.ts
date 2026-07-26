/**
 * Single-page publish: fetch → render → store to R2.
 */
import {
  fetchPage,
  fetchPageOfficial,
  renderPage,
  downloadImagesToR2,
} from "@notionworker/static";
import type { RendererEnv } from "./r2.js";
import { putHtml } from "./r2.js";
import { buildRenderConfig, type RenderSiteConfig } from "./config.js";

/**
 * Re-render a single page and upload to R2.
 */
export async function publishPage(
  siteConfig: RenderSiteConfig,
  notionPageId: string,
  env: RendererEnv,
): Promise<void> {
  const pageEntry = siteConfig.pages.find((p) => p.notionPageId === notionPageId);
  if (!pageEntry) {
    throw new Error(`Page ${notionPageId} not found in site ${siteConfig.siteId}`);
  }

  // Fetch page content
  const page = env.NOTION_ACCESS_TOKEN
    ? await fetchPageOfficial(notionPageId, env.NOTION_ACCESS_TOKEN, pageEntry.slug)
    : await fetchPage(notionPageId, pageEntry.slug);

  // Download images to R2
  const imageMap = await downloadImagesToR2(
    [page],
    env.CONTENT as unknown as import("@notionworker/static").R2Bucket,
    siteConfig.siteId,
    env.R2_PUBLIC_URL,
  );

  // Render HTML
  const renderConfig = buildRenderConfig(siteConfig);
  const html = renderPage(page, renderConfig, imageMap);

  // Store in R2
  await putHtml(env.CONTENT, siteConfig.siteId, pageEntry.slug, html);
}
