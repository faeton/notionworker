/**
 * Notion OAuth + API client wrapper.
 */

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

export interface NotionOAuthToken {
  access_token: string;
  token_type: string;
  bot_id: string;
  workspace_id: string;
  workspace_name: string;
  workspace_icon: string | null;
  owner: {
    type: string;
    user?: {
      id: string;
      name: string;
      avatar_url: string | null;
      person?: { email: string };
    };
  };
}

/** Build the Notion OAuth authorization URL */
export function getAuthorizationUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    owner: "user",
    state,
  });
  return `${NOTION_API}/oauth/authorize?${params}`;
}

/** Exchange authorization code for access token */
export async function exchangeCodeForToken(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<NotionOAuthToken> {
  const credentials = btoa(`${clientId}:${clientSecret}`);

  const res = await fetch(`${NOTION_API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion OAuth token exchange failed: ${res.status} ${text}`);
  }

  return (await res.json()) as NotionOAuthToken;
}

/** Search for pages shared with the integration (paginated, capped at 500) */
export async function searchPages(
  accessToken: string,
  query = "",
): Promise<Array<{ id: string; title: string; icon?: string; url: string; lastEdited: string }>> {
  const MAX_RESULTS = 500;
  const results: Record<string, unknown>[] = [];
  let cursor: string | null = null;

  do {
    const res = await fetch(`${NOTION_API}/search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Notion search failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      results: Record<string, unknown>[];
      has_more: boolean;
      next_cursor: string | null;
    };
    results.push(...data.results);
    cursor = data.has_more && results.length < MAX_RESULTS ? data.next_cursor : null;
  } while (cursor);

  return results.map((page) => {
    const properties = page.properties as Record<string, unknown> | undefined;
    let title = "Untitled";
    if (properties) {
      const titleProp = Object.values(properties).find(
        (p) => (p as { type?: string }).type === "title",
      ) as { title?: Array<{ plain_text: string }> } | undefined;
      if (titleProp?.title && titleProp.title.length > 0) {
        title = titleProp.title.map((t) => t.plain_text).join("");
      }
    }

    const iconData = page.icon as { type: string; emoji?: string } | null;
    const icon = iconData?.type === "emoji" ? iconData.emoji : undefined;

    return {
      id: (page.id as string).replace(/-/g, ""),
      title,
      icon,
      url: page.url as string,
      lastEdited: page.last_edited_time as string,
    };
  });
}

/**
 * Verify Notion webhook signature.
 * Notion sends `X-Notion-Signature: sha256=<hex HMAC-SHA256 of the raw body>`.
 */
export async function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const expected = `sha256=${hex}`;

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}
