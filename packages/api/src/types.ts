export interface Env {
  DB: D1Database;
  CONTENT: R2Bucket;
  /** Same KV namespace as the proxy's SITE_CACHE — purged on config mutations */
  SITE_CACHE?: KVNamespace;
  R2_PUBLIC_URL: string;
  NOTION_CLIENT_ID: string;
  NOTION_CLIENT_SECRET: string;
  NOTION_REDIRECT_URI: string;
  /** Dashboard URL — OAuth callback redirect target and the only CORS origin */
  DASHBOARD_URL?: string;
  /** Parent domain for the session cookie (e.g. ".bl3s.com") so the dashboard subdomain receives it */
  COOKIE_DOMAIN?: string;
  NOTION_WEBHOOK_SECRET?: string;
  CF_API_TOKEN?: string;
  CF_ZONE_ID?: string;
}

export interface SessionUser {
  userId: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}
