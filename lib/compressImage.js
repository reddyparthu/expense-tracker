export async function compressImage(file, maxSizeBytes = 1.8 * 1024 * 1024) {
  // If already small enough, return as-is
  if (file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      let width = img.width;
      let height = img.height;

      // Step 1: Resize if image is very large
      const maxDim = 2500;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);

      // Step 2: Reduce JPEG quality until under limit
      let quality = 0.8;
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (blob.size <= maxSizeBytes || quality <= 0.2) {
              // Convert blob to file
              const compressed = new File([blob], "receipt.jpg", {
                type: "image/jpeg",
              });
              URL.revokeObjectURL(url);
              resolve(compressed);
            } else {
              quality -= 0.15;
              tryCompress();
            }
          },
          "image/jpeg",
          quality
        );
      };

      tryCompress();
    };

    img.src = url;
  });
}