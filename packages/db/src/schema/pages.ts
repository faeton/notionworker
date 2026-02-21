import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sites } from "./sites.js";

export const pages = sqliteTable(
  "pages",
  {
    id: text("id").primaryKey(),
    siteId: text("site_id")
      .notNull()
      .references(() => sites.id),
    notionPageId: text("notion_page_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title"),
    description: text("description"),
    ogImage: text("og_image"),
    isHomepage: integer("is_homepage", { mode: "boolean" })
      .notNull()
      .default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("pages_site_slug_idx").on(table.siteId, table.slug),
    uniqueIndex("pages_site_notion_idx").on(table.siteId, table.notionPageId),
  ]
);
