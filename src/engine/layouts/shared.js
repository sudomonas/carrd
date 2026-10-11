// Helpers shared by layout definitions. All dimensions are in output pixels.
import { textWidth, displayString, baselineFor } from '../text.js';

/**
 * Size unit: 1u = 1px on a 1080 × 1080 card, scaled by the geometric mean of
 * the output dimensions so type grows with the canvas area.
 */
export function unitFor(W, H) {
  return Math.sqrt(W * H) / 1080;
}

/** Safe margins: 8% of the short side, with a wider horizontal margin on wide cards. */
export function marginsFor(W, H) {
  const base = Math.round(Math.min(W, H) * 0.08);
  return { mx: Math.max(base, Math.round(W * 0.06)), my: Math.max(base, Math.round(H * 0.055)) };
}

export const px = (n) => Math.round(n);

export function hostname(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export const sourceLabel = (c) => c.sourceName || hostname(c.sourceUrl);

/** Splits the first sentence off a paragraph (no text is discarded). */
export function splitLead(body, maxLead = 160) {
  const m = body.match(/^(.+?[.!?])(\s+)([\s\S]+)$/);
  if (m && m[1].length <= maxLead && m[3].trim().length > 0) return { lead: m[1], rest: m[3].trim() };
  return null;
}

/** Centre-weighted cover crop of an image into a box. */
export function coverCrop(iw, ih, bw, bh, focusY = 0.45) {
  const scale = Math.max(bw / iw, bh / ih);
  const sw = bw / scale;
  const sh = bh / scale;
  return { sx: (iw - sw) / 2, sy: Math.max(0, Math.min(ih - sh, (ih - sh) * focusY)), sw, sh };
}

export function imageOp(image, box, { radius = 0, focusY } = {}) {
  const crop = coverCrop(image.width, image.height, box.w, box.h, focusY);
  return { type: 'image', assetId: image.assetId, ...crop, x: px(box.x), y: px(box.y), w: px(box.w), h: px(box.h), radius, crop };
}

/**
 * Luminance statistics (10th percentile, 90th percentile, mean) of the photo
 * pixels that land under `region` (canvas coords) given an image op.
 * Falls back to a worst-case range when no luminance grid is available.
 */
export function regionLuma(stats, op, region) {
  if (!stats?.luma) return { min: 0, max: 1, mean: 0.5 };
  const { cols, rows, values } = stats.luma;
  const toImgX = (x) => op.sx + ((x - op.x) / op.w) * op.sw;
  const toImgY = (y) => op.sy + ((y - op.y) / op.h) * op.sh;
  const c0 = Math.max(0, Math.floor((toImgX(region.x) / stats.width) * cols));
  const c1 = Math.min(cols - 1, Math.floor((toImgX(region.x + region.w - 1) / stats.width) * cols));
  const r0 = Math.max(0, Math.floor((toImgY(region.y) / stats.height) * rows));
  const r1 = Math.min(rows - 1, Math.floor((toImgY(region.y + region.h - 1) / stats.height) * rows));
  const picked = [];
  for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) picked.push(values[r * cols + c]);
  if (!picked.length) return { min: 0, max: 1, mean: 0.5 };
  picked.sort((a, b) => a - b);
  const q = (p) => picked[Math.min(picked.length - 1, Math.floor(p * picked.length))];
  return { min: q(0.1), max: q(0.9), mean: picked.reduce((s, v) => s + v, 0) / picked.length };
}

/** A single line of metadata text (not wrapped); returns op + width. */
export function metaLine(env, face, size, text, x, top, color, lineHeight = 1.3) {
  const shown = displayString(face, text);
  const lh = Math.round(size * lineHeight);
  return {
    op: { type: 'text', text: shown, x: px(x), y: baselineFor(top, lh, size), size, face, color },
    width: textWidth(env, face, size, shown),
    height: lh,
  };
}

export const rule = (x, y, w, h, fill) => ({ type: 'rect', x: px(x), y: px(y), w: px(w), h: Math.max(1, px(h)), fill });

/** Picks the typographic scale multiplier for a pairing role. */
export const ds = (type) => type.scale?.display ?? 1;
export const ts = (type) => type.scale?.text ?? 1;
