import type { SiteConfig } from "../types.js";

/**
 * Injects into <head>:
 * - CSS custom properties from theme config
 * - Google Font link
 * - Base stylesheet for layout overrides
 * - Topbar hiding CSS
 * - Favicon
 * - Custom head HTML from theme
 */
export class HeadRewriter implements HTMLRewriterElementContentHandlers {
  private config: SiteConfig;

  constructor(config: SiteConfig) {
    this.config = config;
  }

  element(element: Element) {
    const { theme } = this.config;
    const parts: string[] = [];

    // Favicon
    if (theme.faviconUrl) {
      parts.push(`<link rel="icon" href="${theme.faviconUrl}">`);
    }

    // Google Font
    if (theme.googleFont) {
      const fontFamily = theme.googleFont.replace(/ /g, "+");
      parts.push(
        `<link href="https://fonts.googleapis.com/css2?family=${fontFamily}:wght@400;500;600;700&display=swap" rel="stylesheet">`
      );
    }

    // CSS custom properties + base styles
    parts.push(`<style id="nw-theme">
:root {
  --nw-font: ${theme.googleFont ? `"${theme.googleFont}", ` : ""}system-ui, -apple-system, sans-serif;
  --nw-font-size: ${theme.fontSize || "16px"};
  --nw-max-width: ${theme.maxWidth || "720px"};
  --nw-accent: ${theme.accentColor || "#2563eb"};
  --nw-nav-height: 56px;
}
${this.buildColorModeVars()}

/* Base layout */
.notion-page-content,
.notion-page-content > div {
  font-family: var(--nw-font) !important;
  font-size: var(--nw-font-size) !important;
}
.notion-frame > .notion-scroller > div:first-child {
  max-width: var(--nw-max-width) !important;
  margin: 0 auto !important;
}

/* Links */
.notion-page-content a {
  color: var(--nw-accent) !important;
}

/* Hide Notion topbar */
${theme.hideTopbar ? `
div.notion-topbar,
div.notion-topbar-mobile { display: none !important; }
div.notion-topbar > div > div:nth-child(1n).toggle-mode,
div.notion-topbar-mobile > div:nth-child(1n).toggle-mode { display: block !important; }
` : ""}

/* Navigation bar */
${theme.showNavigation ? `
.nw-nav {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--nw-nav-height);
  display: flex;
  align-items: center;
  padding: 0 24px;
  background: var(--nw-bg, #fff);
  border-bottom: 1px solid var(--nw-border, #e5e5e5);
  font-family: var(--nw-font);
}
.nw-nav-brand {
  font-weight: 600;
  font-size: 16px;
  color: var(--nw-text, #1a1a1a);
  text-decoration: none;
  margin-right: 32px;
}
.nw-nav-links {
  display: flex;
  gap: 24px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.nw-nav-links a {
  color: var(--nw-text-secondary, #666);
  text-decoration: none;
  font-size: 14px;
}
.nw-nav-links a:hover {
  color: var(--nw-accent);
}
` : ""}
</style>`);

    // User custom CSS
    if (theme.customCss) {
      parts.push(`<style id="nw-custom-css">${theme.customCss}</style>`);
    }

    // Custom head HTML
    if (theme.customHeadHtml) {
      parts.push(theme.customHeadHtml);
    }

    element.append(parts.join("\n"), { html: true });
  }

  private buildColorModeVars(): string {
    const lightVars = `
  --nw-bg: #ffffff;
  --nw-text: #1a1a1a;
  --nw-text-secondary: #666666;
  --nw-border: #e5e5e5;`;

    const darkVars = `
  --nw-bg: #191919;
  --nw-text: #e0e0e0;
  --nw-text-secondary: #999999;
  --nw-border: #333333;`;

    switch (this.config.theme.colorMode) {
      case "dark":
        return `:root {${darkVars}\n}`;
      case "light":
        return `:root {${lightVars}\n}`;
      case "system":
      default:
        return `:root {${lightVars}\n}\n@media (prefers-color-scheme: dark) {\n  :root {${darkVars}\n  }\n}`;
    }
  }
}
