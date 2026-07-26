/**
 * Image pipeline for Cloudflare R2 storage.
 * Adapted from image-downloader.ts but uses R2 instead of filesystem,
 * and crypto.subtle instead of node:crypto.
 */
import type { ImageMap, NotionBlock, PageData } from "../types.js";

export type { ImageMap };

const MAX_IMAGE_WIDTH = 1440;
const ICON_WIDTH = 160;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // 15 MB per image

function isUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * URLs come from tenant-controlled Notion content — only fetch https,
 * and never targets that look like internal/loopback addresses.
 */
function isSafeFetchUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(host) || // raw IPv4
    host.startsWith("[") // raw IPv6
  ) {
    return false;
  }
  return true;
}

function isNotionS3(url: string): boolean {
  return url.includes("secure.notion-static.com") || url.includes("s3.us-west-2");
}

function notionImageProxyUrl(originalUrl: string, blockId: string): string {
  return `https://www.notion.so/image/${encodeURIComponent(originalUrl)}?table=block&id=${blockId}`;
}

async function resolveNotionImageUrl(
  originalUrl: string,
  blockId: string,
  width: number,
): Promise<string> {
  const proxyUrl = notionImageProxyUrl(originalUrl, blockId);
  const res = await fetch(proxyUrl, { redirect: "manual" });
  const location = res.headers.get("location");

  if (!location || !location.includes("notionusercontent.com")) {
    return proxyUrl;
  }

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

  if (page.icon && isUrl(page.icon)) {
    results.push({ url: page.icon, blockId: page.id, width: ICON_WIDTH });
  }

  if (page.cover) {
    results.push({ url: page.cover, blockId: page.id, width: MAX_IMAGE_WIDTH });
  }

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

/** Get file extension from content-type or URL */
function getExtension(url: string, contentType?: string): string {
  if (contentType) {
    if (contentType.includes("webp")) return "webp";
    if (contentType.includes("jpeg")) return "jpg";
    if (contentType.includes("png")) return "png";
    if (contentType.includes("gif")) return "gif";
    if (contentType.includes("svg")) return "svg";
    if (contentType.includes("avif")) return "avif";
  }

  try {
    const pathname = new URL(url).pathname;
    const dot = pathname.lastIndexOf(".");
    if (dot !== -1) {
      const urlExt = pathname.slice(dot + 1).toLowerCase();
      if (/^(png|jpg|jpeg|gif|webp|svg|ico|avif)$/.test(urlExt)) {
        return urlExt === "jpeg" ? "jpg" : urlExt;
      }
    }
  } catch {
    // invalid URL
  }

  return "png";
}

/** Hash buffer using Web Crypto API (works in CF Workers) */
async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = new Uint8Array(hashBuffer);
  return Array.from(hashArray)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * R2Bucket interface matching Cloudflare Workers R2 API.
 * Defined here to avoid requiring @cloudflare/workers-types in the static package.
 */
export interface R2Bucket {
  put(key: string, value: ArrayBuffer | ReadableStream | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  head(key: string): Promise<unknown | null>;
  get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string } } | null>;
}

/**
 * Download all images from pages and store them in R2.
 * Returns a map of original URL → R2 public URL.
 */
export async function downloadImagesToR2(
  pages: PageData[],
  r2Bucket: R2Bucket,
  siteId: string,
  r2PublicUrl: string,
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

  for (const [originalUrl, { blockId, width }] of seen) {
    try {
      let fetchUrl: string;
      const headers: Record<string, string> = {};

      if (isNotionS3(originalUrl)) {
        fetchUrl = await resolveNotionImageUrl(originalUrl, blockId, width);
        headers["Accept"] = "image/webp,image/jpeg,image/png,*/*";
      } else {
        fetchUrl = originalUrl;
      }

      if (!isSafeFetchUrl(fetchUrl)) {
        console.warn(`[image-r2] Skipping unsafe URL ${fetchUrl.slice(0, 80)}`);
        continue;
      }

      // Download the image
      const res = await fetch(fetchUrl, { headers });
      if (!res.ok) {
        console.warn(`[image-r2] Failed to download ${originalUrl.slice(0, 80)} (${res.status})`);
        continue;
      }

      const contentType = res.headers.get("content-type") ?? undefined;
      if (contentType && !contentType.startsWith("image/")) {
        console.warn(`[image-r2] Skipping non-image content-type ${contentType} for ${originalUrl.slice(0, 80)}`);
        continue;
      }
      const contentLength = Number(res.headers.get("content-length") ?? 0);
      if (contentLength > MAX_IMAGE_BYTES) {
        console.warn(`[image-r2] Skipping oversized image (${contentLength} bytes) ${originalUrl.slice(0, 80)}`);
        continue;
      }

      const buffer = await res.arrayBuffer();
      if (buffer.byteLength > MAX_IMAGE_BYTES) {
        console.warn(`[image-r2] Skipping oversized image (${buffer.byteLength} bytes) ${originalUrl.slice(0, 80)}`);
        continue;
      }
      const hash = (await sha256Hex(buffer)).slice(0, 16);
      const ext = getExtension(originalUrl, contentType);
      const r2Key = `${siteId}/images/${hash}.${ext}`;

      // Check if already exists in R2
      const existing = await r2Bucket.head(r2Key);
      if (!existing) {
        await r2Bucket.put(r2Key, buffer, {
          httpMetadata: { contentType: contentType || `image/${ext}` },
        });
      }

      const publicUrl = `${r2PublicUrl.replace(/\/$/, "")}/${r2Key}`;
      imageMap.set(originalUrl, publicUrl);
    } catch (err) {
      console.warn(`[image-r2] Error downloading ${originalUrl.slice(0, 80)}: ${err}`);
    }
  }

  return imageMap;
}
