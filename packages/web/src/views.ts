/**
 * HTML views for the dashboard.
 * Server-rendered HTML — no build step, no client-side framework.
 */

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function layout(title: string, content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<style>
:root {
  --bg: #ffffff;
  --text: #1a1a1a;
  --text-secondary: #666;
  --border: #e5e5e5;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --card-bg: #f9fafb;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f0f0f;
    --text: #e5e5e5;
    --text-secondary: #999;
    --border: #2a2a2a;
    --accent: #3b82f6;
    --accent-hover: #60a5fa;
    --card-bg: #1a1a1a;
  }
}
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--bg);
  color: var(--text);
  line-height: 1.5;
}
.container { max-width: 960px; margin: 0 auto; padding: 24px; }
.header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 24px; border-bottom: 1px solid var(--border);
}
.header h1 { font-size: 18px; font-weight: 600; }
.header nav { display: flex; gap: 16px; align-items: center; }
.btn {
  display: inline-block; padding: 8px 16px; border-radius: 6px;
  font-size: 14px; font-weight: 500; cursor: pointer;
  text-decoration: none; border: none;
}
.btn-primary { background: var(--accent); color: white; }
.btn-primary:hover { background: var(--accent-hover); }
.btn-secondary {
  background: transparent; color: var(--text); border: 1px solid var(--border);
}
.btn-secondary:hover { background: var(--card-bg); }
.btn-danger { background: #dc2626; color: white; }
.card {
  border: 1px solid var(--border); border-radius: 8px;
  padding: 20px; margin-bottom: 16px; background: var(--card-bg);
}
.card h3 { font-size: 16px; margin-bottom: 4px; }
.card p { font-size: 14px; color: var(--text-secondary); }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
.form-group { margin-bottom: 16px; }
.form-group label { display: block; font-size: 14px; font-weight: 500; margin-bottom: 4px; }
.form-group input, .form-group select, .form-group textarea {
  width: 100%; padding: 8px 12px; border: 1px solid var(--border);
  border-radius: 6px; font-size: 14px; background: var(--bg); color: var(--text);
}
.form-group textarea { min-height: 100px; font-family: monospace; }
table { width: 100%; border-collapse: collapse; font-size: 14px; }
th, td { padding: 10px 12px; text-align: left; border-bottom: 1px solid var(--border); }
th { font-weight: 600; color: var(--text-secondary); font-size: 12px; text-transform: uppercase; }
.badge {
  display: inline-block; padding: 2px 8px; border-radius: 10px;
  font-size: 12px; font-weight: 500;
}
.badge-green { background: #dcfce7; color: #166534; }
.badge-yellow { background: #fef9c3; color: #854d0e; }
.hero {
  text-align: center; padding: 80px 24px;
}
.hero h2 { font-size: 32px; font-weight: 700; margin-bottom: 12px; }
.hero p { font-size: 18px; color: var(--text-secondary); margin-bottom: 24px; }
.section { margin-top: 32px; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-header h2 { font-size: 20px; font-weight: 600; }
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
</style>
</head>
<body>
${content}
</body>
</html>`;
}

export function loginPage(): string {
  return `
<div class="hero">
  <h2>notionworker</h2>
  <p>Turn your Notion pages into a website. $1/month.</p>
  <a href="/connect" class="btn btn-primary" style="font-size:16px;padding:12px 32px;">
    Connect Notion
  </a>
</div>`;
}

export function dashboardPage(
  user: { userId: string; name: string },
  sites: Array<{ id: string; name: string; subdomain: string }>,
): string {
  const siteCards = sites.length > 0
    ? `<div class="grid">${sites
        .map(
          (s) => `
      <a href="/sites/${escapeHtml(s.id)}" class="card" style="text-decoration:none;color:inherit;">
        <h3>${escapeHtml(s.name)}</h3>
        <p>${escapeHtml(s.subdomain)}</p>
      </a>`,
        )
        .join("")}</div>`
    : `<div class="card"><p>No sites yet. Create your first site to get started.</p></div>`;

  return `
<div class="header">
  <h1>notionworker</h1>
  <nav>
    <span style="font-size:14px;color:var(--text-secondary);">${escapeHtml(user.name || "User")}</span>
    <form method="POST" action="/logout" style="display:inline;">
      <button type="submit" class="btn btn-secondary">Logout</button>
    </form>
  </nav>
</div>
<div class="container">
  <div class="section">
    <div class="section-header">
      <h2>Your Sites</h2>
    </div>
    ${siteCards}
  </div>
</div>`;
}

export function siteDetailPage(
  data: {
    site: { id: string; name: string; subdomain: string; notionUsername: string };
    pages: Array<{ id: string; notionPageId: string; slug: string; title: string | null; isHomepage: boolean }>;
    theme: Record<string, unknown> | null;
    domains: Array<{ id: string; hostname: string; status: string }>;
  },
): string {
  const { site, pages, domains } = data;

  const pagesTable = pages.length > 0
    ? `<table>
        <thead><tr><th>Title</th><th>Slug</th><th>Homepage</th></tr></thead>
        <tbody>${pages
          .map(
            (p) => `<tr>
              <td>${escapeHtml(p.title || "Untitled")}</td>
              <td><code>/${escapeHtml(p.slug || "(root)")}</code></td>
              <td>${p.isHomepage ? '<span class="badge badge-green">Yes</span>' : ""}</td>
            </tr>`,
          )
          .join("")}</tbody>
      </table>`
    : `<p style="color:var(--text-secondary);">No pages configured.</p>`;

  const domainsTable = domains.length > 0
    ? `<table>
        <thead><tr><th>Domain</th><th>Status</th></tr></thead>
        <tbody>${domains
          .map(
            (d) => `<tr>
              <td>${escapeHtml(d.hostname)}</td>
              <td><span class="badge ${d.status === "active" ? "badge-green" : "badge-yellow"}">${escapeHtml(d.status)}</span></td>
            </tr>`,
          )
          .join("")}</tbody>
      </table>`
    : `<p style="color:var(--text-secondary);">No custom domains. Platform subdomain: ${escapeHtml(site.subdomain)}</p>`;

  return `
<div class="header">
  <h1><a href="/" style="color:inherit;text-decoration:none;">notionworker</a></h1>
  <nav>
    <a href="/sites/${escapeHtml(site.id)}/theme" class="btn btn-secondary">Theme</a>
    <form method="POST" action="/sites/${escapeHtml(site.id)}/publish" style="display:inline;">
      <button type="submit" class="btn btn-primary">Publish</button>
    </form>
  </nav>
</div>
<div class="container">
  <h2 style="margin-top:24px;">${escapeHtml(site.name)}</h2>
  <p style="color:var(--text-secondary);margin-bottom:24px;">
    Notion: ${escapeHtml(site.notionUsername)} &middot; Subdomain: ${escapeHtml(site.subdomain)}
  </p>

  <div class="section">
    <div class="section-header">
      <h2>Pages</h2>
    </div>
    ${pagesTable}
  </div>

  <div class="section">
    <div class="section-header">
      <h2>Domains</h2>
    </div>
    ${domainsTable}
  </div>
</div>`;
}

export function themeEditorPage(
  siteId: string,
  theme: Record<string, unknown> | null,
  apiBaseUrl: string,
): string {
  const t = theme ?? {};

  return `
<div class="header">
  <h1><a href="/" style="color:inherit;text-decoration:none;">notionworker</a></h1>
  <nav>
    <a href="/sites/${escapeHtml(siteId)}" class="btn btn-secondary">Back</a>
  </nav>
</div>
<div class="container">
  <h2 style="margin-top:24px;margin-bottom:24px;">Theme Editor</h2>

  <form id="theme-form">
    <div class="form-group">
      <label for="googleFont">Google Font</label>
      <input type="text" id="googleFont" name="googleFont" value="${escapeHtml(String(t.googleFont ?? ""))}" placeholder="Inter">
    </div>

    <div class="form-group">
      <label for="fontSize">Font Size</label>
      <input type="text" id="fontSize" name="fontSize" value="${escapeHtml(String(t.fontSize ?? ""))}" placeholder="16px">
    </div>

    <div class="form-group">
      <label for="colorMode">Color Mode</label>
      <select id="colorMode" name="colorMode">
        <option value="system" ${t.colorMode === "system" ? "selected" : ""}>System</option>
        <option value="light" ${t.colorMode === "light" ? "selected" : ""}>Light</option>
        <option value="dark" ${t.colorMode === "dark" ? "selected" : ""}>Dark</option>
      </select>
    </div>

    <div class="form-group">
      <label for="accentColor">Accent Color</label>
      <input type="text" id="accentColor" name="accentColor" value="${escapeHtml(String(t.accentColor ?? ""))}" placeholder="#2563eb">
    </div>

    <div class="form-group">
      <label for="maxWidth">Max Width</label>
      <input type="text" id="maxWidth" name="maxWidth" value="${escapeHtml(String(t.maxWidth ?? ""))}" placeholder="720px">
    </div>

    <div class="form-group">
      <label for="faviconUrl">Favicon URL</label>
      <input type="text" id="faviconUrl" name="faviconUrl" value="${escapeHtml(String(t.faviconUrl ?? ""))}" placeholder="https://...">
    </div>

    <div class="form-group">
      <label for="customCss">Custom CSS</label>
      <textarea id="customCss" name="customCss" placeholder=".notion-page-content { ... }">${escapeHtml(String(t.customCss ?? ""))}</textarea>
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" name="hideTopbar" ${t.hideTopbar !== false ? "checked" : ""}> Hide Notion topbar
      </label>
    </div>

    <div class="form-group">
      <label>
        <input type="checkbox" name="showNavigation" ${t.showNavigation ? "checked" : ""}> Show navigation bar
      </label>
    </div>

    <div class="form-group">
      <label for="navigationLinks">Navigation Links (JSON)</label>
      <textarea id="navigationLinks" name="navigationLinks" placeholder='[{"label":"Home","slug":""},{"label":"About","slug":"about"}]'>${escapeHtml(String(t.navigationLinks ?? ""))}</textarea>
    </div>

    <button type="submit" class="btn btn-primary">Save Theme</button>
  </form>
</div>

<script>
document.getElementById('theme-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const data = {
    googleFont: form.googleFont.value || null,
    fontSize: form.fontSize.value || null,
    colorMode: form.colorMode.value,
    accentColor: form.accentColor.value || null,
    maxWidth: form.maxWidth.value || null,
    faviconUrl: form.faviconUrl.value || null,
    customCss: form.customCss.value || null,
    hideTopbar: form.hideTopbar.checked,
    showNavigation: form.showNavigation.checked,
    navigationLinks: form.navigationLinks.value || null,
  };

  const res = await fetch('${escapeHtml(apiBaseUrl)}/api/sites/${escapeHtml(siteId)}/theme', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });

  if (res.ok) {
    alert('Theme saved!');
  } else {
    alert('Failed to save theme');
  }
});
</script>`;
}
