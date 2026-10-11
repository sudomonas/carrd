// Image intake: validation, decoding, optional downscaling and luminance stats.

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'];
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const MAX_IMAGE_SIDE = 4096;

export class ImageError extends Error {}

export function validateImageFile(file) {
  if (!file) throw new ImageError('No file selected.');
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new ImageError('Unsupported image format. Use PNG, JPEG, WebP, GIF or AVIF.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new ImageError(`That image is ${(file.size / 1048576).toFixed(1)} MB; the limit is 15 MB.`);
  }
}

export function decodeImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => (img.naturalWidth && img.naturalHeight ? resolve(img) : reject(new ImageError('The image is empty.')));
    img.onerror = () => reject(new ImageError("The image couldn't be read. It may be damaged or in an unsupported format."));
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Downscales very large images so memory and storage stay bounded. */
export async function constrainImage(blob, img) {
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  if (longest <= MAX_IMAGE_SIDE) return null;
  const k = MAX_IMAGE_SIDE / longest;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * k);
  canvas.height = Math.round(img.naturalHeight * k);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const type = blob.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return canvasToBlob(canvas, type, 0.92);
}

/** 16 × 16 grid of relative luminance values, used for contrast decisions. */
export function lumaGrid(img, cols = 16, rows = 16) {
  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;
  const lin = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const values = [];
  for (let i = 0; i < data.length; i += 4) {
    values.push(0.2126 * lin(data[i]) + 0.7152 * lin(data[i + 1]) + 0.0722 * lin(data[i + 2]));
  }
  return { cols, rows, values };
}

/** Decodes a base64 data payload (from the metadata service) into a Blob. */
export function base64ToBlob(base64, type) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}
