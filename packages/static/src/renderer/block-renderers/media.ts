import type { NotionBlock } from "../../types.js";
import type { ImageMap } from "../../types.js";
import { renderRichText, safeUrl } from "../rich-text.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve an image URL: use local path from imageMap if available */
function resolveImage(url: string, imageMap?: ImageMap): string {
  return imageMap?.get(url) ?? url;
}

export function renderMediaBlock(
  block: NotionBlock,
  _childrenHtml: string,
  imageMap?: ImageMap,
): string {
  switch (block.type) {
    case "image": {
      const src =
        block.properties?.source?.[0]?.[0] ??
        block.format?.display_source ??
        "";
      const caption = renderRichText(block.properties?.caption, imageMap);
      const resolved = resolveImage(src, imageMap);
      const width = block.format?.block_width;
      const widthAttr = width ? ` width="${width}"` : "";

      return (
        `<figure>` +
        `<img src="${escapeHtml(safeUrl(resolved))}" alt="${caption ? caption.replace(/<[^>]*>/g, "") : ""}" loading="lazy"${widthAttr}>` +
        (caption ? `<figcaption>${caption}</figcaption>` : "") +
        `</figure>\n`
      );
    }

    case "bookmark": {
      const url = block.properties?.link?.[0]?.[0] ?? "";
      const title = renderRichText(block.properties?.title, imageMap) || url;
      const description = renderRichText(block.properties?.description, imageMap);
      const cover = block.format?.bookmark_cover;

      return (
        `<a href="${escapeHtml(safeUrl(url))}" class="bookmark" target="_blank" rel="noopener">` +
        `<div class="bookmark-info">` +
        `<div class="bookmark-title">${title}</div>` +
        (description ? `<div class="bookmark-description">${description}</div>` : "") +
        `<div class="bookmark-url">${escapeHtml(url)}</div>` +
        `</div>` +
        (cover ? `<img class="bookmark-cover" src="${escapeHtml(safeUrl(resolveImage(cover, imageMap)))}" loading="lazy">` : "") +
        `</a>\n`
      );
    }

    case "video": {
      const src = block.properties?.source?.[0]?.[0] ?? block.format?.display_source ?? "";
      // Detect embed URLs (YouTube, Vimeo)
      if (/youtube\.com|youtu\.be|vimeo\.com/.test(src)) {
        return `<div class="video-embed"><iframe src="${escapeHtml(safeUrl(src))}" frameborder="0" allowfullscreen loading="lazy"></iframe></div>\n`;
      }
      return `<video src="${escapeHtml(safeUrl(src))}" controls></video>\n`;
    }

    case "embed": {
      const src = block.properties?.source?.[0]?.[0] ?? block.format?.display_source ?? "";
      return `<div class="embed"><iframe src="${escapeHtml(safeUrl(src))}" frameborder="0" loading="lazy"></iframe></div>\n`;
    }

    default:
      return "";
  }
}
