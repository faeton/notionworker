import type { SiteConfig, PageConfig } from "../types.js";
import { MetaRewriter } from "./meta.js";
import { HeadRewriter } from "./head.js";
import { BodyRewriter } from "./body.js";

export function applyRewriters(
  response: Response,
  config: SiteConfig,
  currentPage: PageConfig | null
): Response {
  return new HTMLRewriter()
    .on("title", new MetaRewriter(config, currentPage))
    .on("meta", new MetaRewriter(config, currentPage))
    .on("head", new HeadRewriter(config))
    .on("body", new BodyRewriter(config))
    .transform(response);
}
