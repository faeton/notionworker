// Uncomment and set this object if you prefer to hardcode settings for a single domain.
// When commented out or undefined, the script will use KV storage for configuration.
/*
const manualConfig = {
  MY_DOMAIN: 'example.com', // your custom domain
  SLUG_TO_PAGE: {
    // Map slugs to page IDs.
    home: 'pageId_home',
    about: 'pageId_about'
  },
  PAGE_TITLE: 'Example Site',
  PAGE_DESCRIPTION: 'This is an example description.',
  GOOGLE_FONT: 'Roboto',
  CUSTOM_SCRIPT: ''
};
*/

const MY_NOTION_USERNAME = 'faeton';
const domainConfigCache = new Map();

async function getDomainConfig(hostname) {
  if (typeof manualConfig !== 'undefined') {
    // Use manual configuration.
    const config = JSON.parse(JSON.stringify(manualConfig));
    config.MY_DOMAIN = hostname;
    config.PAGE_TO_SLUG = {};
    config.slugs = [];
    config.pages = [];
    Object.keys(config.SLUG_TO_PAGE).forEach(slug => {
      const page = config.SLUG_TO_PAGE[slug];
      config.slugs.push(slug);
      config.pages.push(page);
      config.PAGE_TO_SLUG[page] = slug;
    });
    return config;
  }
  
  // Otherwise, use KV storage with caching.
  if (domainConfigCache.has(hostname)) {
    return domainConfigCache.get(hostname);
  }
  // @ts-ignore: KV binding for DOMAINS_CONFIG
  const domainConfigs = await DOMAINS_CONFIG.get(hostname);
  if (!domainConfigs) return null;
  const config = JSON.parse(domainConfigs);
  config.MY_DOMAIN = hostname;
  config.PAGE_TO_SLUG = {};
  config.slugs = [];
  config.pages = [];
  Object.keys(config.SLUG_TO_PAGE).forEach(slug => {
    const page = config.SLUG_TO_PAGE[slug];
    config.slugs.push(slug);
    config.pages.push(page);
    config.PAGE_TO_SLUG[page] = slug;
  });
  domainConfigCache.set(hostname, config);
  return config;
}

addEventListener("fetch", event => {
  event.respondWith(fetchAndApply(event.request));
});

function generateSitemap({ MY_DOMAIN, slugs }) {
  const urls = slugs.map(slug => `<url><loc>https://${MY_DOMAIN}/${slug}</loc></url>`);
  return `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};

function handleOptions(request) {
  if (
    request.headers.get("Origin") &&
    request.headers.get("Access-Control-Request-Method") &&
    request.headers.get("Access-Control-Request-Headers")
  ) {
    return new Response(null, { headers: corsHeaders });
  }
  return new Response(null, { headers: { Allow: "GET, HEAD, POST, PUT, OPTIONS" } });
}

async function fetchAndApply(request) {
  const url = new URL(request.url);
  const hostname = url.hostname.replace(/^www\./, '');
  const config = await getDomainConfig(hostname);
  console.log("Getting domain configuration for", url.hostname, config);
  if (!config) {
    return new Response('Domain not found in domainConfig', { status: 404 });
  }

  if (request.method === "OPTIONS") {
    return handleOptions(request);
  }

  // Rewrite hostname so that further requests go to Notion.
  url.hostname = `${MY_NOTION_USERNAME}.notion.site`;

  if (url.pathname === "/robots.txt") {
    return new Response(`Sitemap: https://${config.MY_DOMAIN}/sitemap.xml`);
  }
  if (url.pathname === "/sitemap.xml") {
    const sitemap = generateSitemap(config);
    const response = new Response(sitemap);
    response.headers.set("content-type", "application/xml");
    return response;
  }

  let response;
  if (url.pathname.startsWith("/app") && url.pathname.endsWith("js")) {
    // Rewrite Notion JS scripts.
    response = await fetch(url.toString());
    let body = await response.text();
    body = body.replace(/www\.notion\.so/g, config.MY_DOMAIN)
               .replace(/notion\.so/g, config.MY_DOMAIN)
               .replace(new RegExp(`${MY_NOTION_USERNAME}\\.notion\\.site`, 'g'), config.MY_DOMAIN);
    response = new Response(body, response);
    response.headers.set("Content-Type", "application/x-javascript");
    return response;
  } else if (url.pathname.startsWith("/api")) {
    // Notion API rewriting.
    response = await fetch(url.toString(), {
      body: url.pathname.startsWith('/api/v3/getPublicPageData') ? null : request.body,
      headers: {
        "content-type": "application/json;charset=UTF-8",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.163 Safari/537.36"
      },
      method: "POST"
    });
    response = new Response(response.body, response);
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  } else if (config.SLUG_TO_PAGE[url.pathname.slice(1)] !== undefined) {
    // Directly redirect based on slug.
    const pageId = config.SLUG_TO_PAGE[url.pathname.slice(1)];
    console.log('Redirect with pageId:', pageId, url.pathname);
    return Response.redirect(`https://${config.MY_DOMAIN}/${pageId}`, 301);
  } else if (
    !config.pages.includes(url.pathname.slice(1)) &&
    /[0-9a-f]{32}/.test(url.pathname.slice(1))
  ) {
    // If the URL looks like a page ID but isn’t in our pages, redirect to the main page.
    console.log('Redirect to main page:', url.pathname);
    return Response.redirect(`https://${config.MY_DOMAIN}`, 301);
  } else {
    // For all other requests, fetch the page and strip certain security headers.
    response = await fetch(url.toString(), {
      body: request.body,
      headers: request.headers,
      method: request.method
    });
    console.log('Default. Getting:', url.toString());
    response = new Response(response.body, response);
    response.headers.delete("Content-Security-Policy");
    response.headers.delete("X-Content-Security-Policy");
  }
  return appendJavascript(response, config);
}

class MetaRewriter {
  constructor({ PAGE_TITLE, PAGE_DESCRIPTION, MY_DOMAIN }) {
    this.PAGE_TITLE = PAGE_TITLE;
    this.PAGE_DESCRIPTION = PAGE_DESCRIPTION;
    this.MY_DOMAIN = MY_DOMAIN;
  }
  element(element) {
    if (this.PAGE_TITLE) {
      if (
        element.getAttribute("property") === "og:title" ||
        element.getAttribute("name") === "twitter:title"
      ) {
        element.setAttribute("content", this.PAGE_TITLE);
      }
      if (element.tagName === "title") {
        element.setInnerContent(this.PAGE_TITLE);
      }
    }
    if (this.PAGE_DESCRIPTION) {
      if (
        element.getAttribute("name") === "description" ||
        element.getAttribute("property") === "og:description" ||
        element.getAttribute("name") === "twitter:description"
      ) {
        element.setAttribute("content", this.PAGE_DESCRIPTION);
      }
    }
    if (
      element.getAttribute("property") === "og:url" ||
      element.getAttribute("name") === "twitter:url"
    ) {
      element.setAttribute("content", this.MY_DOMAIN);
    }
    if (element.getAttribute("name") === "apple-itunes-app") {
      element.remove();
    }
  }
}

class HeadRewriter {
  constructor({ GOOGLE_FONT }) {
    this.GOOGLE_FONT = GOOGLE_FONT;
  }
  element(element) {
    if (this.GOOGLE_FONT) {
      const fontUrl = `https://fonts.googleapis.com/css?family=${this.GOOGLE_FONT.replace(' ', '+')}:Regular,Bold,Italic&display=swap`;
      element.append(
        `<link href="${fontUrl}" rel="stylesheet">
         <style>* { font-family: "${this.GOOGLE_FONT}" !important; }</style>`,
        { html: true }
      );
    }
    element.append(
      `<style>
         div.notion-topbar {display: none !important;}
         div.notion-topbar > div > div:nth-child(3),
         div.notion-topbar > div > div:nth-child(4),
         div.notion-topbar > div > div:nth-child(5),
         div.notion-topbar > div > div:nth-child(6),
         div.notion-topbar-mobile > div:nth-child(3),
         div.notion-topbar-mobile > div > div:nth-child(4),
         div.notion-topbar-mobile > div > div:nth-child(5) { display: none !important; }
         div.notion-topbar > div > div:nth-child(1n).toggle-mode,
         div.notion-topbar-mobile > div:nth-child(1n).toggle-mode { display: block !important; }
       </style>`,
      { html: true }
    );
  }
}

class BodyRewriter {
  constructor({ SLUG_TO_PAGE, CUSTOM_SCRIPT, MY_DOMAIN, PAGE_TO_SLUG, pages, slugs }) {
    this.SLUG_TO_PAGE = SLUG_TO_PAGE;
    this.CUSTOM_SCRIPT = CUSTOM_SCRIPT;
    this.MY_DOMAIN = MY_DOMAIN;
    this.PAGE_TO_SLUG = PAGE_TO_SLUG;
    this.pages = pages;
    this.slugs = slugs;
  }
  element(element) {
    element.append(
      `<script>
        window.CONFIG = window.CONFIG || {};
        window.CONFIG.domainBaseUrl = location.origin;
        const SLUG_TO_PAGE = ${JSON.stringify(this.SLUG_TO_PAGE)};
        const PAGE_TO_SLUG = ${JSON.stringify(this.PAGE_TO_SLUG)};
        const slugs = ${JSON.stringify(this.slugs)};
        const pages = ${JSON.stringify(this.pages)};
        const el = document.createElement('div');
        let redirected = false;
        function getPage() { return location.pathname.slice(-32); }
        function getSlug() { return location.pathname.slice(1); }
        function updateSlug() {
          const slug = PAGE_TO_SLUG[getPage()];
          if (slug != null) history.replaceState(history.state, '', '/' + slug);
        }
        function onDark() {
          el.innerHTML = '<div title="Change to Light Mode" style="margin: auto 14px 0 0; min-width: 0;"><div role="button" tabindex="0" style="user-select: none; transition: background 120ms ease-in; cursor: pointer; border-radius: 44px;"><div style="display: flex; height: 14px; width: 26px; border-radius: 44px; padding: 2px; background: rgb(46, 170, 220); transition: background 200ms ease, box-shadow 200ms ease;"><div style="width: 14px; height: 14px; border-radius: 44px; background: white; transition: transform 200ms ease-out, background 200ms ease-out; transform: translateX(12px);"></div></div></div></div>';
          document.body.classList.add('dark');
          __console.environment.ThemeStore.setState({ mode: 'dark' });
        }
        function onLight() {
          el.innerHTML = '<div title="Change to Dark Mode" style="margin: auto 14px 0 0; min-width: 0;"><div role="button" tabindex="0" style="user-select: none; transition: background 120ms ease-in; cursor: pointer; border-radius: 44px;"><div style="display: flex; height: 14px; width: 26px; border-radius: 44px; padding: 2px; background: rgba(135, 131, 120, 0.3); transition: background 200ms ease, box-shadow 200ms ease;"><div style="width: 14px; height: 14px; border-radius: 44px; background: white; transition: transform 200ms ease-out, background 200ms ease-out; transform: translateX(0);"></div></div></div></div>';
          document.body.classList.remove('dark');
          __console.environment.ThemeStore.setState({ mode: 'light' });
        }
        function toggle() { document.body.classList.contains('dark') ? onLight() : onDark(); }
        function addDarkModeButton(device) {
          const nav = device === 'web'
            ? document.querySelector('.notion-topbar').firstChild
            : document.querySelector('.notion-topbar-mobile');
          el.className = 'toggle-mode';
          el.addEventListener('click', toggle);
          nav.appendChild(el);
          if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            onDark();
          } else {
            onLight();
          }
          window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', toggle);
        }
        const observer = new MutationObserver(() => {
          if (redirected) return;
          const nav = document.querySelector('.notion-topbar');
          const mobileNav = document.querySelector('.notion-topbar-mobile');
          if ((nav && nav.firstChild && nav.firstChild.firstChild) || (mobileNav && mobileNav.firstChild)) {
            redirected = true;
            updateSlug();
            addDarkModeButton(nav ? 'web' : 'mobile');
            const onpopstate = window.onpopstate;
            window.onpopstate = function() {
              if (slugs.includes(getSlug())) {
                const page = SLUG_TO_PAGE[getSlug()];
                if (page) history.replaceState(history.state, 'bypass', '/' + page);
              }
              onpopstate.apply(this, arguments);
              updateSlug();
            };
          }
        });
        observer.observe(document.querySelector('#notion-app'), { childList: true, subtree: true });
        const originalReplaceState = window.history.replaceState;
        window.history.replaceState = function(state) {
          if (arguments[1] !== 'bypass' && slugs.includes(getSlug())) return;
          return originalReplaceState.apply(window.history, arguments);
        };
        const originalPushState = window.history.pushState;
        window.history.pushState = function(state) {
          const dest = new URL(location.protocol + '//' + location.host + arguments[2]);
          const id = dest.pathname.slice(-32);
          if (pages.includes(id)) arguments[2] = '/' + PAGE_TO_SLUG[id];
          return originalPushState.apply(window.history, arguments);
        };
        const open = window.XMLHttpRequest.prototype.open;
        window.XMLHttpRequest.prototype.open = function() {
          arguments[1] = arguments[1].replace('${config.MY_DOMAIN}', '${MY_NOTION_USERNAME}.notion.site');
          return open.apply(this, arguments);
        };
      </script>${this.CUSTOM_SCRIPT}`,
      { html: true }
    );
  }
}

async function appendJavascript(res, config) {
  return new HTMLRewriter()
    .on("title", new MetaRewriter(config))
    .on("meta", new MetaRewriter(config))
    .on("head", new HeadRewriter(config))
    .on("body", new BodyRewriter({
      SLUG_TO_PAGE: config.SLUG_TO_PAGE,
      CUSTOM_SCRIPT: config.CUSTOM_SCRIPT,
      MY_DOMAIN: config.MY_DOMAIN,
      PAGE_TO_SLUG: config.PAGE_TO_SLUG,
      pages: config.pages,
      slugs: config.slugs
    }))
    .transform(res);
}
