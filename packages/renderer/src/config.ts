/**
 * Configuration bridge: loads site config from D1 and adapts it
 * for the static renderer.
 */
import { eq } from "drizzle-orm";
import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { sites, pages, themes } from "@notionworker/db";
import type { SiteConfig as StaticSiteConfig } from "@notionworker/static";

/** Page config as stored in D1 */
export interface PageEntry {
  notionPageId: string;
  slug: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  isHomepage: boolean;
}

/** Theme config as stored in D1 */
export interface ThemeEntry {
  googleFont: string | null;
  fontSize: string | null;
  colorMode: string;
  accentColor: string | null;
  maxWidth: string | null;
  hideTopbar: boolean;
  faviconUrl: string | null;
  customCss: string | null;
  customHeadHtml: string | null;
  customBodyHtml: string | null;
  showNavigation: boolean;
  navigationLinks: string | null;
}

/** Full site config for the renderer */
export interface RenderSiteConfig {
  siteId: string;
  siteName: string;
  notionUsername: string;
  hostname: string;
  pages: PageEntry[];
  theme: ThemeEntry | null;
}

/** Load site config from D1 for rendering */
export async function loadRenderConfig(
  siteId: string,
  db: D1Database,
): Promise<RenderSiteConfig> {
  const d1 = drizzle(db);

  const [site] = await d1.select().from(sites).where(eq(sites.id, siteId)).limit(1);
  if (!site) {
    throw new Error(`Site ${siteId} not found`);
  }

  const sitePages = await d1.select().from(pages).where(eq(pages.siteId, siteId));

  const [siteTheme] = await d1.select().from(themes).where(eq(themes.siteId, siteId)).limit(1);

  return {
    siteId: site.id,
    siteName: site.name,
    notionUsername: site.notionUsername,
    hostname: "", // Will be resolved when needed
    pages: sitePages.map((p) => ({
      notionPageId: p.notionPageId,
      slug: p.slug,
      title: p.title,
      description: p.description,
      ogImage: p.ogImage,
      isHomepage: p.isHomepage,
    })),
    theme: siteTheme
      ? {
          googleFont: siteTheme.googleFont,
          fontSize: siteTheme.fontSize,
          colorMode: siteTheme.colorMode ?? "system",
          accentColor: siteTheme.accentColor,
          maxWidth: siteTheme.maxWidth,
          hideTopbar: siteTheme.hideTopbar,
          faviconUrl: siteTheme.faviconUrl,
          customCss: siteTheme.customCss,
          customHeadHtml: siteTheme.customHeadHtml,
          customBodyHtml: siteTheme.customBodyHtml,
          showNavigation: siteTheme.showNavigation,
          navigationLinks: siteTheme.navigationLinks,
        }
      : null,
  };
}

/** Convert RenderSiteConfig to the static package's SiteConfig format */
export function buildRenderConfig(config: RenderSiteConfig): StaticSiteConfig {
  return {
    username: config.notionUsername,
    outputDir: "", // Not used for R2 rendering
    baseUrl: config.hostname ? `https://${config.hostname}` : undefined,
    title: config.siteName,
    font: config.theme?.googleFont ?? undefined,
    recursive: false,
    downloadImages: false, // Images handled separately via R2
  };
}
