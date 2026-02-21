import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sites } from "./sites.js";

export const themes = sqliteTable("themes", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id)
    .unique(),
  googleFont: text("google_font"),
  fontSize: text("font_size"),
  colorMode: text("color_mode").default("system"),
  accentColor: text("accent_color"),
  maxWidth: text("max_width"),
  hideTopbar: integer("hide_topbar", { mode: "boolean" })
    .notNull()
    .default(true),
  faviconUrl: text("favicon_url"),
  customCss: text("custom_css"),
  customHeadHtml: text("custom_head_html"),
  customBodyHtml: text("custom_body_html"),
  showNavigation: integer("show_navigation", { mode: "boolean" })
    .notNull()
    .default(false),
  navigationLinks: text("navigation_links"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
