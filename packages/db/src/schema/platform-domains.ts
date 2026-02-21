import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const platformDomains = sqliteTable("platform_domains", {
  id: text("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
