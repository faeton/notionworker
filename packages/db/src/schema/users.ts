import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  notionUserId: text("notion_user_id").unique(),
  notionWorkspaceId: text("notion_workspace_id"),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  name: text("name"),
  email: text("email"),
  avatarUrl: text("avatar_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
