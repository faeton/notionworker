#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { SiteConfig } from "./types.js";
import { parseNotionUrl } from "./fetcher/api.js";
import { crawlPages } from "./fetcher/crawler.js";
import { downloadImages } from "./fetcher/image-downloader.js";
import { renderPage } from "./template/html.js";
import { generateSitemap } from "./template/sitemap.js";
import { generateRobots } from "./template/robots.js";

function printUsage(): void {
  console.log(`Usage: notion-static <notion-url-or-page-id> [options]

Options:
  --output, -o     Output directory (default: ./dist)
  --base-url       Base URL for sitemap/canonical links
  --username, -u   Notion username (auto-detected from URL)
  --recursive, -r  Follow sub-page links
  --no-images      Skip image downloading
  --font           Google Font name
  --title          Site title override
  --description    Site description
  --help, -h       Show this help`);
}

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      output: { type: "string", short: "o", default: "./dist" },
      "base-url": { type: "string" },
      username: { type: "string", short: "u" },
      recursive: { type: "boolean", short: "r", default: false },
      "no-images": { type: "boolean", default: false },
      font: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help || positionals.length === 0) {
    printUsage();
    process.exit(values.help ? 0 : 1);
  }

  const input = positionals[0];
  const { pageId, username: detectedUsername } = parseNotionUrl(input);

  const config: SiteConfig = {
    username: (values.username ?? detectedUsername) || "www",
    outputDir: values.output!,
    baseUrl: values["base-url"],
    title: values.title,
    description: values.description,
    font: values.font,
    recursive: values.recursive!,
    downloadImages: !values["no-images"],
  };

  console.log(`Generating static site from page: ${pageId}`);
  console.log(`Output: ${config.outputDir}`);

  // 1. Crawl pages
  const pages = await crawlPages(pageId, config.recursive);
  console.log(`Found ${pages.length} page(s)`);

  // 2. Download images
  let imageMap;
  if (config.downloadImages) {
    imageMap = await downloadImages(pages, config.outputDir);
    if (imageMap.size > 0) {
      console.log(`Downloaded ${imageMap.size} image(s)`);
    }
  }

  // 3. Render HTML pages
  await mkdir(config.outputDir, { recursive: true });

  for (const page of pages) {
    const html = renderPage(page, config, imageMap);
    const dir = page.slug
      ? join(config.outputDir, page.slug)
      : config.outputDir;

    await mkdir(dir, { recursive: true });
    const filePath = join(dir, "index.html");
    await writeFile(filePath, html, "utf-8");
    console.log(`Wrote: ${filePath}`);
  }

  // 4. Generate robots.txt
  const robotsTxt = generateRobots(config.baseUrl);
  await writeFile(join(config.outputDir, "robots.txt"), robotsTxt, "utf-8");
  console.log(`Wrote: ${join(config.outputDir, "robots.txt")}`);

  // 5. Generate sitemap.xml (only if baseUrl is set)
  if (config.baseUrl) {
    const sitemap = generateSitemap(pages, config.baseUrl);
    await writeFile(join(config.outputDir, "sitemap.xml"), sitemap, "utf-8");
    console.log(`Wrote: ${join(config.outputDir, "sitemap.xml")}`);
  }

  console.log("Done!");
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
