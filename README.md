# Notion Domain Proxy

A Cloudflare Workers project that lets you host Notion pages on your own custom domain with enhanced features like dark mode, custom fonts, SEO optimization, and the option to hardcode your settings for a single domain.

## Features

- **Custom Domain**: Host your Notion pages on your own domain
- **SEO Optimization**: Customize meta tags such as page title, description, and Open Graph tags
- **Dark Mode**: Automatically detects system preferences and allows manual toggling
- **Custom Fonts**: Easily integrate Google Fonts
- **Clean UI**: Removes Notion's default navigation elements
- **Sitemap Generation**: Automatically creates a sitemap.xml for search engines
- **URL Slugs**: Map custom, human-readable slugs to Notion page IDs
- **Manual Configuration**: Optionally hardcode your domain settings without using KV storage

## How It Works

The worker acts as a proxy between your custom domain and Notion. When a visitor accesses your domain, the worker:

1. Retrieves the domain configuration
2. Fetches the corresponding Notion page
3. Applies custom modifications (like SEO meta tags, dark mode toggle, and custom fonts)
4. Handles URL routing and slug redirection
5. Returns the modified page to the visitor

## Setup

### 1. Configuration

By default, the worker uses Cloudflare KV storage to store configurations for multiple domains. Each domain configuration should follow this structure:

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
  "CUSTOM_SCRIPT": "<script>console.log('Custom JavaScript');</script>"
}
```

If you only need to host a single domain and prefer not to use KV storage, simply uncomment and configure the `manualConfig` object in the script. When `manualConfig` is defined, the script auto-detects its presence and uses those settings instead of fetching from KV.

### 2. Deployment

1. Create a Cloudflare Workers account
2. If using KV storage, create a KV namespace called `DOMAINS_CONFIG`
3. Deploy this worker script to Cloudflare
4. Add your domain configuration to the KV namespace (if not using `manualConfig`)

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

The worker injects a dark mode toggle that:
- Detects user system preferences
- Allows manual toggling
- Persists the chosen mode during navigation

### SEO Optimization

Improve search engine visibility by customizing meta tags such as:
- Page title
- Page description
- Open Graph and Twitter tags

### Manual Configuration

For those with only a single domain or who wish to avoid using KV storage, simply uncomment and configure the `manualConfig` object in the script. The script auto-detects manual configuration if it exists and uses it instead of fetching from KV.

### Notion Username

The variable `MY_NOTION_USERNAME` (formerly `MY_NOTION_DOMAIN`) should be set to your Notion username. This value is used to construct the target Notion URL for proxying.

### Multiple Domains

When no manual configuration is provided, the worker uses KV storage to manage configurations for multiple domains, automatically selecting the correct configuration based on the incoming domain.

## Troubleshooting

**Domain not found**: Ensure your domain configuration exists in KV storage or is defined via `manualConfig`.

**Styling issues**: Custom fonts or CSS might conflict with Notion's default styles. Experiment with different settings.

**Incorrect redirects**: Double-check your SLUG_TO_PAGE mappings and Notion page IDs.



## Contributing

Contributions are welcome! Feel free to submit pull requests for new features, improvements, or bug fixes.

## License

This project is available under the MIT License.