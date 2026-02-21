import type { SiteConfig } from "../types.js";

const SPOOFED_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36";

export async function handleNotionApi(
  request: Request,
  url: URL,
  config: SiteConfig
): Promise<Response> {
  url.hostname = `${config.notionUsername}.notion.site`;

  const isGetPublicPageData = url.pathname.startsWith("/api/v3/getPublicPageData");

  const response = await fetch(url.toString(), {
    body: isGetPublicPageData ? null : request.body,
    headers: {
      "content-type": "application/json;charset=UTF-8",
      "user-agent": SPOOFED_UA,
    },
    method: "POST",
  });

  const newResponse = new Response(response.body, response);
  newResponse.headers.set("Access-Control-Allow-Origin", "*");
  return newResponse;
}
