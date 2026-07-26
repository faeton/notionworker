import { Hono } from "hono";
import { layout, loginPage, dashboardPage, siteDetailPage, themeEditorPage } from "./views.js";

interface Env {
  API_BASE_URL: string;
}

const app = new Hono<{ Bindings: Env }>();

/** Proxy API call, forwarding cookies */
async function apiCall(env: Env, path: string, req: Request, options: RequestInit = {}): Promise<Response> {
  const url = `${env.API_BASE_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Cookie: req.headers.get("Cookie") ?? "",
      ...((options.headers as Record<string, string>) ?? {}),
    },
  });
}

/** GET / — dashboard home or login */
app.get("/", async (c) => {
  const res = await apiCall(c.env, "/auth/me", c.req.raw);
  const { user } = await res.json() as { user: { userId: string; name: string } | null };

  if (!user) {
    return c.html(layout("notionworker", loginPage()));
  }

  // Fetch user's sites
  const sitesRes = await apiCall(c.env, "/api/sites", c.req.raw);
  const { sites } = await sitesRes.json() as { sites: Array<{ id: string; name: string; subdomain: string }> };

  return c.html(layout("Dashboard — notionworker", dashboardPage(user, sites)));
});

/** GET /sites/:id — site detail page */
app.get("/sites/:id", async (c) => {
  const siteId = c.req.param("id");
  const res = await apiCall(c.env, `/api/sites/${siteId}`, c.req.raw);

  if (!res.ok) {
    return c.redirect("/");
  }

  const data = await res.json() as {
    site: { id: string; name: string; subdomain: string; notionUsername: string };
    pages: Array<{ id: string; notionPageId: string; slug: string; title: string | null; isHomepage: boolean }>;
    theme: Record<string, unknown> | null;
    domains: Array<{ id: string; hostname: string; status: string }>;
  };

  return c.html(layout(`${data.site.name} — notionworker`, siteDetailPage(data)));
});

/** GET /sites/:id/theme — theme editor */
app.get("/sites/:id/theme", async (c) => {
  const siteId = c.req.param("id");
  const res = await apiCall(c.env, `/api/sites/${siteId}/theme`, c.req.raw);

  if (!res.ok) {
    return c.redirect("/");
  }

  const { theme } = await res.json() as { theme: Record<string, unknown> | null };
  return c.html(layout("Theme Editor — notionworker", themeEditorPage(siteId, theme, c.env.API_BASE_URL)));
});

/** POST /sites/:id/publish — trigger publish */
app.post("/sites/:id/publish", async (c) => {
  const siteId = c.req.param("id");
  await apiCall(c.env, `/api/sites/${siteId}/publish`, c.req.raw, {
    method: "POST",
  });
  return c.redirect(`/sites/${siteId}`);
});

/** GET /connect — start Notion OAuth */
app.get("/connect", (c) => {
  return c.redirect(`${c.env.API_BASE_URL}/auth/notion`);
});

/** POST /logout */
app.post("/logout", async (c) => {
  const res = await apiCall(c.env, "/auth/logout", c.req.raw, {
    method: "POST",
    redirect: "manual",
  });

  // Forward the API's Set-Cookie so the browser session cookie is actually cleared
  const headers = new Headers({ Location: "/" });
  const setCookie = res.headers.get("Set-Cookie");
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return new Response(null, { status: 302, headers });
});

export default app;
