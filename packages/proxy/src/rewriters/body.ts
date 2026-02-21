import type { SiteConfig } from "../types.js";

/**
 * Injects into <body>:
 * - Navigation bar HTML (if enabled)
 * - Client-side JS for slug URL rewriting + history interception
 * - Dark mode toggle (if colorMode is "system")
 * - XHR domain rewriting
 * - Custom body HTML from theme
 */
export class BodyRewriter implements HTMLRewriterElementContentHandlers {
  private config: SiteConfig;

  constructor(config: SiteConfig) {
    this.config = config;
  }

  element(element: Element) {
    const { config } = this;

    // Prepend navigation bar
    if (config.theme.showNavigation) {
      const navLinks = config.theme.navigationLinks
        .map(
          (link) =>
            `<li><a href="/${link.slug}"${link.url ? ` data-external="${link.url}"` : ""}>${link.label}</a></li>`
        )
        .join("");

      element.prepend(
        `<nav class="nw-nav">
  <a href="/" class="nw-nav-brand">${this.escapeHtml(config.siteName)}</a>
  <ul class="nw-nav-links">${navLinks}</ul>
</nav>`,
        { html: true }
      );
    }

    // Client-side JavaScript
    element.append(
      `<script>
(function() {
  var SLUG_TO_PAGE = ${JSON.stringify(config.slugToPage)};
  var PAGE_TO_SLUG = ${JSON.stringify(config.pageToSlug)};
  var slugs = ${JSON.stringify(config.slugs)};
  var pages = ${JSON.stringify(config.pageIds)};
  var notionHost = '${config.notionUsername}.notion.site';
  var myDomain = '${config.hostname}';

  function getPage() { return location.pathname.slice(-32); }
  function getSlug() { return location.pathname.slice(1); }
  function updateSlug() {
    var slug = PAGE_TO_SLUG[getPage()];
    if (slug != null) history.replaceState(history.state, '', '/' + slug);
  }

  ${config.theme.colorMode === "system" ? this.buildDarkModeToggleJs() : ""}

  var observer = new MutationObserver(function() {
    var nav = document.querySelector('.notion-topbar');
    var mobileNav = document.querySelector('.notion-topbar-mobile');
    if ((nav && nav.firstChild && nav.firstChild.firstChild) || (mobileNav && mobileNav.firstChild)) {
      observer.disconnect();
      updateSlug();
      ${config.theme.colorMode === "system" ? "addDarkModeButton(nav ? 'web' : 'mobile');" : ""}

      var onpopstate = window.onpopstate;
      window.onpopstate = function() {
        if (slugs.indexOf(getSlug()) !== -1) {
          var page = SLUG_TO_PAGE[getSlug()];
          if (page) history.replaceState(history.state, 'bypass', '/' + page);
        }
        if (onpopstate) onpopstate.apply(this, arguments);
        updateSlug();
      };
    }
  });
  observer.observe(document.querySelector('#notion-app'), { childList: true, subtree: true });

  // Intercept history API for slug rewriting
  var origReplace = history.replaceState;
  history.replaceState = function(state) {
    if (arguments[1] !== 'bypass' && slugs.indexOf(getSlug()) !== -1) return;
    return origReplace.apply(history, arguments);
  };
  var origPush = history.pushState;
  history.pushState = function(state) {
    var dest = new URL(location.protocol + '//' + location.host + arguments[2]);
    var id = dest.pathname.slice(-32);
    if (pages.indexOf(id) !== -1) arguments[2] = '/' + PAGE_TO_SLUG[id];
    return origPush.apply(history, arguments);
  };

  // Rewrite XHR calls back to Notion
  var xhrOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function() {
    arguments[1] = arguments[1].replace(myDomain, notionHost);
    return xhrOpen.apply(this, arguments);
  };
})();
</script>`,
      { html: true }
    );

    // Custom body HTML
    if (config.theme.customBodyHtml) {
      element.append(config.theme.customBodyHtml, { html: true });
    }
  }

  private buildDarkModeToggleJs(): string {
    return `
  var el = document.createElement('div');
  function onDark() {
    el.innerHTML = '<div title="Change to Light Mode" style="margin:auto 14px 0 0;min-width:0"><div role="button" tabindex="0" style="user-select:none;cursor:pointer;border-radius:44px"><div style="display:flex;height:14px;width:26px;border-radius:44px;padding:2px;background:rgb(46,170,220);transition:background 200ms ease"><div style="width:14px;height:14px;border-radius:44px;background:white;transform:translateX(12px);transition:transform 200ms ease-out"></div></div></div></div>';
    document.body.classList.add('dark');
    if (typeof __console !== 'undefined') __console.environment.ThemeStore.setState({ mode: 'dark' });
  }
  function onLight() {
    el.innerHTML = '<div title="Change to Dark Mode" style="margin:auto 14px 0 0;min-width:0"><div role="button" tabindex="0" style="user-select:none;cursor:pointer;border-radius:44px"><div style="display:flex;height:14px;width:26px;border-radius:44px;padding:2px;background:rgba(135,131,120,0.3);transition:background 200ms ease"><div style="width:14px;height:14px;border-radius:44px;background:white;transform:translateX(0);transition:transform 200ms ease-out"></div></div></div></div>';
    document.body.classList.remove('dark');
    if (typeof __console !== 'undefined') __console.environment.ThemeStore.setState({ mode: 'light' });
  }
  function toggleDark() { document.body.classList.contains('dark') ? onLight() : onDark(); }
  function addDarkModeButton(device) {
    var target = device === 'web'
      ? document.querySelector('.notion-topbar').firstChild
      : document.querySelector('.notion-topbar-mobile');
    if (!target) return;
    el.className = 'toggle-mode';
    el.addEventListener('click', toggleDark);
    target.appendChild(el);
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) onDark();
    else onLight();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', toggleDark);
  }`;
  }

  private escapeHtml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
