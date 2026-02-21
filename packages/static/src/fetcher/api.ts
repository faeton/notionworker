import type { LoadPageChunkResponse, NotionBlock, PageData } from "../types.js";

const NOTION_API = "https://www.notion.so/api/v3";

/** Convert various page ID formats to UUID with dashes */
export function normalizePageId(id: string): string {
  const hex = id.replace(/-/g, "");
  if (hex.length !== 32 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error(`Invalid Notion page ID: ${id}`);
  }
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}

/** Extract page ID and optional username from a Notion URL */
export function parseNotionUrl(input: string): { pageId: string; username?: string } {
  // Already a raw ID
  if (/^[0-9a-f-]{32,36}$/i.test(input)) {
    return { pageId: normalizePageId(input) };
  }

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error(`Invalid Notion URL or page ID: ${input}`);
  }

  // Extract username from subdomain (e.g., faeton.notion.site)
  let username: string | undefined;
  const hostParts = url.hostname.split(".");
  if (hostParts.length >= 3 && hostParts[1] === "notion" && hostParts[2] === "site") {
    username = hostParts[0];
  }

  // Page ID is the last 32 hex chars in the path
  const match = url.pathname.match(/([0-9a-f]{32})(?:[?#]|$)/i);
  if (!match) {
    // Try the last path segment as the full ID
    const segments = url.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1];
    if (last && /^[0-9a-f-]{32,36}$/i.test(last)) {
      return { pageId: normalizePageId(last), username };
    }
    throw new Error(`Could not extract page ID from URL: ${input}`);
  }

  return { pageId: normalizePageId(match[1]), username };
}

/** Fetch all blocks for a page using loadPageChunk with pagination */
export async function loadPageChunk(pageId: string): Promise<Record<string, NotionBlock>> {
  const allBlocks: Record<string, NotionBlock> = {};
  let cursor = { stack: [] as unknown[] };
  let hasMore = true;

  while (hasMore) {
    const res = await fetch(`${NOTION_API}/loadPageChunk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pageId,
        limit: 100,
        cursor,
        chunkNumber: 0,
        verticalColumns: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Notion API error: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as LoadPageChunkResponse;

    for (const [id, record] of Object.entries(data.recordMap.block)) {
      if (record.value && record.value.alive !== false) {
        allBlocks[id] = record.value;
      }
    }

    // Check if there are more chunks
    if (data.cursor.stack.length > 0) {
      cursor = data.cursor;
    } else {
      hasMore = false;
    }
  }

  return allBlocks;
}

/** Fetch and parse a single page into PageData */
export async function fetchPage(pageId: string, slug = ""): Promise<PageData> {
  const id = normalizePageId(pageId);
  const blocks = await loadPageChunk(id);

  const pageBlock = blocks[id];
  if (!pageBlock || pageBlock.type !== "page") {
    throw new Error(`Block ${id} is not a page`);
  }

  const title = pageBlock.properties?.title
    ?.map((seg) => seg[0])
    .join("") ?? "Untitled";

  return {
    id,
    title,
    icon: pageBlock.format?.page_icon,
    cover: pageBlock.format?.page_cover,
    coverPosition: pageBlock.format?.page_cover_position,
    slug,
    blocks,
    contentIds: pageBlock.content ?? [],
  };
}
