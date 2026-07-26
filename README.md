# notionworker

Host Notion pages as fast websites on your own domains, running entirely on Cloudflare Workers.

Point a domain at the worker, map slugs to Notion pages, and get a clean website with custom fonts, dark mode, SEO meta tags, sitemaps, and navigation — no servers, no build pipeline to babysit.

There are two ways to use this project:

| | Best for | What you deploy |
|---|---|---|
| **[Single-site proxy](#single-site-proxy-simple)** | Your own site on one domain | `worker.js`, one file |
| **[Multi-tenant platform](#multi-tenant-platform)** | Hosting many sites/users, SaaS-style | The `packages/` monorepo (3 workers + D1 + KV + R2) |

## Features

- **Custom domains** — serve Notion pages from any domain you control
- **URL slugs** — `/about` instead of `/1a2b3c4d…` page IDs
- **Per-page SEO** — title, description, Open Graph and Twitter meta per page
- **Theming** — Google Fonts, accent colors, max width, custom CSS/HTML, light/dark/system color mode
- **Navigation bar** — configurable links injected into every page
- **Sitemap & robots.txt** — generated automatically
- **Static pre-rendering** (platform mode) — pages render to HTML in R2 and are served from the edge, with live proxying as fallback
- **Notion OAuth dashboard** (platform mode) — users connect their Notion workspace, pick pages, publish
- **Webhooks** (platform mode) — Notion page edits trigger automatic re-renders

## Single-site proxy (simple)

`worker.js` is a self-contained Cloudflare Worker. Set `MY_NOTION_USERNAME` to your Notion username, deploy, then either:

1. **KV config**: create a KV namespace `DOMAINS_CONFIG` and add a JSON config per hostname:

```json
{
  "SLUG_TO_PAGE": {
    "": "homepage-notion-page-id",
    "about": "about-page-notion-id"
  },
  "PAGE_TITLE": "Your Site Title",
  "PAGE_DESCRIPTION": "Your site description",
  "GOOGLE_FONT": "Inter",
  "CUSTOM_SCRIPT": ""
}
```

2. **Hardcoded config**: uncomment and fill the `manualConfig` object at the top of `worker.js` — no KV needed.

Then add your domain to Cloudflare and route it to the worker.

## Multi-tenant platform

A pnpm/Turborepo monorepo of three Workers plus shared packages:

```
packages/
  proxy/      public-facing worker: serves sites (R2 static fast path → live Notion proxy fallback)
  api/        Hono API: Notion OAuth, sessions, CRUD for sites/pages/themes/domains, publish, webhooks
  web/        dashboard: server-rendered HTML, talks to the api worker
  renderer/   render pipeline: fetch Notion → render HTML → upload to R2
  static/     Notion block renderer + image pipeline (also usable standalone as a CLI static-site generator)
  db/         Drizzle ORM schemas + D1 migrations
```

**Request flow:** visitor hits `proxy` → site config resolved by hostname (memory → KV → D1 cache) → pre-rendered HTML served from R2, or the Notion page is fetched live and rewritten via HTMLRewriter.

**Publishing flow:** user connects Notion via OAuth in `web` → picks pages → `api` renders them through `renderer` into R2 → `proxy` serves the static copies. Notion webhooks re-render pages on edit.

### Setup

Prerequisites: a Cloudflare account, `wrangler` logged in, `pnpm`, and (for OAuth) a [Notion public integration](https://developers.notion.com/docs/authorization).

```bash
pnpm install

# 1. Create resources
wrangler d1 create notionworker-db
wrangler kv namespace create SITE_CACHE
wrangler r2 bucket create notionworker-content

# 2. Fill in the IDs
#    packages/proxy/wrangler.toml  — D1 id, KV id (R2 bucket name is preset)
#    packages/api/wrangler.toml    — D1 id, KV id (must be the SAME KV namespace as proxy),
#                                    plus your domains in [vars]
#    packages/web/wrangler.toml    — API_BASE_URL

# 3. Apply schema
cd packages/proxy
wrangler d1 execute notionworker-db --remote --file=../db/drizzle/0000_init.sql
wrangler d1 execute notionworker-db --remote --file=../db/drizzle/0001_users.sql
wrangler d1 execute notionworker-db --remote --file=../db/drizzle/0002_last_published.sql
# optional test data:
wrangler d1 execute notionworker-db --remote --file=../db/seed.sql

# 4. Secrets (api worker)
cd ../api
wrangler secret put NOTION_CLIENT_SECRET     # from your Notion integration
wrangler secret put NOTION_WEBHOOK_SECRET    # Notion webhook verification token

# 5. Deploy all three workers
cd ../proxy && npx wrangler deploy
cd ../api   && npx wrangler deploy
cd ../web   && npx wrangler deploy
```

**DNS:** route your platform domain's wildcard (e.g. `*.example.com`) to the `proxy` worker, and pick subdomains for `api` and the dashboard (e.g. `api.example.com`, `app.example.com`) matching the `[vars]` in the wrangler configs. Custom customer domains use [Cloudflare for SaaS custom hostnames](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/) (set `CF_API_TOKEN` / `CF_ZONE_ID`).

**Notion OAuth:** create a public integration, set the redirect URI to `https://api.<your-domain>/auth/callback`, and put the client ID in `packages/api/wrangler.toml`.

### Development

```bash
pnpm install
cd packages/proxy && npx wrangler dev        # local dev server
cd packages/api && npx tsc --noEmit          # typecheck
cd packages/db && npx drizzle-kit generate   # generate migration from schema changes
./scripts/smoke-test.sh https://yoursite.example.com   # smoke-test a deployed site
```

## Status

Functional and typechecked, but young — it has not seen heavy production traffic. Review the code (especially `packages/api`) before hosting other people's content, and open issues/PRs for anything you find.

Known limitations:

- **No domain-ownership verification** — adding a custom domain doesn't require proving you control it (e.g. a TXT-record challenge). Until that exists, treat custom-domain onboarding as trusted-users-only.
- **No automated test suite yet** — only `scripts/smoke-test.sh` against a deployed site.
- **Config edits can stay cached up to ~1 minute** on warm proxy isolates (in-memory layer); the KV layer is purged immediately.
- **No billing integration** — the `plan` column gates custom domains but nothing sets it yet.

## Contributing

Contributions are welcome! Feel free to submit pull requests for new features, improvements, or bug fixes.

## License

[MIT](LICENSE)
