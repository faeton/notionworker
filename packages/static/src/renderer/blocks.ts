import type { NotionBlock } from "../types.js";
import type { ImageMap } from "../types.js";
import { renderTextBlock } from "./block-renderers/text.js";
import { renderListItem } from "./block-renderers/list.js";
import { renderMediaBlock } from "./block-renderers/media.js";
import { renderCodeBlock } from "./block-renderers/code.js";
import { renderLayoutBlock } from "./block-renderers/layout.js";
import { renderTableBlock } from "./block-renderers/table.js";

const TEXT_TYPES = new Set([
  "header", "sub_header", "sub_sub_header",
  "text", "quote", "divider", "callout",
]);
const LIST_TYPES = new Set(["bulleted_list", "numbered_list", "to_do"]);
const MEDIA_TYPES = new Set(["image", "bookmark", "video", "embed"]);
const LAYOUT_TYPES = new Set(["column_list", "column", "toggle"]);

/** Render children of a block recursively */
function renderChildren(
  childIds: string[] | undefined,
  blocks: Record<string, NotionBlock>,
  imageMap?: ImageMap,
): string {
  if (!childIds || childIds.length === 0) return "";
  return renderBlockList(childIds, blocks, imageMap);
}

/** Render a single block (without list grouping — that's handled by renderBlockList) */
function renderBlock(
  block: NotionBlock,
  blocks: Record<string, NotionBlock>,
  imageMap?: ImageMap,
): string {
  const childrenHtml = renderChildren(block.content, blocks, imageMap);

  if (TEXT_TYPES.has(block.type)) {
    return renderTextBlock(block, childrenHtml, imageMap);
  }
  if (LIST_TYPES.has(block.type)) {
    return renderListItem(block, childrenHtml, imageMap);
  }
  if (MEDIA_TYPES.has(block.type)) {
    return renderMediaBlock(block, childrenHtml, imageMap);
  }
  if (block.type === "code") {
    return renderCodeBlock(block, childrenHtml, imageMap);
  }
  if (LAYOUT_TYPES.has(block.type)) {
    return renderLayoutBlock(block, childrenHtml, imageMap);
  }
  if (block.type === "table") {
    return renderTableBlock(block, childrenHtml, imageMap, blocks);
  }

  // Sub-pages: render as a link
  if (block.type === "page") {
    const title = block.properties?.title?.map((seg) => seg[0]).join("") ?? "Untitled";
    const icon = block.format?.page_icon ?? "";
    return `<a href="/${block.id}" class="page-link">${icon ? icon + " " : ""}${escapeHtml(title)}</a>\n`;
  }

  // Unknown block type — skip silently
  return "";
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Render a list of block IDs, grouping consecutive list items */
export function renderBlockList(
  blockIds: string[],
  blocks: Record<string, NotionBlock>,
  imageMap?: ImageMap,
): string {
  let html = "";
  let i = 0;

  while (i < blockIds.length) {
    const block = blocks[blockIds[i]];
    if (!block) {
      i++;
      continue;
    }

    // Group consecutive list items of the same type
    if (LIST_TYPES.has(block.type)) {
      const listType = block.type;
      const wrapperTag =
        listType === "numbered_list" ? "ol" :
        listType === "to_do" ? "ul" :
        "ul";

      let items = "";
      while (i < blockIds.length) {
        const current = blocks[blockIds[i]];
        if (!current || current.type !== listType) break;
        items += renderBlock(current, blocks, imageMap);
        i++;
      }
      html += `<${wrapperTag}${listType === "to_do" ? ' class="to-do-list"' : ""}>${items}</${wrapperTag}>\n`;
      continue;
    }

    html += renderBlock(block, blocks, imageMap);
    i++;
  }

  return html;
}
