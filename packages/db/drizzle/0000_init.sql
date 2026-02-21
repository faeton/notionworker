CREATE TABLE `platform_domains` (
  `id` text PRIMARY KEY NOT NULL,
  `domain` text NOT NULL,
  `is_active` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `platform_domains_domain_unique` ON `platform_domains` (`domain`);

CREATE TABLE `sites` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `subdomain` text NOT NULL,
  `platform_domain_id` text NOT NULL REFERENCES `platform_domains`(`id`),
  `notion_username` text NOT NULL,
  `is_public` integer NOT NULL DEFAULT 1,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `sites_subdomain_platform_idx` ON `sites` (`subdomain`, `platform_domain_id`);

CREATE TABLE `pages` (
  `id` text PRIMARY KEY NOT NULL,
  `site_id` text NOT NULL REFERENCES `sites`(`id`),
  `notion_page_id` text NOT NULL,
  `slug` text NOT NULL,
  `title` text,
  `description` text,
  `og_image` text,
  `is_homepage` integer NOT NULL DEFAULT 0,
  `sort_order` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `pages_site_slug_idx` ON `pages` (`site_id`, `slug`);
CREATE UNIQUE INDEX `pages_site_notion_idx` ON `pages` (`site_id`, `notion_page_id`);

CREATE TABLE `domains` (
  `id` text PRIMARY KEY NOT NULL,
  `site_id` text NOT NULL REFERENCES `sites`(`id`),
  `hostname` text NOT NULL,
  `status` text NOT NULL DEFAULT 'pending',
  `cf_custom_hostname_id` text,
  `ssl_status` text,
  `is_primary` integer NOT NULL DEFAULT 0,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `domains_hostname_unique` ON `domains` (`hostname`);

CREATE TABLE `themes` (
  `id` text PRIMARY KEY NOT NULL,
  `site_id` text NOT NULL REFERENCES `sites`(`id`),
  `google_font` text,
  `font_size` text,
  `color_mode` text DEFAULT 'system',
  `accent_color` text,
  `max_width` text,
  `hide_topbar` integer NOT NULL DEFAULT 1,
  `favicon_url` text,
  `custom_css` text,
  `custom_head_html` text,
  `custom_body_html` text,
  `show_navigation` integer NOT NULL DEFAULT 0,
  `navigation_links` text,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);

CREATE UNIQUE INDEX `themes_site_id_unique` ON `themes` (`site_id`);
