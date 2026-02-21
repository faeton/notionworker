import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type { NotionBlock, PageData } from "../types.js";

/** Map of original URL → local path (relative to output dir) */
export type ImageMap = Map<string, string>;

/** Max widths for Notion CDN server-side resize */
const MAX_IMAGE_WIDTH = 1440;
const ICON_WIDTH = 160;

function isUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

function isNotionS3(url: string): boolean {
  return url.includes("secure.notion-static.com") || url.includes("s3.us-west-2");
}

/**
 * Build a Notion image proxy URL.
 * Step 1: notion.so/image/… redirects to img.notionusercontent.com/…/size/
 * Step 2: we follow the redirect, inject w=N into the /size/ path
 * Step 3: we send Accept: image/webp for format conversion
 */
function notionImageProxyUrl(originalUrl: string, blockId: string): string {
  return `https://www.notion.so/image/${encodeURIComponent(originalUrl)}?table=block&id=${blockId}`;
}

/** Follow Notion redirect and inject width into the CDN URL */
async function resolveNotionImageUrl(
  originalUrl: string,
  blockId: string,
  width: number,
): Promise<string> {
  const proxyUrl = notionImageProxyUrl(originalUrl, blockId);

  // Fetch with redirect: "manual" to capture the 302 location
  const res = await fetch(proxyUrl, { redirect: "manual" });
  const location = res.headers.get("location");

  if (!location || !location.includes("notionusercontent.com")) {
    // No redirect or unexpected host — fall back to proxy URL
    return proxyUrl;
  }

  // Inject w=N into the /size/ path segment
  // URL pattern: .../size/?exp=... → .../size/w=960?exp=...
  return location.replace("/size/?", `/size/w=${width}?`);
}

interface ImageEntry {
  url: string;
  blockId: string;
  width: number;
}

/** Recursively extract all image URLs from blocks */
function collectImageUrls(page: PageData): ImageEntry[] {
  const results: ImageEntry[] = [];

  // Page icon (if it's a URL)
  if (page.icon && isUrl(page.icon)) {
    results.push({ url: page.icon, blockId: page.id, width: ICON_WIDTH });
  }

  // Page cover
  if (page.cover) {
    results.push({ url: page.cover, blockId: page.id, width: MAX_IMAGE_WIDTH });
  }

  // Walk all blocks recursively
  function walk(blockIds: string[]) {
    for (const blockId of blockIds) {
      const block = page.blocks[blockId];
      if (!block) continue;

      if (block.type === "image") {
        const src =
          block.properties?.source?.[0]?.[0] ??
          block.format?.display_source;
        const w = block.format?.block_width ?? MAX_IMAGE_WIDTH;
        if (src) results.push({ url: src, blockId, width: Math.min(w * 2, MAX_IMAGE_WIDTH) });
      }

      if (block.type === "bookmark" && block.format?.bookmark_cover) {
        results.push({ url: block.format.bookmark_cover, blockId, width: 480 });
      }

      if (block.content) walk(block.content);
    }
  }

  walk(page.contentIds);
  return results;
}

/** Determine file extension from content-type, falling back to URL */
function getExtension(url: string, contentType?: string): string {
  // Prefer content-type (may differ from URL after format conversion)
  if (contentType) {
    if (contentType.includes("webp")) return "webp";
    if (contentType.includes("jpeg")) return "jpg";
    if (contentType.includes("png")) return "png";
    if (contentType.includes("gif")) return "gif";
    if (contentType.includes("svg")) return "svg";
    if (contentType.includes("avif")) return "avif";
  }

  try {
    const urlExt = extname(new URL(url).pathname).slice(1).toLowerCase();
    if (/^(png|jpg|jpeg|gif|webp|svg|ico|avif)$/.test(urlExt)) {
      return urlExt === "jpeg" ? "jpg" : urlExt;
    }
  } catch {
    // invalid URL
  }

  return "png";
}

/** Download all images from pages, returning a map of original URL → local path */
export async function downloadImages(
  pages: PageData[],
  outputDir: string,
): Promise<ImageMap> {
  const imageMap: ImageMap = new Map();
  const seen = new Map<string, ImageEntry>();

  for (const page of pages) {
    for (const entry of collectImageUrls(page)) {
      if (!seen.has(entry.url)) {
        seen.set(entry.url, entry);
      }
    }
  }

  if (seen.size === 0) return imageMap;

  const imagesDir = join(outputDir, "images");
  await mkdir(imagesDir, { recursive: true });

  for (const [originalUrl, { blockId, width }] of seen) {
    try {
      let fetchUrl: string;
      const headers: Record<string, string> = {};

      if (isNotionS3(originalUrl)) {
        // Resolve through Notion CDN with resize
        fetchUrl = await resolveNotionImageUrl(originalUrl, blockId, width);
        // Request WebP for smaller file sizes
        headers["Accept"] = "image/webp,image/jpeg,image/png,*/*";
      } else {
        fetchUrl = originalUrl;
      }

      console.log(`Downloading: ${originalUrl.slice(0, 80)}...`);
      const res = await fetch(fetchUrl, { headers });
      if (!res.ok) {
        console.warn(`  Failed (${res.status}), skipping`);
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      const contentType = res.headers.get("content-type") ?? undefined;
      const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 16);
      const ext = getExtension(originalUrl, contentType);
      const filename = `${hash}.${ext}`;
      const localPath = `images/${filename}`;
      const sizeKB = (buffer.byteLength / 1024).toFixed(0);

      await writeFile(join(outputDir, localPath), buffer);
      imageMap.set(originalUrl, localPath);
      console.log(`  → ${localPath} (${sizeKB}KB)`);
    } catch (err) {
      console.warn(`  Error downloading: ${err}`);
    }
  }

  return imageMap;
}
