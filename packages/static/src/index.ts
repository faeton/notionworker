// Public API
export type {
  NotionBlock,
  RichText,
  RichTextSegment,
  Decoration,
  LoadPageChunkResponse,
  NotionRecordMap,
  SiteConfig,
  PageData,
} from "./types.js";

export { normalizePageId, parseNotionUrl, loadPageChunk, fetchPage } from "./fetcher/api.js";
export { fetchPageOfficial, loadPageBlocksOfficial, searchPages } from "./fetcher/official-api.js";
export { crawlPages } from "./fetcher/crawler.js";
export { downloadImages } from "./fetcher/image-downloader.js";
export type { ImageMap } from "./fetcher/image-downloader.js";
export { downloadImagesToR2 } from "./fetcher/image-r2.js";
export type { R2Bucket } from "./fetcher/image-r2.js";

export { renderRichText } from "./renderer/rich-text.js";
export { renderBlockList } from "./renderer/blocks.js";

export { renderPage } from "./template/html.js";
export { generateCss } from "./template/css.js";
export { generateSitemap } from "./template/sitemap.js";
export { generateRobots } from "./template/robots.js";
