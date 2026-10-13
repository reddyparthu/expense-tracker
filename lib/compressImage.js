// Shrinks a photo to at most `maxDim` px on its longest side and re-encodes it as
// JPEG, lowering quality until it fits `maxBytes`. Receipts stay perfectly
// readable at ~2000px, and OCR runs much faster than on a 12 MP original.
export async function prepareImage(file, { maxDim = 2000, maxBytes = 1024 * 1024 } = {}) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not open this image"));
      el.src = url;
    });

    const ratio = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * ratio);
    const height = Math.round(img.naturalHeight * ratio);
    if (ratio === 1 && file.size <= maxBytes && file.type === "image/jpeg") return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; // transparent PNG screenshots → white paper
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    let quality = 0.88;
    let blob = null;
    while (quality >= 0.4) {
      blob = await new Promise((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (blob && blob.size <= maxBytes) break;
      quality -= 0.12;
    }
    return new File([blob], "receipt.jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Kept for older callers
export const compressImage = (file) => prepareImage(file);
