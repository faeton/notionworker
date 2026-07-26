import type { SiteConfig } from "../types.js";

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function handleNotionJs(
  url: URL,
  config: SiteConfig
): Promise<Response> {
  url.hostname = `${config.notionUsername}.notion.site`;

  const response = await fetch(url.toString());
  let body = await response.text();

  // Rewrite domain references in Notion's JS bundles
  body = body
    .replace(/www\.notion\.so/g, config.hostname)
    .replace(/notion\.so/g, config.hostname)
    .replace(
      new RegExp(`${escapeRegExp(config.notionUsername)}\\.notion\\.site`, "g"),
      config.hostname
    );

  // Build fresh headers: the body was decompressed by .text(), so the upstream
  // Content-Encoding/Content-Length headers no longer describe it
  return new Response(body, {
    status: response.status,
    headers: {
      "Content-Type": "application/x-javascript",
      "Cache-Control": response.headers.get("Cache-Control") ?? "public, max-age=3600",
    },
  });
}
