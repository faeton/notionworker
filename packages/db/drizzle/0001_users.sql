-- Users authenticated via Notion OAuth
CREATE TABLE `users` (
  `id` text PRIMARY KEY NOT NULL,
  `notion_user_id` text,
  `notion_workspace_id` text,
  `access_token` text NOT NULL,
  `refresh_token` text,
  `name` text,
  `email` text,
  `avatar_url` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `users_notion_user_id_unique` ON `users` (`notion_user_id`);

-- Sessions for cookie-based auth
CREATE TABLE `sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`),
  `expires_at` integer NOT NULL,
  `created_at` integer NOT NULL
);

-- Add user_id and plan columns to sites
ALTER TABLE `sites` ADD COLUMN `user_id` text REFERENCES `users`(`id`);
ALTER TABLE `sites` ADD COLUMN `plan` text DEFAULT 'free';
