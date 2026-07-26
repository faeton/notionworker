import type { NotionBlock } from "../../types.js";
import type { ImageMap } from "../../types.js";
import { renderRichText } from "../rich-text.js";

export function renderTableBlock(
  block: NotionBlock,
  _childrenHtml: string,
  imageMap?: ImageMap,
  allBlocks?: Record<string, NotionBlock>,
): string {
  if (block.type !== "table" || !allBlocks) return "";

  const columnOrder = block.format?.table_block_column_order ?? [];
  const hasColumnHeader = block.format?.table_block_column_header ?? false;
  const hasRowHeader = block.format?.table_block_row_header ?? false;
  const rowIds = block.content ?? [];

  let html = `<table>\n`;

  for (let rowIdx = 0; rowIdx < rowIds.length; rowIdx++) {
    const rowBlock = allBlocks[rowIds[rowIdx]];
    if (!rowBlock || rowBlock.type !== "table_row") continue;

    const isHeaderRow = hasColumnHeader && rowIdx === 0;
    const tag = isHeaderRow ? "th" : "td";

    html += isHeaderRow ? "<thead><tr>" : "<tr>";

    for (let colIdx = 0; colIdx < columnOrder.length; colIdx++) {
      const colId = columnOrder[colIdx];
      const cellData = (rowBlock.properties as Record<string, unknown>)?.[colId] as
        | Array<[string, ...unknown[]]>
        | undefined;
      const cellHtml = renderRichText(cellData as never, imageMap);
      const isRowHeader = hasRowHeader && colIdx === 0 && !isHeaderRow;
      const cellTag = isRowHeader ? "th" : tag;
      html += `<${cellTag}>${cellHtml}</${cellTag}>`;
    }

    html += isHeaderRow ? "</tr></thead>\n" : "</tr>\n";
  }

  html += `</table>\n`;
  return html;
}
