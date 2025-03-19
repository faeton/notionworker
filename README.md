# Notion Domain Proxy

A Cloudflare Workers project that lets you host Notion pages on your own custom domain with added features like dark mode, custom fonts, and SEO optimization.

## Features

- **Custom Domain**: Host your Notion pages on your own domain
- **SEO Optimization**: Customize page titles and descriptions
- **Dark Mode**: Automatically switches based on user preferences
- **Custom Fonts**: Add Google Fonts to your Notion pages
- **Clean UI**: Removes Notion's default navigation and UI elements
- **Sitemap Generation**: Automatically generates sitemap.xml for search engines
- **URL Slugs**: Map custom slugs to Notion page IDs

## How It Works

This worker acts as a proxy between your custom domain and Notion. When a visitor accesses your domain, the worker:

1. Fetches the corresponding Notion page
2. Modifies the HTML to add customizations
3. Handles routing between custom slugs and Notion page IDs
4. Returns the modified page to the visitor

## Setup

### 1. Configuration

The worker uses Cloudflare KV storage to store domain configurations. Each domain configuration contains:

```json
{
  "SLUG_TO_PAGE": {
    "": "homepage-notion-id",
    "about": "about-page-notion-id",
    "contact": "contact-page-notion-id"
  },
  "PAGE_TITLE": "Your Site Title",
  "PAGE_DESCRIPTION": "Your site description for SEO",
  "GOOGLE_FONT": "Font Name",
  "CUSTOM_SCRIPT": "<script>console.log('Custom JavaScript')</script>"
}
```

### 2. Deployment

1. Create a Cloudflare Workers account
2. Create a KV namespace called `DOMAINS_CONFIG`
3. Deploy this worker script to Cloudflare
4. Add your domain configuration to the KV namespace with your domain as the key

### 3. DNS Setup

1. Add your custom domain to Cloudflare
2. Point your domain to the Cloudflare Worker

## Features Explained

### Custom Slugs

Instead of using Notion's long page IDs in URLs, you can map them to readable slugs:

```
https://yourdomain.com/about instead of https://yourdomain.com/83f7dd5879884c5f89326a1541629b20
```

### Dark Mode Toggle

The worker adds a dark mode toggle in the top navigation that:
- Detects user system preferences
- Allows manual toggling
- Persists the chosen mode

### SEO Optimization

Customize meta tags for better search engine visibility:
- Page title
- Page description
- Open Graph tags

## Limitations

- The worker only works with publicly accessible Notion pages
- Some Notion features might not work correctly (e.g., synced blocks)
- Changes to your Notion page are immediately reflected on your domain

## Troubleshooting

**Page not found**: Check your SLUG_TO_PAGE mapping and ensure the Notion page is public.

**Styling issues**: Custom fonts might conflict with Notion's default styles. Try different fonts or reduce custom CSS.

**Incorrect redirects**: Verify that all page IDs in your SLUG_TO_PAGE configuration are correct.

## Advanced Configuration

### Custom JavaScript

Add custom JavaScript by setting the `CUSTOM_SCRIPT` value in your domain configuration:

```json
"CUSTOM_SCRIPT": "<script>console.log('Hello from custom script'); // Add analytics, custom behavior, etc.</script>"
```

### Multiple Domains

You can use this worker for multiple domains by adding each domain configuration to the KV store.

## Contributing

Contributions are welcome! Feel free to submit pull requests for new features or bug fixes.

## License

This project is available for use under the MIT License.