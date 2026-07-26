import type { NotionBlock } from "../../types.js";
import type { ImageMap } from "../../types.js";
import { renderRichText } from "../rich-text.js";

/** Render text-like blocks: header, sub_header, sub_sub_header, text, quote, divider, callout */
export function renderTextBlock(
  block: NotionBlock,
  childrenHtml: string,
  imageMap?: ImageMap,
): string {
  const content = renderRichText(block.properties?.title, imageMap);
  const color = block.format?.block_color;
  const colorAttr = color ? ` class="${colorClass(color)}"` : "";

  switch (block.type) {
    case "header":
      return `<h1${colorAttr}>${content}</h1>\n${childrenHtml}`;

    case "sub_header":
      return `<h2${colorAttr}>${content}</h2>\n${childrenHtml}`;

    case "sub_sub_header":
      return `<h3${colorAttr}>${content}</h3>\n${childrenHtml}`;

    case "text":
      if (!content && !childrenHtml) return `<div class="spacer"></div>\n`;
      return `<p${colorAttr}>${content}</p>\n${childrenHtml}`;

    case "quote":
      return `<blockquote${colorAttr}>${content}${childrenHtml}</blockquote>\n`;

    case "divider":
      return `<hr>\n`;

    case "callout": {
      const icon = block.format?.page_icon ?? "";
      return (
        `<div class="callout"${colorAttr ? ` ${colorAttr}` : ""}>` +
        (icon ? `<span class="callout-icon">${icon}</span>` : "") +
        `<div class="callout-content">${content}${childrenHtml}</div>` +
        `</div>\n`
      );
    }

    default:
      return "";
  }
}

function colorClass(color: string): string {
  return `notion-${color.replace(/_/g, "-")}`;
}
