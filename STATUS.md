# STATUS — archived 2026-07-26

## What
Notion-to-website proxy on Cloudflare Workers. Two modes: `worker.js` single-file proxy for one domain, and a `packages/` pnpm monorepo for a multi-tenant platform (proxy + api + web dashboard + renderer, backed by D1 + KV + R2). Was prepared for public release and passed an external codex/grok review (last two commits).

## State at archive time
- Git clean, main in sync with origin (git@github.com:faeton/notionworker.git).
- node_modules pruned (~239 MB).
- No known broken state; last work was release prep and review fixes.

## Why stopped
Inactive >90 days (cold since ~early 2026); archived as part of the Jul 2026 ~/Sites cleanup.

## How to revive
```bash
mv ~/Sites/_archive/notionworker ~/Sites/
cd ~/Sites/notionworker && pnpm install
cd packages/proxy && npx wrangler dev   # local dev
```
Deployment/bindings walkthrough is in CLAUDE.md and README.md. Requires Cloudflare D1/KV/R2 resources and, for platform mode, `NOTION_CLIENT_SECRET` / `NOTION_WEBHOOK_SECRET` via `wrangler secret put`.
