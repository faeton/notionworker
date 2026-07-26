import type { NotionBlock, RichText, Decoration, PageData } from "../types.js";
import { normalizePageId } from "./api.js";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";
const MAX_REQUESTS_PER_SECOND = 3;
const MAX_RETRIES = 3;

// Rate limiter: simple token bucket
let lastRequestTime = 0;

async function rateLimitedFetch(
  url: string,
  options: RequestInit & { headers: Record<string, string> },
): Promise<Response> {
  const now = Date.now();
  const minInterval = 1000 / MAX_REQUESTS_PER_SECOND;
  const elapsed = now - lastRequestTime;
  if (elapsed < minInterval) {
    await new Promise((r) => setTimeout(r, minInterval - elapsed));
  }
  lastRequestTime = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, options);
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 1000 * (attempt + 1);
      console.warn(`[official-api] Rate limited, waiting ${waitMs}ms...`);
      await new Promise((r) => setTimeout(r, waitMs));
      continue;
    }
    return res;
  }

  throw new Error(`[official-api] Max retries exceeded for ${url}`);
}

// ─── Official API types ───────────────────────────────────────────────────

interface OfficialRichText {
  type: "text" | "mention" | "equation";
  text?: { content: string; link?: { url: string } | null };
  mention?: {
    type: string;
    page?: { id: string };
    user?: { id: string };
    date?: { start: string; end?: string };
  };
  equation?: { expression: string };
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  plain_text: string;
  href?: string | null;
}

interface OfficialBlock {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
}

interface BlockChildrenResponse {
  results: OfficialBlock[];
  has_more: boolean;
  next_cursor: string | null;
}

// ─── Rich text translation ────────────────────────────────────────────────

/** Convert official API rich_text array to internal RichText format */
function translateRichText(richTexts: OfficialRichText[]): RichText {
  if (!richTexts || richTexts.length === 0) return [];

  return richTexts.map((rt): [string] | [string, Decoration[]] => {
    const text = rt.plain_text;
    const decorations: Decoration[] = [];

    if (rt.annotations.bold) decorations.push(["b"]);
    if (rt.annotations.italic) decorations.push(["i"]);
    if (rt.annotations.strikethrough) decorations.push(["s"]);
    if (rt.annotations.underline) decorations.push(["_"]);
    if (rt.annotations.code) decorations.push(["c"]);
    if (rt.annotations.color && rt.annotations.color !== "default") {
      decorations.push(["h", rt.annotations.color]);
    }

    if (rt.href) {
      decorations.push(["a", rt.href]);
    }

    if (rt.type === "equation" && rt.equation) {
      decorations.push(["e", rt.equation.expression]);
    }

    if (rt.type === "mention" && rt.mention?.type === "page" && rt.mention.page) {
      decorations.push(["p", rt.mention.page.id]);
    }

    if (decorations.length === 0) return [text];
    return [text, decorations];
  });
}

// ─── Block translation ────────────────────────────────────────────────────

/** Map official block type to internal block type */
const TYPE_MAP: Record<string, string> = {
  paragraph: "text",
  heading_1: "header",
  heading_2: "sub_header",
  heading_3: "sub_sub_header",
  bulleted_list_item: "bulleted_list",
  numbered_list_item: "numbered_list",
  to_do: "to_do",
  toggle: "toggle",
  code: "code",
  quote: "quote",
  callout: "callout",
  divider: "divider",
  image: "image",
  video: "video",
  embed: "embed",
  bookmark: "bookmark",
  column_list: "column_list",
  column: "column",
  table: "table",
  table_row: "table_row",
  child_page: "page",
  child_database: "collection_view",
  equation: "equation",
  link_preview: "bookmark",
  synced_block: "transclusion_container",
  table_of_contents: "table_of_contents",
  breadcrumb: "breadcrumb",
  pdf: "embed",
  file: "embed",
  audio: "embed",
  link_to_page: "alias",
};

/** Get the content object from an official block (it's nested under the type key) */
function getBlockContent(block: OfficialBlock): Record<string, unknown> {
  return (block[block.type] as Record<string, unknown>) ?? {};
}

/** Translate a single official API block to internal NotionBlock format */
function translateBlock(block: OfficialBlock): NotionBlock {
  const internalType = TYPE_MAP[block.type] || block.type;
  const content = getBlockContent(block);
  const id = normalizePageId(block.id);

  const result: NotionBlock = {
    id,
    type: internalType,
    alive: true,
  };

  // Rich text → properties.title
  const richText = content.rich_text as OfficialRichText[] | undefined;
  if (richText && richText.length > 0) {
    result.properties = { title: translateRichText(richText) };
  }

  // Block-type specific translations
  switch (block.type) {
    case "heading_1":
    case "heading_2":
    case "heading_3": {
      if ((content as { color?: string }).color && (content as { color?: string }).color !== "default") {
        result.format = { block_color: (content as { color: string }).color };
      }
      break;
    }

    case "to_do": {
      const checked = (content as { checked?: boolean }).checked;
      if (!result.properties) result.properties = {};
      result.properties.checked = [[checked ? "Yes" : "No"]];
      break;
    }

    case "code": {
      const lang = (content as { language?: string }).language;
      const caption = (content as { caption?: OfficialRichText[] }).caption;
      if (!result.properties) result.properties = {};
      if (lang) result.properties.language = [[lang]];
      if (caption && caption.length > 0) {
        result.properties.caption = translateRichText(caption);
      }
      break;
    }

    case "callout": {
      const icon = content.icon as { type: string; emoji?: string; external?: { url: string } } | undefined;
      if (icon) {
        result.format = {
          ...result.format,
          page_icon: icon.type === "emoji" ? icon.emoji : icon.external?.url,
        };
      }
      const color = (content as { color?: string }).color;
      if (color && color !== "default") {
        result.format = { ...result.format, block_color: color };
      }
      break;
    }

    case "image": {
      const imageData = content as {
        type: string;
        file?: { url: string };
        external?: { url: string };
        caption?: OfficialRichText[];
      };
      const imageUrl = imageData.type === "file" ? imageData.file?.url : imageData.external?.url;
      if (imageUrl) {
        if (!result.properties) result.properties = {};
        result.properties.source = [[imageUrl]];
        result.format = { ...result.format, display_source: imageUrl };
      }
      if (imageData.caption && imageData.caption.length > 0) {
        if (!result.properties) result.properties = {};
        result.properties.caption = translateRichText(imageData.caption);
      }
      break;
    }

    case "video": {
      const videoData = content as {
        type: string;
        file?: { url: string };
        external?: { url: string };
      };
      const videoUrl = videoData.type === "file" ? videoData.file?.url : videoData.external?.url;
      if (videoUrl) {
        if (!result.properties) result.properties = {};
        result.properties.source = [[videoUrl]];
        result.format = { ...result.format, display_source: videoUrl };
      }
      break;
    }

    case "embed":
    case "pdf":
    case "file":
    case "audio": {
      const embedData = content as {
        type?: string;
        url?: string;
        file?: { url: string };
        external?: { url: string };
      };
      const embedUrl = embedData.url ?? (embedData.type === "file" ? embedData.file?.url : embedData.external?.url);
      if (embedUrl) {
        if (!result.properties) result.properties = {};
        result.properties.source = [[embedUrl]];
        result.format = { ...result.format, display_source: embedUrl };
      }
      break;
    }

    case "bookmark":
    case "link_preview": {
      const bookmarkData = content as { url?: string; caption?: OfficialRichText[] };
      if (bookmarkData.url) {
        if (!result.properties) result.properties = {};
        result.properties.link = [[bookmarkData.url]];
      }
      if (bookmarkData.caption && bookmarkData.caption.length > 0) {
        if (!result.properties) result.properties = {};
        result.properties.caption = translateRichText(bookmarkData.caption);
      }
      break;
    }

    case "table": {
      const tableData = content as {
        table_width?: number;
        has_column_header?: boolean;
        has_row_header?: boolean;
      };
      result.format = {
        ...result.format,
        table_block_column_header: tableData.has_column_header,
        table_block_row_header: tableData.has_row_header,
      };
      break;
    }

    case "table_row": {
      const cells = (content as { cells?: OfficialRichText[][] }).cells;
      if (cells) {
        // Store each cell's rich text as properties
        // Internal format: properties.title holds first cell; we'll encode all cells
        // Table renderer reads from the block directly, so we store a custom format
        if (!result.properties) result.properties = {};
        result.properties.title = cells.map((cell) => {
          const text = cell.map((rt) => rt.plain_text).join("");
          return [text] as [string];
        }) as unknown as RichText;
        // Also store the full rich text per cell for the table renderer
        (result as unknown as Record<string, unknown>).__cells = cells.map(
          (cell) => translateRichText(cell),
        );
      }
      break;
    }

    case "child_page": {
      const title = (content as { title?: string }).title;
      if (title) {
        result.properties = { title: [[title]] };
      }
      break;
    }

    case "column": {
      // Columns don't have properties, just children
      break;
    }

    case "column_list": {
      // Column lists don't have properties, just children
      break;
    }

    case "equation": {
      const expression = (content as { expression?: string }).expression;
      if (expression) {
        result.properties = { title: [[expression, [["e", expression]]]] };
      }
      break;
    }

    case "quote": {
      const color = (content as { color?: string }).color;
      if (color && color !== "default") {
        result.format = { ...result.format, block_color: color };
      }
      break;
    }

    case "paragraph": {
      const color = (content as { color?: string }).color;
      if (color && color !== "default") {
        result.format = { ...result.format, block_color: color };
      }
      break;
    }
  }

  return result;
}

// ─── Fetching ─────────────────────────────────────────────────────────────

/** Fetch all children of a block, handling pagination */
async function fetchBlockChildren(
  blockId: string,
  accessToken: string,
): Promise<OfficialBlock[]> {
  const blocks: OfficialBlock[] = [];
  let cursor: string | null = null;

  do {
    const url = `${NOTION_API}/blocks/${blockId}/children?page_size=100${cursor ? `&start_cursor=${cursor}` : ""}`;
    const res = await rateLimitedFetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`[official-api] Failed to fetch blocks for ${blockId}: ${res.status} ${text}`);
    }

    const data = (await res.json()) as BlockChildrenResponse;
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return blocks;
}

/** Fetch page metadata via the official API */
async function fetchPageMeta(
  pageId: string,
  accessToken: string,
): Promise<{ title: string; icon?: string; cover?: string; coverPosition?: number }> {
  const url = `${NOTION_API}/pages/${pageId}`;
  const res = await rateLimitedFetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[official-api] Failed to fetch page ${pageId}: ${res.status} ${text}`);
  }

  const page = (await res.json()) as Record<string, unknown>;
  const properties = page.properties as Record<string, unknown> | undefined;

  // Extract title from properties
  let title = "Untitled";
  if (properties) {
    const titleProp = Object.values(properties).find(
      (p) => (p as { type?: string }).type === "title",
    ) as { title?: Array<{ plain_text: string }> } | undefined;
    if (titleProp?.title && titleProp.title.length > 0) {
      title = titleProp.title.map((t) => t.plain_text).join("");
    }
  }

  // Icon
  let icon: string | undefined;
  const iconData = page.icon as { type: string; emoji?: string; external?: { url: string }; file?: { url: string } } | null;
  if (iconData) {
    if (iconData.type === "emoji") icon = iconData.emoji;
    else if (iconData.type === "external") icon = iconData.external?.url;
    else if (iconData.type === "file") icon = iconData.file?.url;
  }

  // Cover
  let cover: string | undefined;
  const coverData = page.cover as { type: string; external?: { url: string }; file?: { url: string } } | null;
  if (coverData) {
    if (coverData.type === "external") cover = coverData.external?.url;
    else if (coverData.type === "file") cover = coverData.file?.url;
  }

  return { title, icon, cover };
}

/**
 * Recursively fetch all blocks for a page using the official Notion API.
 * Returns blocks in the same format as loadPageChunk (internal API).
 */
export async function loadPageBlocksOfficial(
  pageId: string,
  accessToken: string,
): Promise<Record<string, NotionBlock>> {
  const allBlocks: Record<string, NotionBlock> = {};

  async function fetchRecursive(parentId: string): Promise<string[]> {
    const children = await fetchBlockChildren(parentId, accessToken);
    const childIds: string[] = [];

    for (const child of children) {
      const translated = translateBlock(child);
      allBlocks[translated.id] = translated;
      childIds.push(translated.id);

      // Recursively fetch children if they exist
      if (child.has_children) {
        const grandchildIds = await fetchRecursive(child.id);
        translated.content = grandchildIds;
      }
    }

    return childIds;
  }

  const topLevelIds = await fetchRecursive(pageId);

  // Create the page block itself
  const meta = await fetchPageMeta(pageId, accessToken);
  const normalizedId = normalizePageId(pageId);

  allBlocks[normalizedId] = {
    id: normalizedId,
    type: "page",
    alive: true,
    properties: {
      title: [[meta.title]],
    },
    content: topLevelIds,
    format: {
      page_icon: meta.icon,
      page_cover: meta.cover,
    },
  };

  return allBlocks;
}

/**
 * Fetch and parse a single page into PageData using the official Notion API.
 * Drop-in replacement for fetchPage() from api.ts.
 */
export async function fetchPageOfficial(
  pageId: string,
  accessToken: string,
  slug = "",
): Promise<PageData> {
  const id = normalizePageId(pageId);
  const blocks = await loadPageBlocksOfficial(id, accessToken);

  const pageBlock = blocks[id];
  if (!pageBlock) {
    throw new Error(`[official-api] Page block ${id} not found`);
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

/**
 * Search for pages shared with the integration.
 * Useful for auto-discovery after OAuth.
 */
export async function searchPages(
  accessToken: string,
  query = "",
): Promise<Array<{ id: string; title: string; icon?: string; url: string }>> {
  const url = `${NOTION_API}/search`;
  const res = await rateLimitedFetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`[official-api] Search failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    results: Array<Record<string, unknown>>;
  };

  return data.results.map((page) => {
    const properties = page.properties as Record<string, unknown> | undefined;
    let title = "Untitled";
    if (properties) {
      const titleProp = Object.values(properties).find(
        (p) => (p as { type?: string }).type === "title",
      ) as { title?: Array<{ plain_text: string }> } | undefined;
      if (titleProp?.title && titleProp.title.length > 0) {
        title = titleProp.title.map((t) => t.plain_text).join("");
      }
    }

    const iconData = page.icon as { type: string; emoji?: string } | null;
    const icon = iconData?.type === "emoji" ? iconData.emoji : undefined;

    return {
      id: normalizePageId(page.id as string),
      title,
      icon,
      url: page.url as string,
    };
  });
}
