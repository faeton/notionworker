import type { SiteConfig } from "../types.js";

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
      new RegExp(`${config.notionUsername}\\.notion\\.site`, "g"),
      config.hostname
    );

  return new Response(body, {
    ...response,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      "Content-Type": "application/x-javascript",
    },
  });
}
