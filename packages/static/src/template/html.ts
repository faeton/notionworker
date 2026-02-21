import type { PageData, SiteConfig } from "../types.js";
import type { ImageMap } from "../fetcher/image-downloader.js";
import { renderBlockList } from "../renderer/blocks.js";
import { generateCss } from "./css.js";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isUrl(str: string): boolean {
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("/");
}

function resolveImage(url: string, imageMap?: ImageMap): string {
  return imageMap?.get(url) ?? url;
}

export function renderPage(
  page: PageData,
  config: SiteConfig,
  imageMap?: ImageMap,
): string {
  const title = config.title && page.slug === ""
    ? config.title
    : page.title;
  const description = config.description ?? "";
  const css = generateCss(config.font);
  const canonical = config.baseUrl
    ? `${config.baseUrl}${page.slug ? `/${page.slug}/` : "/"}`
    : undefined;

  const bodyHtml = renderBlockList(page.contentIds, page.blocks, imageMap);

  const iconIsUrl = page.icon ? isUrl(page.icon) : false;
  const titleText = page.icon && !iconIsUrl ? `${page.icon} ${title}` : title;
  const iconHtml = page.icon
    ? iconIsUrl
      ? `<div class="page-icon"><img src="${escapeHtml(resolveImage(page.icon, imageMap))}" alt="" class="page-icon-img"></div>`
      : `<div class="page-icon">${page.icon}</div>`
    : "";

  const coverHtml = page.cover
    ? `<div class="page-cover"><img src="${escapeHtml(resolveImage(page.cover, imageMap))}" alt=""${
        page.coverPosition != null ? ` style="object-position:center ${page.coverPosition * 100}%"` : ""
      }></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(titleText)}</title>
${description ? `<meta name="description" content="${escapeHtml(description)}">` : ""}
<meta property="og:title" content="${escapeHtml(title)}">
${description ? `<meta property="og:description" content="${escapeHtml(description)}">` : ""}
<meta property="og:type" content="website">
${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}">` : ""}
<style>
${css}
</style>
</head>
<body>
${coverHtml}
<div class="page">
<div class="page-header">
${iconHtml}
<h1 class="page-title">${escapeHtml(page.title)}</h1>
</div>
${bodyHtml}
</div>
</body>
</html>`;
}
