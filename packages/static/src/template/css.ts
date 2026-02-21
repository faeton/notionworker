export function generateCss(font?: string): string {
  const fontImport = font
    ? `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}&display=swap');\n`
    : "";

  const fontFamily = font
    ? `"${font}", `
    : "";

  return `${fontImport}:root {
  --text-color: #37352f;
  --bg-color: #ffffff;
  --secondary-bg: #f7f6f3;
  --border-color: #e9e9e7;
  --quote-border: #e9e9e7;
  --quote-bg: #f7f6f3;
  --code-bg: #f7f6f3;
}

@media (prefers-color-scheme: dark) {
  :root {
    --text-color: #ffffffcf;
    --bg-color: #191919;
    --secondary-bg: #202020;
    --border-color: #2f2f2f;
    --quote-border: #2f2f2f;
    --quote-bg: #202020;
    --code-bg: #202020;
  }
  figcaption { color: rgba(255,255,255,0.4) !important; }
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: ${fontFamily}-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif;
  color: var(--text-color);
  background: var(--bg-color);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

.page {
  max-width: 720px;
  margin: 0 auto;
  padding: 80px 40px 120px;
}

.page-cover { width: 100%; height: 30vh; min-height: 200px; max-height: 320px; overflow: hidden; }
.page-cover img { width: 100%; height: 100%; object-fit: cover; }
.page-cover + .page .page-header { margin-top: -120px; }
.page-cover + .page .page-icon { margin-bottom: 12px; }

.page-header { margin-bottom: 32px; }
.page-icon { font-size: 78px; line-height: 1.1; margin-bottom: 8px; }
.page-icon-img { width: 78px; height: 78px; object-fit: contain; }
.page-title { font-size: 40px; font-weight: 700; line-height: 1.2; margin-bottom: 4px; }

h1 { font-size: 1.875em; font-weight: 600; margin-top: 32px; margin-bottom: 4px; line-height: 1.3; }
h2 { font-size: 1.5em; font-weight: 600; margin-top: 28px; margin-bottom: 4px; line-height: 1.3; }
h3 { font-size: 1.25em; font-weight: 600; margin-top: 24px; margin-bottom: 4px; line-height: 1.3; }

p { margin-top: 2px; margin-bottom: 2px; padding: 3px 0; }

blockquote {
  margin: 4px 0;
  padding: 12px 20px;
  border-left: 3px solid var(--text-color);
  font-size: 1em;
}

hr { border: none; border-top: 1px solid var(--border-color); margin: 16px 0; }

.spacer { height: 1em; }

a {
  color: inherit;
  text-decoration: underline;
  text-underline-offset: 3px;
  text-decoration-color: var(--border-color);
}
a:hover { text-decoration-color: var(--text-color); }

strong { font-weight: 600; }

code {
  background: var(--code-bg);
  padding: 2px 5px;
  border-radius: 3px;
  font-size: 0.9em;
  font-family: "SFMono-Regular", Menlo, Consolas, "PT Mono", "Liberation Mono", Courier, monospace;
}

pre {
  background: var(--code-bg);
  padding: 16px;
  border-radius: 3px;
  overflow-x: auto;
  margin: 4px 0;
}
pre code {
  background: none;
  padding: 0;
  font-size: 0.875em;
  line-height: 1.6;
}

.code-caption {
  text-align: center;
  font-size: 0.875em;
  color: rgba(55, 53, 47, 0.6);
  margin-top: 4px;
}

/* Lists */
ul, ol { padding-left: 1.5em; margin: 2px 0; }
li { padding: 2px 0; }
.to-do-list { list-style: none; padding-left: 0; }
.to-do input[type="checkbox"] { margin-right: 6px; }

/* Callout */
.callout {
  display: flex;
  padding: 16px;
  border-radius: 3px;
  background: var(--secondary-bg);
  margin: 4px 0;
}
.callout-icon { margin-right: 8px; font-size: 1.2em; flex-shrink: 0; }
.callout-content { flex: 1; min-width: 0; }

/* Media */
figure { margin: 8px 0; }
figure img { max-width: 100%; border-radius: 3px; }
figcaption {
  text-align: center;
  font-size: 0.875em;
  color: rgba(55, 53, 47, 0.6);
  margin-top: 6px;
}

/* Bookmark */
.bookmark {
  display: flex;
  text-decoration: none !important;
  border: 1px solid var(--border-color);
  border-radius: 3px;
  overflow: hidden;
  margin: 4px 0;
}
.bookmark-info { flex: 1; padding: 12px 14px; min-width: 0; }
.bookmark-title { font-size: 0.875em; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bookmark-description { font-size: 0.75em; margin-top: 2px; color: rgba(55,53,47,0.6); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.bookmark-url { font-size: 0.75em; margin-top: 4px; color: rgba(55,53,47,0.4); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bookmark-cover { width: 120px; object-fit: cover; flex-shrink: 0; }

/* Video / Embed */
.video-embed, .embed {
  position: relative;
  padding-bottom: 56.25%;
  margin: 8px 0;
}
.video-embed iframe, .embed iframe {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
}

/* Column layout */
.column-list { display: flex; gap: 16px; margin: 4px 0; }
.column { min-width: 0; }
@media (max-width: 600px) {
  .column-list { flex-direction: column; }
}

/* Toggle */
details { margin: 4px 0; }
summary { cursor: pointer; padding: 4px 0; }
.toggle-content { padding-left: 1.5em; }

/* Table */
table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 0.875em; }
th, td { border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; }
th { background: var(--secondary-bg); font-weight: 600; }

/* Page link */
.page-link {
  display: block;
  padding: 4px 0;
  text-decoration: none !important;
  color: inherit;
}
.page-link:hover { background: var(--secondary-bg); }

/* Notion colors */
.notion-gray { color: #9b9a97; }
.notion-brown { color: #64473a; }
.notion-orange { color: #d9730d; }
.notion-yellow { color: #dfab01; }
.notion-green { color: #0f7b6c; }
.notion-blue { color: #0b6e99; }
.notion-purple { color: #6940a5; }
.notion-pink { color: #ad1a72; }
.notion-red { color: #e03e3e; }
.notion-gray-background { background: #ebeced; }
.notion-brown-background { background: #e9e5e3; }
.notion-orange-background { background: #faebdd; }
.notion-yellow-background { background: #fbf3db; }
.notion-green-background { background: #ddedea; }
.notion-blue-background { background: #ddebf1; }
.notion-purple-background { background: #eae4f2; }
.notion-pink-background { background: #f4dfeb; }
.notion-red-background { background: #fbe4e4; }

@media (prefers-color-scheme: dark) {
  .notion-gray { color: #979a9b; }
  .notion-brown { color: #937264; }
  .notion-orange { color: #ffa344; }
  .notion-yellow { color: #ffdc49; }
  .notion-green { color: #4dab9a; }
  .notion-blue { color: #529cca; }
  .notion-purple { color: #9a6dd7; }
  .notion-pink { color: #e255a1; }
  .notion-red { color: #ff7369; }
  .notion-gray-background { background: #454b4e; }
  .notion-brown-background { background: #434040; }
  .notion-orange-background { background: #594a3a; }
  .notion-yellow-background { background: #59563b; }
  .notion-green-background { background: #354c4b; }
  .notion-blue-background { background: #364954; }
  .notion-purple-background { background: #443f57; }
  .notion-pink-background { background: #533b4c; }
  .notion-red-background { background: #594141; }
}

.footer {
  margin-top: 60px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color);
  font-size: 0.8em;
  color: rgba(55, 53, 47, 0.5);
}
@media (prefers-color-scheme: dark) {
  .footer { color: rgba(255,255,255,0.3); }
}`;
}
