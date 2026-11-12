/** Downloads an image with a crisp, exact XOVA AI watermark baked into the pixels. */
export async function downloadWatermarkedImage(imageUrl: string, filename: string) {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Image download failed with status ${response.status}`);
  }

  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");

    context.drawImage(bitmap, 0, 0);

    const fontSize = Math.max(12, Math.min(48, Math.round(bitmap.width * 0.028)));
    const padX = Math.round(fontSize * 0.7);
    const padY = Math.round(fontSize * 0.38);
    context.font = `600 ${fontSize}px system-ui, sans-serif`;

    const label = "XOVA AI";
    const textWidth = context.measureText(label).width;
    const boxWidth = textWidth + padX * 2;
    const boxHeight = fontSize + padY * 2;
    const margin = Math.round(fontSize * 0.85);
    const x = bitmap.width - boxWidth - margin;
    const y = bitmap.height - boxHeight - margin;
    const radius = Math.round(fontSize * 0.28);

    context.beginPath();
    context.roundRect(x, y, boxWidth, boxHeight, radius);
    context.fillStyle = "rgba(0, 0, 0, 0.42)";
    context.fill();

    context.fillStyle = "rgba(255, 255, 255, 0.94)";
    context.textBaseline = "middle";
    context.fillText(label, x + padX, y + boxHeight / 2);

    const watermarked = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!watermarked) throw new Error("Could not encode the watermarked image");

    const objectUrl = URL.createObjectURL(watermarked);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } finally {
    bitmap.close();
  }
}
