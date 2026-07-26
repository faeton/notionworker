import type { NotionBlock } from "../../types.js";
import type { ImageMap } from "../../types.js";
import { renderRichText } from "../rich-text.js";

export function renderLayoutBlock(
  block: NotionBlock,
  childrenHtml: string,
  _imageMap?: ImageMap,
): string {
  switch (block.type) {
    case "column_list":
      return `<div class="column-list">${childrenHtml}</div>\n`;

    case "column": {
      const ratio = block.format?.column_ratio ?? 1;
      return `<div class="column" style="flex:${ratio}">${childrenHtml}</div>\n`;
    }

    case "toggle": {
      const summary = renderRichText(block.properties?.title);
      return (
        `<details>` +
        `<summary>${summary}</summary>` +
        `<div class="toggle-content">${childrenHtml}</div>` +
        `</details>\n`
      );
    }

    default:
      return "";
  }
}
