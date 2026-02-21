import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sites } from "./sites.js";

export const domains = sqliteTable("domains", {
  id: text("id").primaryKey(),
  siteId: text("site_id")
    .notNull()
    .references(() => sites.id),
  hostname: text("hostname").notNull().unique(),
  status: text("status").notNull().default("pending"),
  cfCustomHostnameId: text("cf_custom_hostname_id"),
  sslStatus: text("ssl_status"),
  isPrimary: integer("is_primary", { mode: "boolean" })
    .notNull()
    .default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
