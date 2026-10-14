/**
 * Downscale a photo in the browser before uploading — phone photos are often 5–10 MB.
 * Re-encodes as JPEG; the browser applies EXIF orientation when decoding.
 */
export async function resizeImage(
  file: File,
  opts: { maxDim: number; square?: boolean; quality?: number },
): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } catch {
      throw new Error("Couldn't read that image — try a JPEG or PNG.");
    }

    const w = img.naturalWidth;
    const h = img.naturalHeight;
    let sx = 0, sy = 0, sw = w, sh = h;
    if (opts.square) {
      const s = Math.min(w, h);
      sx = (w - s) / 2;
      sy = (h - s) / 2;
      sw = sh = s;
    }

    const scale = Math.min(1, opts.maxDim / Math.max(sw, sh));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser can't process images");
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("Couldn't process that image"))),
        "image/jpeg",
        opts.quality ?? 0.85,
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
