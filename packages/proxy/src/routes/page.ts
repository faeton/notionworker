import type { SiteConfig } from "../types.js";
import { applyRewriters } from "../rewriters/index.js";

export async function handlePage(
  request: Request,
  url: URL,
  config: SiteConfig
): Promise<Response> {
  url.hostname = `${config.notionUsername}.notion.site`;

  const response = await fetch(url.toString(), {
    body: request.body,
    headers: request.headers,
    method: request.method,
  });

  const newResponse = new Response(response.body, response);
  newResponse.headers.delete("Content-Security-Policy");
  newResponse.headers.delete("X-Content-Security-Policy");

  // Determine which page is being rendered for per-page meta
  const pathId = url.pathname.slice(1).slice(-32);
  const currentPage = config.pageMeta[pathId] || null;

  return applyRewriters(newResponse, config, currentPage);
}
