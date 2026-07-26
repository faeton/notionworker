import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { pages, sites, users } from "@notionworker/db";
import { loadRenderConfig, publishPage } from "@notionworker/renderer";
import { verifyWebhookSignature } from "../lib/notion.js";
import type { Env } from "../types.js";

const webhooksRouter = new Hono<{ Bindings: Env }>();

/** POST /webhooks/notion — receive Notion webhook events */
webhooksRouter.post("/notion", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("X-Notion-Signature") ?? "";

  const event = JSON.parse(body) as {
    type?: string;
    verification_token?: string;
    data?: {
      page_id?: string;
      [key: string]: unknown;
    };
  };

  // Initial subscription handshake: Notion POSTs { verification_token } once.
  // Log it so it can be pasted into the Notion integration settings.
  if (event.verification_token) {
    console.log(`[webhook] Verification token received: ${event.verification_token}`);
    return c.json({ ok: true });
  }

  // Verify signature on all regular events
  if (c.env.NOTION_WEBHOOK_SECRET) {
    const valid = await verifyWebhookSignature(body, signature, c.env.NOTION_WEBHOOK_SECRET);
    if (!valid) {
      return c.json({ error: "Invalid signature" }, 401);
    }
  }

  // Handle page content updates
  if (event.type === "page.content_updated" && event.data?.page_id) {
    const notionPageId = event.data.page_id.replace(/-/g, "");
    const d1 = drizzle(c.env.DB);

    // Find which site owns this page
    const result = await d1
      .select({
        siteId: pages.siteId,
        notionPageId: pages.notionPageId,
      })
      .from(pages)
      .where(eq(pages.notionPageId, notionPageId))
      .limit(1);

    if (result.length > 0) {
      const { siteId } = result[0];

      // Get user's access token for this site
      const siteResult = await d1
        .select({ accessToken: users.accessToken })
        .from(sites)
        .innerJoin(users, eq(sites.userId, users.id))
        .where(eq(sites.id, siteId))
        .limit(1);

      const accessToken = siteResult.length > 0 ? siteResult[0].accessToken : undefined;

      // Re-render the page
      try {
        const config = await loadRenderConfig(siteId, c.env.DB);
        await publishPage(config, notionPageId, {
          DB: c.env.DB,
          CONTENT: c.env.CONTENT,
          R2_PUBLIC_URL: c.env.R2_PUBLIC_URL,
          NOTION_ACCESS_TOKEN: accessToken,
        });
        console.log(`[webhook] Re-rendered page ${notionPageId} for site ${siteId}`);
      } catch (err) {
        console.error(`[webhook] Failed to re-render page ${notionPageId}: ${err}`);
      }
    }
  }

  return c.json({ ok: true });
});

export default webhooksRouter;
