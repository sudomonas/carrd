// Export pipeline: fonts -> images -> recompose at exact size -> overflow
// check -> render -> encode -> download. Dependencies are injectable for tests.
import { composeCard } from '../engine/compose.js';
import { renderScene } from './canvas.js';

export const EXPORT_FORMATS = [
  { id: 'png', label: 'PNG', mime: 'image/png', ext: 'png' },
  { id: 'jpeg', label: 'JPEG', mime: 'image/jpeg', ext: 'jpg', quality: 0.92 },
];

export class ExportError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Lowercase ASCII slug from the card title; never empty, never a path. */
export function sanitizeFilename(title, width, height, ext) {
  const slug = String(title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `${slug || 'carrd-card'}-${width}x${height}.${ext}`;
}

export function titleForFilename(content) {
  return content.title || content.quote || content.items?.[0] || content.body?.split('\n')[0] || '';
}

function defaultCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function defaultDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * @param doc      { content, design }
 * @param deps     { env, images, texture, ensureFonts, ensureImages, createCanvas, download }
 * @returns        { filename, width, height, bytes }
 */
export async function exportCard(doc, formatId, deps) {
  const format = EXPORT_FORMATS.find((f) => f.id === formatId) ?? EXPORT_FORMATS[0];
  const { env, images = {}, texture = null } = deps;
  const createCanvas = deps.createCanvas ?? defaultCanvas;
  const download = deps.download ?? defaultDownload;

  // 1–2. Fonts and images must be resolved before anything is measured.
  if (deps.ensureFonts) await deps.ensureFonts();
  if (deps.ensureImages) await deps.ensureImages();

  // 3–4. Recompose at the selected dimensions and refuse to export clipped text.
  const scene = composeCard(doc, env);
  if (!scene.ok) throw new ExportError('empty', scene.notices[0]?.text ?? 'Nothing to export yet.');
  if (!scene.fits) {
    const msg = scene.notices.find((n) => n.level === 'error')?.text;
    throw new ExportError('overflow', `Export stopped so text isn't cut off. ${msg ?? ''}`.trim());
  }
  for (const op of scene.ops) {
    if (op.type === 'image' && !images[op.assetId]) {
      throw new ExportError('image', 'An image is still loading or failed to load. Re-add it and try again.');
    }
  }

  // 5. Render at exact pixel size.
  const canvas = createCanvas(scene.width, scene.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ExportError('canvas', 'Your browser could not create an image of this size.');
  renderScene(ctx, scene, { scale: 1, images, texture });
  if (canvas.width !== scene.width || canvas.height !== scene.height) {
    throw new ExportError('size', 'The rendered image did not match the selected size.');
  }

  // 6. Encode and download.
  const blob = await new Promise((resolve) => {
    try {
      canvas.toBlob(resolve, format.mime, format.quality);
    } catch {
      resolve(null);
    }
  });
  if (!blob) throw new ExportError('encode', 'The image could not be encoded. Try PNG, or a smaller custom size.');
  const filename = sanitizeFilename(titleForFilename(doc.content), scene.width, scene.height, format.ext);
  download(blob, filename);
  return { filename, width: scene.width, height: scene.height, bytes: blob.size, layoutId: scene.layoutId };
}
