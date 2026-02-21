import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { platformDomains } from "./platform-domains.js";

export const sites = sqliteTable(
  "sites",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    subdomain: text("subdomain").notNull(),
    platformDomainId: text("platform_domain_id")
      .notNull()
      .references(() => platformDomains.id),
    notionUsername: text("notion_username").notNull(),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    uniqueIndex("sites_subdomain_platform_idx").on(
      table.subdomain,
      table.platformDomainId
    ),
  ]
);
