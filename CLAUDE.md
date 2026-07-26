# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**notionworker** — a multi-tenant Notion-to-website proxy on Cloudflare Workers. Proxies Notion pages through custom domains with per-site themes (CSS variables, Google Fonts, custom CSS), per-page SEO meta, URL slugs, navigation, and sitemap generation.

## Architecture

### Monorepo Structure (pnpm workspaces + Turborepo)

```
worker.js              — legacy single-file proxy (kept for reference)
packages/
  db/                  — Drizzle ORM schemas + D1 migrations
    src/schema/        — platform_domains, users, sessions, sites, pages, domains, themes
    drizzle/           — SQL migrations (0000_init, 0001_users)
    seed.sql           — test data for smoke testing
  static/              — Notion block renderer + image pipeline (CLI + library)
    src/fetcher/       — internal API, official API adapter, image download (fs + R2)
    src/renderer/      — block/rich-text → HTML
    src/template/      — page HTML, CSS, sitemap, robots
  renderer/            — render pipeline: fetch → render → R2 (orchestrates static + db)
  api/                 — Hono API worker (api.bl3s.com)
    src/routes/        — auth (Notion OAuth), sites, pages, themes, domains, publish, webhooks
    src/lib/           — notion client, sessions, util (ownership check, KV cache purge)
  web/                 — dashboard worker (app.bl3s.com), server-rendered HTML, calls api
  proxy/               — public-facing Cloudflare Worker (TypeScript modules)
    src/
      index.ts         — fetch handler, route dispatch
      config.ts        — loadConfigFromD1(hostname, db) with platform domain resolution
      cache.ts         — 3-layer cache: memory (5min) → KV (1hr) → D1
      types.ts         — SiteConfig, ThemeConfig, PageConfig interfaces
      routes/
        robots.ts      — /robots.txt
        sitemap.ts     — /sitemap.xml
        notion-api.ts  — /api/* forwarding
        notion-js.ts   — /app/*.js domain rewriting
        page.ts        — R2 static fast path → live Notion proxy fallback + HTMLRewriter
      rewriters/
        index.ts       — applyRewriters() orchestration
        meta.ts        — per-page SEO: title, description, og:*, twitter:*
        head.ts        — CSS variables, Google Font, base styles, topbar hiding, custom CSS/HTML
        body.ts        — navigation bar, slug URL rewriting JS, dark mode toggle, XHR rewriting
    wrangler.toml      — D1 + KV + R2 bindings
scripts/
  smoke-test.sh        — curl-based smoke tests for deployed proxy
```

### Request Flow

`fetch()` → `getSiteConfig(hostname)` [memory → KV → D1] → route dispatch → fetch from Notion → `applyRewriters()` (HTMLRewriter pipeline)

### Hostname Resolution (config.ts)

1. Custom domain lookup: `domains` table WHERE `hostname = ?`
2. Platform subdomain: split hostname → `sites` JOIN `platform_domains` WHERE `subdomain = ? AND domain = ?`

### D1 Schema

7 tables: `platform_domains`, `users`, `sessions`, `sites`, `pages`, `domains`, `themes`

- `platform_domains` — registered platform domains (bl3s.com, ez.mt)
- `users` — Notion OAuth users (access token, workspace)
- `sessions` — cookie-based auth sessions (30-day TTL, random 256-bit IDs)
- `sites` — each site has a subdomain on a platform domain + notion_username
- `pages` — per-site page mappings (slug ↔ notion_page_id) with individual SEO meta
- `domains` — custom domain → site linkage
- `themes` — per-site visual config (fonts, colors, CSS, navigation)

### 3-Layer Cache (cache.ts)

```
Memory Map (5min TTL) → KV namespace (1hr TTL) → D1 query
```

Cache key: `site:{hostname}`. On miss, each layer populates the layers above it.

### Theme System (CSS Variables)

Theme config maps to CSS custom properties injected into `<head>`:
```
--nw-font, --nw-font-size, --nw-max-width, --nw-accent
--nw-bg, --nw-text, --nw-text-secondary, --nw-border
```

Color mode supports: `light`, `dark`, `system` (via `prefers-color-scheme` media query).

User custom CSS is injected after theme CSS for override capability.

## Key Patterns

- API route handlers must check site ownership via `getOwnedSite(db, siteId, userId)` (packages/api/src/lib/util.ts) and call `purgeSiteCache(env, siteId)` after any mutation that changes what the proxy serves
- Never spread a raw request body into a Drizzle `.set()`/`.values()` — whitelist fields explicitly (`plan`, `userId` etc. must not be client-writable)
- API secrets (`NOTION_CLIENT_SECRET`, `NOTION_WEBHOOK_SECRET`) go in `wrangler secret put`, never in `[vars]`

- All config flows through `SiteConfig` interface (not global variables)
- HTMLRewriter classes receive config via constructor
- Per-page meta: `MetaRewriter` receives `currentPage: PageConfig | null`, falls back to site-level
- Navigation bar: injected as HTML by `BodyRewriter`, styled by `HeadRewriter`
- Client-side JS handles slug rewriting via history API interception + XHR domain rewriting
- `www.` prefix stripped from hostname before config lookup

## Deployment

```bash
# Create D1 database
wrangler d1 create notionworker-db

# Create KV namespace
wrangler kv namespace create SITE_CACHE

# Update wrangler.toml with IDs from above commands

# Apply schema
wrangler d1 execute notionworker-db --file=../db/drizzle/0000_init.sql

# Seed test data
wrangler d1 execute notionworker-db --file=../db/seed.sql

# Deploy
cd packages/proxy && wrangler deploy

# Smoke test
./scripts/smoke-test.sh https://testsite.bl3s.com
```

## Commands

- `pnpm install` — install all workspace dependencies
- `cd packages/proxy && npx wrangler dev` — local dev server
- `cd packages/proxy && npx wrangler deploy` — deploy to Cloudflare
- `cd packages/proxy && npx wrangler deploy --dry-run --outdir=dist` — verify bundle
- `cd packages/db && npx drizzle-kit generate` — generate migration from schema changes
- `./scripts/smoke-test.sh [url]` — run smoke tests
