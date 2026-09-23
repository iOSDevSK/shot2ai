// The image format the owner chose for sends to web chats and for saves:
// PNG (lossless), or JPEG / WebP at 50–100 %. html2wp always receives PNG,
// and a copy to the clipboard stays PNG (the only image type it accepts).
const TYPES = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' };
export const EXTENSIONS = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export function formatOf(s) {
  const format = TYPES[s.imageFormat] ? s.imageFormat : 'png';
  return { format, type: TYPES[format], quality: Math.min(100, Math.max(50, Number(s.imageQuality) || 90)) };
}

// The PNG re-encoded in the chosen format; the PNG itself when that is PNG.
export async function encode(png, s) {
  const { format, type, quality } = formatOf(s);
  if (format === 'png') return png;
  const bitmap = await createImageBitmap(png);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  // JPEG has no transparency: transparent pixels become white, not black.
  if (format === 'jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas.convertToBlob({ type, quality: quality / 100 });
}

export function sizeText(bytes) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
// "PNG · 212 KB" or "JPEG 80 % · 64 KB".
export function describe(blob, s) {
  const { format, quality } = formatOf(s);
  return `${format.toUpperCase()}${format === 'png' ? '' : ` ${quality} %`} · ${sizeText(blob.size)}`;
}
