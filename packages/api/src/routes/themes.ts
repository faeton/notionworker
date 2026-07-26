import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { themes } from "@notionworker/db";
import type { Env } from "../types.js";
import { requireAuth } from "../middleware/auth.js";
import { generateId, getOwnedSite, purgeSiteCache } from "../lib/util.js";

type Variables = { userId: string; userName: string | null };

const themesRouter = new Hono<{ Bindings: Env; Variables: Variables }>();

themesRouter.use("/*", requireAuth);

interface ThemeBody {
  googleFont?: string | null;
  fontSize?: string | null;
  colorMode?: string;
  accentColor?: string | null;
  maxWidth?: string | null;
  hideTopbar?: boolean;
  faviconUrl?: string | null;
  customCss?: string | null;
  customHeadHtml?: string | null;
  customBodyHtml?: string | null;
  showNavigation?: boolean;
  navigationLinks?: string | null;
}

const THEME_FIELDS = [
  "googleFont",
  "fontSize",
  "colorMode",
  "accentColor",
  "maxWidth",
  "hideTopbar",
  "faviconUrl",
  "customCss",
  "customHeadHtml",
  "customBodyHtml",
  "showNavigation",
  "navigationLinks",
] as const;

/** Pick only known theme fields — never spread the raw body into the update */
function pickThemeFields(body: ThemeBody): Partial<ThemeBody> {
  const updates: Partial<ThemeBody> = {};
  for (const field of THEME_FIELDS) {
    if (field in body) {
      (updates as Record<string, unknown>)[field] = body[field];
    }
  }
  return updates;
}

/** GET /sites/:siteId/theme — get theme */
themesRouter.get("/", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;

  if (!(await getOwnedSite(c.env.DB, siteId, userId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const d1 = drizzle(c.env.DB);
  const [theme] = await d1.select().from(themes).where(eq(themes.siteId, siteId)).limit(1);
  return c.json({ theme: theme ?? null });
});

/** PUT /sites/:siteId/theme — update theme */
themesRouter.put("/", async (c) => {
  const userId = c.get("userId");
  const siteId = c.req.param("siteId") as string;

  if (!(await getOwnedSite(c.env.DB, siteId, userId))) {
    return c.json({ error: "Site not found" }, 404);
  }

  const body = pickThemeFields(await c.req.json<ThemeBody>());

  const d1 = drizzle(c.env.DB);
  const [existing] = await d1.select().from(themes).where(eq(themes.siteId, siteId)).limit(1);
  const now = new Date();

  if (existing) {
    await d1
      .update(themes)
      .set({ ...body, updatedAt: now })
      .where(eq(themes.siteId, siteId));
  } else {
    await d1.insert(themes).values({
      id: generateId(),
      siteId,
      googleFont: body.googleFont ?? null,
      fontSize: body.fontSize ?? null,
      colorMode: body.colorMode ?? "system",
      accentColor: body.accentColor ?? null,
      maxWidth: body.maxWidth ?? null,
      hideTopbar: body.hideTopbar ?? true,
      faviconUrl: body.faviconUrl ?? null,
      customCss: body.customCss ?? null,
      customHeadHtml: body.customHeadHtml ?? null,
      customBodyHtml: body.customBodyHtml ?? null,
      showNavigation: body.showNavigation ?? false,
      navigationLinks: body.navigationLinks ?? null,
      createdAt: now,
      updatedAt: now,
    });
  }

  await purgeSiteCache(c.env, siteId);

  return c.json({ ok: true });
});

export default themesRouter;
