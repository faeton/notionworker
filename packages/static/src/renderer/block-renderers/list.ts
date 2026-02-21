import type { NotionBlock } from "../../types.js";
import type { ImageMap } from "../../fetcher/image-downloader.js";
import { renderRichText } from "../rich-text.js";

/** Render a single list item (without wrapper <ul>/<ol>) */
export function renderListItem(
  block: NotionBlock,
  childrenHtml: string,
  imageMap?: ImageMap,
): string {
  const content = renderRichText(block.properties?.title, imageMap);

  switch (block.type) {
    case "bulleted_list":
      return `<li>${content}${childrenHtml}</li>\n`;

    case "numbered_list":
      return `<li>${content}${childrenHtml}</li>\n`;

    case "to_do": {
      const checked = block.properties?.checked?.[0]?.[0] === "Yes";
      return (
        `<li class="to-do">` +
        `<input type="checkbox" disabled${checked ? " checked" : ""}> ` +
        `${content}${childrenHtml}` +
        `</li>\n`
      );
    }

    default:
      return "";
  }
}
