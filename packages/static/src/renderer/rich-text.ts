import type { Decoration, RichText } from "../types.js";
import type { ImageMap } from "../fetcher/image-downloader.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Convert newlines to <br> tags */
function nl2br(text: string): string {
  return text.replace(/\n/g, "<br>");
}

/** Map Notion color names to CSS classes */
function colorToClass(color: string): string {
  // Colors: gray, brown, orange, yellow, green, blue, purple, pink, red
  // Backgrounds: gray_background, brown_background, etc.
  return `notion-${color.replace(/_/g, "-")}`;
}

/** Render a single rich text segment with its decorations */
function renderSegment(text: string, decorations?: Decoration[], imageMap?: ImageMap): string {
  let html = nl2br(escapeHtml(text));

  if (!decorations || decorations.length === 0) return html;

  // Apply decorations inside-out
  for (const dec of decorations) {
    switch (dec[0]) {
      case "b":
        html = `<strong>${html}</strong>`;
        break;
      case "i":
        html = `<em>${html}</em>`;
        break;
      case "_":
        html = `<u>${html}</u>`;
        break;
      case "s":
        html = `<s>${html}</s>`;
        break;
      case "c":
        html = `<code>${html}</code>`;
        break;
      case "a":
        html = `<a href="${escapeHtml(dec[1] ?? "")}">${html}</a>`;
        break;
      case "h":
        html = `<span class="${colorToClass(dec[1] ?? "")}">${html}</span>`;
        break;
      case "e":
        // Inline equation — render as code for now (no KaTeX dependency)
        html = `<code class="equation">${escapeHtml(dec[1] ?? "")}</code>`;
        break;
      case "p":
        // Page mention — render as link (ID only, resolver can update later)
        html = `<a href="/${dec[1] ?? ""}">${html}</a>`;
        break;
    }
  }

  return html;
}

/** Render a full rich text array to HTML */
export function renderRichText(richText?: RichText, imageMap?: ImageMap): string {
  if (!richText) return "";
  return richText
    .map((segment) => renderSegment(segment[0], segment[1] as Decoration[] | undefined, imageMap))
    .join("");
}
