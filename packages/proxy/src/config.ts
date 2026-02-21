import type { SiteConfig, PageConfig, ThemeConfig, NavigationLink } from "./types.js";

/**
 * Resolves a hostname to a SiteConfig by querying D1.
 *
 * Hostname resolution order:
 * 1. Custom domain lookup (domains table)
 * 2. Platform subdomain lookup (e.g., testsite.bl3s.com → subdomain "testsite" on platform domain "bl3s.com")
 */
export async function loadConfigFromD1(
  hostname: string,
  db: D1Database
): Promise<SiteConfig | null> {
  // Try custom domain first
  const customDomainResult = await db
    .prepare(
      `SELECT s.id as site_id, s.name as site_name, s.notion_username, d.hostname
       FROM domains d
       JOIN sites s ON d.site_id = s.id
       WHERE d.hostname = ? AND d.status = 'active' AND s.is_public = 1`
    )
    .bind(hostname)
    .first<{
      site_id: string;
      site_name: string;
      notion_username: string;
      hostname: string;
    }>();

  if (customDomainResult) {
    return buildSiteConfig(
      customDomainResult.site_id,
      customDomainResult.site_name,
      customDomainResult.notion_username,
      hostname,
      db
    );
  }

  // Try platform subdomain: extract subdomain and parent domain
  const dotIndex = hostname.indexOf(".");
  if (dotIndex === -1) return null;

  const subdomain = hostname.slice(0, dotIndex);
  const parentDomain = hostname.slice(dotIndex + 1);

  const subdomainResult = await db
    .prepare(
      `SELECT s.id as site_id, s.name as site_name, s.notion_username
       FROM sites s
       JOIN platform_domains pd ON s.platform_domain_id = pd.id
       WHERE s.subdomain = ? AND pd.domain = ? AND pd.is_active = 1 AND s.is_public = 1`
    )
    .bind(subdomain, parentDomain)
    .first<{
      site_id: string;
      site_name: string;
      notion_username: string;
    }>();

  if (!subdomainResult) return null;

  return buildSiteConfig(
    subdomainResult.site_id,
    subdomainResult.site_name,
    subdomainResult.notion_username,
    hostname,
    db
  );
}

async function buildSiteConfig(
  siteId: string,
  siteName: string,
  notionUsername: string,
  hostname: string,
  db: D1Database
): Promise<SiteConfig> {
  // Fetch pages and theme in parallel
  const [pagesResult, themeResult] = await Promise.all([
    db
      .prepare(
        `SELECT notion_page_id, slug, title, description, og_image, is_homepage, sort_order
         FROM pages WHERE site_id = ? ORDER BY sort_order ASC`
      )
      .bind(siteId)
      .all<{
        notion_page_id: string;
        slug: string;
        title: string | null;
        description: string | null;
        og_image: string | null;
        is_homepage: number;
        sort_order: number;
      }>(),
    db
      .prepare(
        `SELECT google_font, font_size, color_mode, accent_color, max_width,
                hide_topbar, favicon_url, custom_css, custom_head_html,
                custom_body_html, show_navigation, navigation_links
         FROM themes WHERE site_id = ?`
      )
      .bind(siteId)
      .first<{
        google_font: string | null;
        font_size: string | null;
        color_mode: string | null;
        accent_color: string | null;
        max_width: string | null;
        hide_topbar: number;
        favicon_url: string | null;
        custom_css: string | null;
        custom_head_html: string | null;
        custom_body_html: string | null;
        show_navigation: number;
        navigation_links: string | null;
      }>(),
  ]);

  const pages: PageConfig[] = (pagesResult.results || []).map((row) => ({
    notionPageId: row.notion_page_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    ogImage: row.og_image,
    isHomepage: row.is_homepage === 1,
  }));

  let navLinks: NavigationLink[] = [];
  if (themeResult?.navigation_links) {
    try {
      navLinks = JSON.parse(themeResult.navigation_links);
    } catch {
      navLinks = [];
    }
  }

  const theme: ThemeConfig = themeResult
    ? {
        googleFont: themeResult.google_font,
        fontSize: themeResult.font_size,
        colorMode: (themeResult.color_mode as ThemeConfig["colorMode"]) || "system",
        accentColor: themeResult.accent_color,
        maxWidth: themeResult.max_width,
        hideTopbar: themeResult.hide_topbar === 1,
        faviconUrl: themeResult.favicon_url,
        customCss: themeResult.custom_css,
        customHeadHtml: themeResult.custom_head_html,
        customBodyHtml: themeResult.custom_body_html,
        showNavigation: themeResult.show_navigation === 1,
        navigationLinks: navLinks,
      }
    : {
        googleFont: null,
        fontSize: null,
        colorMode: "system",
        accentColor: null,
        maxWidth: null,
        hideTopbar: true,
        faviconUrl: null,
        customCss: null,
        customHeadHtml: null,
        customBodyHtml: null,
        showNavigation: false,
        navigationLinks: [],
      };

  // Build derived lookup maps
  const slugToPage: Record<string, string> = {};
  const pageToSlug: Record<string, string> = {};
  const slugs: string[] = [];
  const pageIds: string[] = [];
  const pageMeta: Record<string, PageConfig> = {};

  for (const page of pages) {
    slugToPage[page.slug] = page.notionPageId;
    pageToSlug[page.notionPageId] = page.slug;
    slugs.push(page.slug);
    pageIds.push(page.notionPageId);
    pageMeta[page.notionPageId] = page;
    pageMeta[page.slug] = page;
  }

  return {
    siteId,
    siteName,
    notionUsername,
    hostname,
    pages,
    theme,
    slugToPage,
    pageToSlug,
    slugs,
    pageIds,
    pageMeta,
  };
}
