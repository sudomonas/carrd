// Draws a composed scene onto a 2D canvas. The same function renders the live
// preview, the layout thumbnails and the exported file.
import { fontString } from '../config/typography.js';

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (!r) {
    ctx.rect(x, y, w, h);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// Tinted copies of pattern masks, keyed by texture id + colour.
const tintCache = new Map();

function tintedTile(tile, color) {
  const key = `${tile.src ?? ''}|${color}`;
  let c = tintCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = tile.naturalWidth ?? tile.width;
    c.height = tile.naturalHeight ?? tile.height;
    const g = c.getContext('2d');
    g.drawImage(tile, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    if (tintCache.size > 200) tintCache.clear();
    tintCache.set(key, c);
  }
  return c;
}

function paint(ctx, fill) {
  if (typeof fill === 'string') return fill;
  const g = ctx.createLinearGradient(fill.x0, fill.y0, fill.x1, fill.y1);
  for (const [offset, color] of fill.stops) g.addColorStop(offset, color);
  return g;
}

/**
 * @param ctx      CanvasRenderingContext2D
 * @param scene    result of composeCard()
 * @param options  { scale, images: { [assetId]: CanvasImageSource }, textures: { [textureId]: HTMLImageElement } }
 */
export function renderScene(ctx, scene, { scale = 1, images = {}, textures = {} } = {}) {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, scene.width, scene.height);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.imageSmoothingQuality = 'high';
  for (const op of scene.ops) {
    switch (op.type) {
      case 'rect':
        roundRectPath(ctx, op.x, op.y, op.w, op.h, op.radius);
        ctx.fillStyle = paint(ctx, op.fill);
        ctx.fill();
        if (op.stroke) {
          ctx.strokeStyle = op.stroke;
          ctx.lineWidth = op.strokeWidth ?? 1;
          ctx.stroke();
        }
        break;
      case 'image': {
        const img = images[op.assetId];
        if (!img) break;
        ctx.save();
        roundRectPath(ctx, op.x, op.y, op.w, op.h, op.radius);
        ctx.clip();
        ctx.drawImage(img, op.sx, op.sy, op.sw, op.sh, op.x, op.y, op.w, op.h);
        ctx.restore();
        break;
      }
      case 'texture': {
        const tile = textures[op.id ?? 'paper'];
        if (!tile) break;
        ctx.save();
        const pattern = ctx.createPattern(tintedTile(tile, op.color), 'repeat');
        // Pattern space follows the card: one tile pixel = `scale` card pixels.
        if (op.scale && pattern.setTransform) pattern.setTransform(new DOMMatrix().scale(op.scale));
        ctx.globalAlpha = op.alpha ?? 0.9;
        ctx.fillStyle = pattern;
        ctx.fillRect(op.x, op.y, op.w, op.h);
        ctx.restore();
        break;
      }
      case 'text': {
        ctx.font = fontString(op.face, op.size);
        ctx.fillStyle = op.color;
        if (!op.face.tracking) {
          ctx.fillText(op.text, op.x, op.y);
          break;
        }
        // Letter-spaced text is drawn glyph by glyph, matching textWidth().
        let x = op.x;
        for (const ch of op.text) {
          ctx.fillText(ch, x, op.y);
          x += ctx.measureText(ch).width + op.face.tracking * op.size;
        }
        break;
      }
      default:
        break;
    }
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
