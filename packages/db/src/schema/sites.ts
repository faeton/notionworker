import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
import { platformDomains } from "./platform-domains.js";
import { users } from "./users.js";

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
    userId: text("user_id").references(() => users.id),
    plan: text("plan").default("free"),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    lastPublishedAt: integer("last_published_at", { mode: "timestamp" }),
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
