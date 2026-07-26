-- Record when a site was last published (updated_at is for config changes)
ALTER TABLE `sites` ADD COLUMN `last_published_at` integer;
