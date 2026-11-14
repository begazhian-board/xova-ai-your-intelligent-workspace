/**
 * Deterministic text layout for XOVA image generation.
 * Draws the user's exact text in the browser; no second AI call is made.
 * Pipe- or tab-separated rows are automatically laid out as a table.
 */
type TextBlock = { kind: "heading" | "paragraph" | "bullet"; text: string };

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const result: string[] = [];
  const paragraphs = text.split(/\\r?\\n/);
  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      result.push("");
      continue;
    }
    const words = trimmed.split(/\\s+/);
    let line = "";
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && context.measureText(candidate).width > maxWidth) {
        result.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) result.push(line);
  }
  return result;
}

function parseTextBlocks(text: string): TextBlock[] {
  const lines = text.trim().split(/\\r?\\n/);
  const firstNonEmpty = lines.findIndex((line) => line.trim().length > 0);
  if (firstNonEmpty < 0) return [];

  return lines.map((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return { kind: "paragraph", text: "" };
    if (/^(?:[-*•]|\\d+[.)、])\\s*/.test(trimmed)) {
      return { kind: "bullet", text: trimmed.replace(/^(?:[-*•]|\\d+[.)、])\\s*/, "") };
    }
    if (index === firstNonEmpty) return { kind: "heading", text: trimmed };
    return { kind: "paragraph", text: trimmed };
  });
}

function renderDocument(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
) {
  const margin = Math.round(width * 0.045);
  const panelX = margin;
  const panelY = margin;
  const panelWidth = width - margin * 2;
  const panelHeight = height - margin * 2;
  const innerX = Math.round(width * 0.055);
  const innerY = Math.round(height * 0.045);
  const contentWidth = panelWidth - innerX * 2;
  const maxContentHeight = panelHeight - innerY * 2 - Math.round(height * 0.025);
  const isArabic = /[\\u0600-\\u06ff\\u0750-\\u077f\\u08a0-\\u08ff]/.test(text);

  context.save();
  context.shadowColor = "rgba(0,0,0,0.22)";
  context.shadowBlur = Math.round(width * 0.018);
  context.shadowOffsetY = Math.round(width * 0.006);
  context.beginPath();
  context.roundRect(panelX, panelY, panelWidth, panelHeight, Math.round(width * 0.02));
  context.fillStyle = "rgba(255,252,245,0.975)";
  context.fill();
  context.restore();

  context.beginPath();
  context.roundRect(panelX, panelY, panelWidth, panelHeight, Math.round(width * 0.02));
  context.lineWidth = Math.max(2, Math.round(width * 0.002));
  context.strokeStyle = "rgba(181,138,75,0.9)";
  context.stroke();

  const blocks = parseTextBlocks(text);
  const heading = blocks.find((block) => block.kind === "heading");
  const bodyBlocks = heading ? blocks.slice(1) : blocks;
  const headingSize = Math.max(20, Math.round(width * 0.036));
  const headingHeight = heading ? Math.round(headingSize * 1.7) : 0;
  const headingGap = heading ? Math.round(height * 0.02) : 0;
  let bodyFontSize = Math.max(12, Math.round(width * 0.024));
  let lineHeight = 0;
  let layout: Array<{ block: TextBlock; lines: string[] }> = [];
  let requiredHeight = 0;

  while (bodyFontSize >= 11) {
    lineHeight = Math.round(bodyFontSize * 1.48);
    context.font = `600 ${bodyFontSize}px "Noto Sans Arabic", Tahoma, Arial, sans-serif`;
    layout = bodyBlocks.map((block) => {
      const prefix = block.kind === "bullet" ? (isArabic ? "• " : "• ") : "";
      return { block, lines: wrapText(context, prefix + block.text, contentWidth) };
    });
    requiredHeight = layout.reduce(
      (total, item) =>
        total + Math.max(1, item.lines.length) * lineHeight +
        (item.block.text ? Math.round(bodyFontSize * 0.38) : Math.round(bodyFontSize * 0.2)),
      0,
    );
    if (requiredHeight + headingHeight + headingGap <= maxContentHeight) break;
    bodyFontSize -= 1;
  }

  context.direction = isArabic ? "rtl" : "ltr";
  if (heading) {
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#173c32";
    context.font = `800 ${headingSize}px "Noto Sans Arabic", Tahoma, Arial, sans-serif`;
    context.fillText(heading.text, width / 2, panelY + innerY + headingHeight / 2, contentWidth);
  }

  context.textAlign = isArabic ? "right" : "left";
  context.textBaseline = "top";
  context.fillStyle = "#24231f";
  context.font = `600 ${bodyFontSize}px "Noto Sans Arabic", Tahoma, Arial, sans-serif`;
  let y = panelY + innerY + headingHeight + headingGap;
  const textX = isArabic ? panelX + panelWidth - innerX : panelX + innerX;

  for (const item of layout) {
    for (const line of item.lines) {
      if (line) context.fillText(line, textX, y, contentWidth);
      y += lineHeight;
    }
    y += item.block.text ? Math.round(bodyFontSize * 0.38) : Math.round(bodyFontSize * 0.2);
  }

  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.direction = "ltr";
  context.fillStyle = "#927044";
  context.font = `600 ${Math.max(10, Math.round(width * 0.012))}px Arial, sans-serif`;
  context.fillText("XOVA AI", width / 2, panelY + panelHeight - Math.round(innerY * 0.3));
}

function renderTable(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  text: string,
) {
  const lines = text.split(/\\r?\\n/).map((line) => line.trim()).filter(Boolean);
  const parsed = lines.map((line) => line.split(line.includes("\\t") ? "\\t" : "|").map((cell) => cell.trim()));
  const columnCount = Math.max(...parsed.map((row) => row.length));
  const rows = parsed.map((row) => Array.from({ length: columnCount }, (_, index) => row[index] ?? ""));
  const margin = Math.round(width * 0.045);
  const panelX = margin;
  const panelY = margin;
  const panelWidth = width - margin * 2;
  const panelHeight = height - margin * 2;
  const padding = Math.round(width * 0.028);
  const tableX = panelX + padding;
  const tableY = panelY + padding;
  const tableWidth = panelWidth - padding * 2;
  const tableHeight = panelHeight - padding * 2;
  const fontSize = Math.max(11, Math.min(24, Math.round(width * 0.021)));
  const lineHeight = Math.round(fontSize * 1.45);
  const rowHeight = Math.floor(tableHeight / rows.length);
  const colWidth = tableWidth / columnCount;
  const isArabic = /[\\u0600-\\u06ff\\u0750-\\u077f\\u08a0-\\u08ff]/.test(text);

  context.save();
  context.shadowColor = "rgba(0,0,0,0.18)";
  context.shadowBlur = Math.round(width * 0.012);
  context.beginPath();
  context.roundRect(panelX, panelY, panelWidth, panelHeight, Math.round(width * 0.02));
  context.fillStyle = "rgba(255,252,245,0.985)";
  context.fill();
  context.restore();

  context.beginPath();
  context.roundRect(panelX, panelY, panelWidth, panelHeight, Math.round(width * 0.02));
  context.strokeStyle = "#b58a4b";
  context.lineWidth = Math.max(2, width * 0.002);
  context.stroke();

  context.font = `600 ${fontSize}px "Noto Sans Arabic", Tahoma, Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.direction = isArabic ? "rtl" : "ltr";

  rows.forEach((row, rowIndex) => {
    const y = tableY + rowIndex * rowHeight;
    context.fillStyle = rowIndex === 0 ? "rgba(31,90,73,0.16)" : (rowIndex % 2 ? "rgba(0,0,0,0.025)" : "rgba(255,255,255,0.45)");
    context.fillRect(tableX, y, tableWidth, rowHeight);
    row.forEach((cell, colIndex) => {
      const x = tableX + colIndex * colWidth;
      context.strokeStyle = "rgba(181,138,75,0.55)";
      context.lineWidth = Math.max(1, width * 0.001);
      context.strokeRect(x, y, colWidth, rowHeight);
      const cellLines = wrapText(context, cell, colWidth - padding * 0.55);
      const visibleLines = cellLines.slice(0, Math.max(1, Math.floor(rowHeight / lineHeight)));
      const startY = y + rowHeight / 2 - (visibleLines.length * lineHeight) / 2 + lineHeight / 2;
      context.fillStyle = rowIndex === 0 ? "#173c32" : "#24231f";
      context.font = `${rowIndex === 0 ? "800" : "600"} ${fontSize}px "Noto Sans Arabic", Tahoma, Arial, sans-serif`;
      visibleLines.forEach((cellLine, index) => {
        context.fillText(cellLine, x + colWidth / 2, startY + index * lineHeight, colWidth - padding * 0.55);
      });
    });
  });
}

export async function renderImageWithText(imageUrl: string, text: string): Promise<Blob> {
  const cleanText = text.trim();
  if (!cleanText) throw new Error("Text overlay is empty");

  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error("Could not load the generated image");
  const bitmap = await createImageBitmap(await response.blob());

  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.drawImage(bitmap, 0, 0);

    const tableLines = cleanText.split(/\\r?\\n/).filter((line) => line.trim());
    const isTable = tableLines.length >= 2 &&
      tableLines.every((line) => line.includes("|") || line.includes("\\t")) &&
      new Set(tableLines.map((line) => line.includes("\\t") ? line.split("\\t").length : line.split("|").length)).size === 1;

    if (isTable) {
      renderTable(context, canvas.width, canvas.height, cleanText);
    } else {
      renderDocument(context, canvas.width, canvas.height, cleanText);
    }

    const output = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!output) throw new Error("Could not render the text overlay");
    return output;
  } finally {
    bitmap.close();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not encode the final image"));
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not encode the final image"));
    reader.readAsDataURL(blob);
  });
}
