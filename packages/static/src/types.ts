// Notion API types

/** Rich text decoration: ["b"], ["i"], ["a", "url"], ["h", "color"], etc. */
export type Decoration = [string, ...string[]];

/** A single rich text segment: ["text"] or ["text", [decoration, ...]] */
export type RichTextSegment = [string] | [string, Decoration[]];

/** Rich text is an array of segments */
export type RichText = RichTextSegment[];

export interface NotionBlock {
  id: string;
  type: string;
  properties?: {
    title?: RichText;
    description?: RichText;
    caption?: RichText;
    language?: [[string]];
    source?: [[string]];
    link?: [[string]];
    checked?: [["Yes" | "No"]];
  };
  content?: string[];
  format?: {
    page_icon?: string;
    page_cover?: string;
    page_cover_position?: number;
    block_color?: string;
    block_width?: number;
    display_source?: string;
    bookmark_icon?: string;
    bookmark_cover?: string;
    column_ratio?: number;
    table_block_column_order?: string[];
    table_block_column_header?: boolean;
    table_block_row_header?: boolean;
  };
  alive?: boolean;
  parent_id?: string;
  parent_table?: string;
  space_id?: string;
}

export interface NotionRecordMap {
  block: Record<string, { value?: NotionBlock; role: string }>;
}

export interface LoadPageChunkResponse {
  recordMap: NotionRecordMap;
  cursor: { stack: unknown[] };
}

// Static site generator config

export interface SiteConfig {
  /** Notion username (e.g., "faeton") */
  username: string;
  /** Output directory */
  outputDir: string;
  /** Base URL for canonical links and sitemap */
  baseUrl?: string;
  /** Site title override */
  title?: string;
  /** Site description override */
  description?: string;
  /** Google Font name */
  font?: string;
  /** Whether to follow sub-page links */
  recursive: boolean;
  /** Whether to download images locally */
  downloadImages: boolean;
}

export interface PageData {
  /** Page block ID (with dashes) */
  id: string;
  /** Page title from properties */
  title: string;
  /** Page icon emoji */
  icon?: string;
  /** Page cover image URL */
  cover?: string;
  /** Cover vertical position (0–1) */
  coverPosition?: number;
  /** Slug for URL (empty string = root) */
  slug: string;
  /** All blocks keyed by ID */
  blocks: Record<string, NotionBlock>;
  /** Content block IDs (children of the page) */
  contentIds: string[];
}

/** Map of original image URL → local/hosted URL */
export type ImageMap = Map<string, string>;
