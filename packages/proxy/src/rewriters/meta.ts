import type { SiteConfig, PageConfig } from "../types.js";

/**
 * Rewrites meta tags for SEO.
 * Uses per-page meta when available, falls back to site-level defaults.
 */
export class MetaRewriter implements HTMLRewriterElementContentHandlers {
  private title: string;
  private description: string | null;
  private ogImage: string | null;
  private hostname: string;

  constructor(config: SiteConfig, currentPage: PageConfig | null) {
    this.title = currentPage?.title || config.siteName;
    this.description = currentPage?.description || null;
    this.ogImage = currentPage?.ogImage || null;
    this.hostname = config.hostname;
  }

  element(element: Element) {
    // Title tag
    if (element.tagName === "title") {
      element.setInnerContent(this.title);
      return;
    }

    // OG & Twitter title
    if (
      element.getAttribute("property") === "og:title" ||
      element.getAttribute("name") === "twitter:title"
    ) {
      element.setAttribute("content", this.title);
    }

    // Description
    if (this.description) {
      if (
        element.getAttribute("name") === "description" ||
        element.getAttribute("property") === "og:description" ||
        element.getAttribute("name") === "twitter:description"
      ) {
        element.setAttribute("content", this.description);
      }
    }

    // OG image
    if (this.ogImage) {
      if (element.getAttribute("property") === "og:image") {
        element.setAttribute("content", this.ogImage);
      }
      if (element.getAttribute("name") === "twitter:image") {
        element.setAttribute("content", this.ogImage);
      }
    }

    // URL
    if (
      element.getAttribute("property") === "og:url" ||
      element.getAttribute("name") === "twitter:url"
    ) {
      element.setAttribute("content", `https://${this.hostname}`);
    }

    // Remove apple-itunes-app prompt
    if (element.getAttribute("name") === "apple-itunes-app") {
      element.remove();
    }
  }
}
