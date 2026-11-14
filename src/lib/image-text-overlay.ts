/**
 * Adds exact user-supplied text to a generated image in the browser.
 * This is deterministic canvas rendering and does not call an AI provider.
 */
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

    const width = canvas.width;
    const height = canvas.height;
    const maxTextWidth = width * 0.82;
    const panelMaxHeight = height * 0.48;
    const paddingX = Math.max(24, Math.round(width * 0.045));
    const paddingY = Math.max(18, Math.round(width * 0.028));
    const margin = Math.max(24, Math.round(width * 0.045));
    const isArabic = /[\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff]/.test(cleanText);
    const direction: CanvasDirection = isArabic ? "rtl" : "ltr";

    const wrap = (value: string, maxWidth: number) => {
      const result: string[] = [];
      for (const paragraph of value.split(/\r?\n/)) {
        const words = paragraph.trim().split(/\s+/).filter(Boolean);
        if (!words.length) {
          result.push("");
          continue;
        }
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
    };

    let fontSize = Math.max(22, Math.min(68, Math.round(width * 0.055)));
    let lines: string[] = [];
    let lineHeight = 0;
    let panelHeight = 0;

    while (fontSize >= 20) {
      context.font = `700 ${fontSize}px "Noto Sans Arabic", Tahoma, Arial, sans-serif`;
      lines = wrap(cleanText, maxTextWidth);
      lineHeight = Math.round(fontSize * 1.55);
      panelHeight = lines.length * lineHeight + paddingY * 2;
      if (panelHeight <= panelMaxHeight) break;
      fontSize -= 2;
    }

    context.font = `700 ${fontSize}px "Noto Sans Arabic", Tahoma, Arial, sans-serif`;
    context.direction = direction;
    context.textAlign = "center";
    context.textBaseline = "middle";

    const panelWidth = Math.min(width - margin * 2, maxTextWidth + paddingX * 2);
    const panelX = (width - panelWidth) / 2;
    const panelY = height - panelHeight - margin;
    const radius = Math.max(12, Math.round(fontSize * 0.42));

    context.save();
    context.shadowColor = "rgba(0, 0, 0, 0.28)";
    context.shadowBlur = Math.max(12, Math.round(width * 0.018));
    context.shadowOffsetY = Math.max(4, Math.round(width * 0.006));
    context.beginPath();
    context.roundRect(panelX, panelY, panelWidth, panelHeight, radius);
    context.fillStyle = "rgba(255, 250, 237, 0.96)";
    context.fill();
    context.restore();

    context.beginPath();
    context.roundRect(panelX, panelY, panelWidth, panelHeight, radius);
    context.lineWidth = Math.max(2, Math.round(width * 0.0025));
    context.strokeStyle = "rgba(183, 143, 78, 0.95)";
    context.stroke();

    context.fillStyle = "#171717";
    const textCenterX = width / 2;
    const firstLineY = panelY + paddingY + lineHeight / 2;
    for (let index = 0; index < lines.length; index += 1) {
      context.fillText(lines[index], textCenterX, firstLineY + index * lineHeight, maxTextWidth);
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
