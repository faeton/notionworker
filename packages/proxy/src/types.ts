export interface Env {
  DB: D1Database;
  SITE_CACHE: KVNamespace;
}

export interface PageConfig {
  notionPageId: string;
  slug: string;
  title: string | null;
  description: string | null;
  ogImage: string | null;
  isHomepage: boolean;
}

export interface ThemeConfig {
  googleFont: string | null;
  fontSize: string | null;
  colorMode: "light" | "dark" | "system";
  accentColor: string | null;
  maxWidth: string | null;
  hideTopbar: boolean;
  faviconUrl: string | null;
  customCss: string | null;
  customHeadHtml: string | null;
  customBodyHtml: string | null;
  showNavigation: boolean;
  navigationLinks: NavigationLink[];
}

export interface NavigationLink {
  label: string;
  slug: string;
  url?: string;
}

export interface SiteConfig {
  siteId: string;
  siteName: string;
  notionUsername: string;
  hostname: string;
  pages: PageConfig[];
  theme: ThemeConfig;
  // Derived fields (computed from pages)
  slugToPage: Record<string, string>;
  pageToSlug: Record<string, string>;
  slugs: string[];
  pageIds: string[];
  // Per-page meta lookup
  pageMeta: Record<string, PageConfig>;
}
