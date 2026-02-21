export function generateRobots(baseUrl?: string): string {
  const lines = ["User-agent: *", "Allow: /"];
  if (baseUrl) {
    lines.push("", `Sitemap: ${baseUrl}/sitemap.xml`);
  }
  return lines.join("\n") + "\n";
}
