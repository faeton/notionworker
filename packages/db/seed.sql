-- Seed data for notionworker testing
-- 2 platform domains, 3 sites, pages with slugs, themes, 1 custom domain

-- Platform domains
INSERT INTO platform_domains (id, domain, is_active, created_at) VALUES
  ('pd_1', 'example.com', 1, 1708000000),
  ('pd_2', 'example.org', 1, 1708000000);

-- Sites
-- testsite on example.com (your-notion-username's notion)
INSERT INTO sites (id, name, subdomain, platform_domain_id, notion_username, is_public, created_at, updated_at) VALUES
  ('site_1', 'Test Site', 'testsite', 'pd_1', 'your-notion-username', 1, 1708000000, 1708000000),
  ('site_2', 'Demo Site', 'demo', 'pd_1', 'your-notion-username', 1, 1708000000, 1708000000),
  ('site_3', 'Hello Site', 'hello', 'pd_2', 'your-notion-username', 1, 1708000000, 1708000000);

-- Pages for testsite (site_1)
-- Replace these notion_page_id values with real Notion page IDs for testing
INSERT INTO pages (id, site_id, notion_page_id, slug, title, description, og_image, is_homepage, sort_order, created_at, updated_at) VALUES
  ('page_1', 'site_1', 'REPLACE_WITH_REAL_NOTION_PAGE_ID_1', '', 'Test Site Home', 'Welcome to the test site', NULL, 1, 0, 1708000000, 1708000000),
  ('page_2', 'site_1', 'REPLACE_WITH_REAL_NOTION_PAGE_ID_2', 'about', 'About Us', 'Learn about our test site', NULL, 0, 1, 1708000000, 1708000000),
  ('page_3', 'site_1', 'REPLACE_WITH_REAL_NOTION_PAGE_ID_3', 'contact', 'Contact', 'Get in touch with us', NULL, 0, 2, 1708000000, 1708000000);

-- Pages for demo (site_2)
INSERT INTO pages (id, site_id, notion_page_id, slug, title, description, og_image, is_homepage, sort_order, created_at, updated_at) VALUES
  ('page_4', 'site_2', 'REPLACE_WITH_REAL_NOTION_PAGE_ID_4', '', 'Demo Home', 'Demo site homepage', NULL, 1, 0, 1708000000, 1708000000),
  ('page_5', 'site_2', 'REPLACE_WITH_REAL_NOTION_PAGE_ID_5', 'features', 'Features', 'Our awesome features', NULL, 0, 1, 1708000000, 1708000000);

-- Pages for hello (site_3)
INSERT INTO pages (id, site_id, notion_page_id, slug, title, description, og_image, is_homepage, sort_order, created_at, updated_at) VALUES
  ('page_6', 'site_3', 'REPLACE_WITH_REAL_NOTION_PAGE_ID_6', '', 'Hello World', 'A site on example.org', NULL, 1, 0, 1708000000, 1708000000),
  ('page_7', 'site_3', 'REPLACE_WITH_REAL_NOTION_PAGE_ID_7', 'blog', 'Blog', 'Our blog posts', NULL, 0, 1, 1708000000, 1708000000);

-- Custom domain pointing to testsite
INSERT INTO domains (id, site_id, hostname, status, cf_custom_hostname_id, ssl_status, is_primary, created_at, updated_at) VALUES
  ('dom_1', 'site_1', 'test.example.com', 'active', NULL, NULL, 1, 1708000000, 1708000000);

-- Theme for testsite (Inter font, dark mode, custom CSS)
INSERT INTO themes (id, site_id, google_font, font_size, color_mode, accent_color, max_width, hide_topbar, favicon_url, custom_css, custom_head_html, custom_body_html, show_navigation, navigation_links, created_at, updated_at) VALUES
  ('theme_1', 'site_1', 'Inter', '16px', 'system', '#2563eb', '720px', 1, NULL, 'body { background: #fafafa; }', NULL, NULL, 1, '[{"label":"Home","slug":""},{"label":"About","slug":"about"},{"label":"Contact","slug":"contact"}]', 1708000000, 1708000000);

-- Theme for demo (Roboto, always dark)
INSERT INTO themes (id, site_id, google_font, font_size, color_mode, accent_color, max_width, hide_topbar, favicon_url, custom_css, custom_head_html, custom_body_html, show_navigation, navigation_links, created_at, updated_at) VALUES
  ('theme_2', 'site_2', 'Roboto', '15px', 'dark', '#10b981', '800px', 1, NULL, NULL, NULL, NULL, 1, '[{"label":"Home","slug":""},{"label":"Features","slug":"features"}]', 1708000000, 1708000000);
