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
    src/schema/        — platform_domains, sites, pages, domains, themes
    drizzle/           — SQL migrations
    seed.sql           — test data for smoke testing
  proxy/               — Cloudflare Worker (TypeScript modules)
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
        page.ts        — default page fetch + HTMLRewriter
      rewriters/
        index.ts       — applyRewriters() orchestration
        meta.ts        — per-page SEO: title, description, og:*, twitter:*
        head.ts        — CSS variables, Google Font, base styles, topbar hiding, custom CSS/HTML
        body.ts        — navigation bar, slug URL rewriting JS, dark mode toggle, XHR rewriting
    wrangler.toml      — D1 + KV bindings
scripts/
  smoke-test.sh        — curl-based smoke tests for deployed proxy
```

### Request Flow

`fetch()` → `getSiteConfig(hostname)` [memory → KV → D1] → route dispatch → fetch from Notion → `applyRewriters()` (HTMLRewriter pipeline)

### Hostname Resolution (config.ts)

1. Custom domain lookup: `domains` table WHERE `hostname = ?`
2. Platform subdomain: split hostname → `sites` JOIN `platform_domains` WHERE `subdomain = ? AND domain = ?`

### D1 Schema

5 tables: `platform_domains`, `sites`, `pages`, `domains`, `themes`

- `platform_domains` — registered platform domains (bl3s.com, ez.mt)
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
