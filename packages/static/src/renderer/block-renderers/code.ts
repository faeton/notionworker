import type { NotionBlock } from "../../types.js";
import type { ImageMap } from "../../fetcher/image-downloader.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderCodeBlock(
  block: NotionBlock,
  _childrenHtml: string,
  _imageMap?: ImageMap,
): string {
  const code = block.properties?.title?.map((seg) => seg[0]).join("") ?? "";
  const language = block.properties?.language?.[0]?.[0]?.toLowerCase() ?? "";
  const caption = block.properties?.caption?.map((seg) => seg[0]).join("") ?? "";
  const langClass = language ? ` class="language-${escapeHtml(language)}"` : "";

  return (
    `<pre><code${langClass}>${escapeHtml(code)}</code></pre>` +
    (caption ? `<div class="code-caption">${escapeHtml(caption)}</div>` : "") +
    "\n"
  );
}
