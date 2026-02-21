import type { PageData } from "../types.js";
import { fetchPage, normalizePageId } from "./api.js";

/** Slugify a page title for URL use */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Find sub-page IDs referenced in a page's content */
function findSubPages(page: PageData): string[] {
  const subPages: string[] = [];

  for (const blockId of page.contentIds) {
    const block = page.blocks[blockId];
    if (!block) continue;

    // Direct child pages
    if (block.type === "page") {
      subPages.push(blockId);
      continue;
    }

    // Page links in rich text (decoration type "p")
    const title = block.properties?.title;
    if (title) {
      for (const segment of title) {
        if (segment.length < 2) continue;
        const decorations = segment[1];
        if (!decorations) continue;
        for (const dec of decorations) {
          if (dec[0] === "p" && dec[1]) {
            try {
              subPages.push(normalizePageId(dec[1]));
            } catch {
              // Invalid ID, skip
            }
          }
        }
      }
    }
  }

  return subPages;
}

/**
 * Crawl pages starting from a root, discovering sub-pages via BFS.
 * Returns all discovered pages.
 */
export async function crawlPages(
  rootPageId: string,
  recursive: boolean,
): Promise<PageData[]> {
  const pages: PageData[] = [];
  const visited = new Set<string>();
  const queue: Array<{ id: string; slug: string }> = [
    { id: rootPageId, slug: "" },
  ];

  while (queue.length > 0) {
    const { id, slug } = queue.shift()!;
    const normalizedId = normalizePageId(id);

    if (visited.has(normalizedId)) continue;
    visited.add(normalizedId);

    console.log(`Fetching: ${normalizedId} (/${slug || "index"})`);
    const page = await fetchPage(normalizedId, slug);
    pages.push(page);

    if (recursive) {
      const subPageIds = findSubPages(page);
      for (const subId of subPageIds) {
        if (!visited.has(subId)) {
          const subBlock = page.blocks[subId];
          const subTitle = subBlock?.properties?.title
            ?.map((seg) => seg[0])
            .join("") ?? subId;
          queue.push({ id: subId, slug: slugify(subTitle) });
        }
      }
    }
  }

  return pages;
}
