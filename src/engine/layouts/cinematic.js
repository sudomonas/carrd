import { fitStack, textOps } from '../text.js';
import { contrast, luminance, solveOverlayAlpha, withAlpha } from '../color.js';
import { imageOp, metaLine, regionLuma, sourceLabel, px, ds, ts } from './shared.js';

/** Lightest and darkest palette roles, used for text over photographs. */
function extremes(colors) {
  const roles = [colors.text, colors.canvas, colors.surface];
  const sorted = [...roles].sort((a, b) => luminance(a) - luminance(b));
  return { dark: sorted[0], light: sorted[sorted.length - 1] };
}

export default {
  id: 'cinematic',
  label: 'Cinematic',
  description: 'Photograph-led, with a contrast-solved overlay or a split text panel.',
  supports: ['image', 'quote', 'article', 'text'],
  affinity: { image: 10, quote: 8, article: 6, text: 5 },
  requiredFields: ['image (content image or background photo)'],
  optionalFields: ['title', 'quote', 'attribution', 'sourceName'],
  image: 'required',
  textRange: { min: 0, max: 260 },
  aspect: { min: 0.45, max: 2.4 },
  minSize: { width: 400, height: 400 },
  typography: { headline: 'display', quote: 'quote', meta: 'meta' },
  spacing: { textGap: 24 },
  photoTreatment: 'own',
  overflow: 'Shrinks type within its range, then falls back to another layout.',

  requires(c, ctx) {
    return ctx.image ? null : 'Needs a photograph.';
  },

  compose(ctx) {
    const { W, H, u, box, content: c, type, colors, env, image } = ctx;
    const ops = [];
    const split = W / H > 1.25;
    const isQuote = c.kind === 'quote';
    const mainText = isQuote ? c.quote : c.title || c.body;
    const secondText = !isQuote && c.title && c.body ? c.body : null;
    const credit = c.author || c.attribution;
    const label = sourceLabel(c);
    const metaText = [credit, label].filter(Boolean).join('  ·  ');

    // Split composition for wide cards: photo left, text panel right.
    if (split) {
      const imgW = px(W * 0.54);
      ops.push(imageOp(image, { x: 0, y: 0, w: imgW, h: H }));
      if (ctx.backgroundIsPhoto) ops.push({ type: 'rect', x: imgW, y: 0, w: W - imgW, h: H, fill: colors.surface });
      if (!mainText && !metaText) return { ops, fits: true, need: 0 };
      const tx = imgW + px(64 * u);
      const tw = W - tx - box.x;
      const blocks = this.blocks(ctx, mainText, secondText, metaText, tw);
      const fit = fitStack(env, blocks, box.h);
      this.drawText(ctx, ops, blocks, fit, tx, box.y + (box.h - fit.height) / 2, colors.text, colors.muted, colors.accent);
      return { ops, fits: fit.fits, need: fit.need };
    }

    const img = imageOp(image, { x: 0, y: 0, w: W, h: H });
    ops.push(img);
    if (!mainText && !metaText) return { ops, fits: true, need: 0 };

    const blocks = this.blocks(ctx, mainText, secondText, metaText, box.w);
    const fit = fitStack(env, blocks, box.h * 0.62);
    const top = box.y + box.h - fit.height;
    const region = { x: box.x, y: top, w: box.w, h: fit.height };
    const lum = regionLuma(env.images?.[image.assetId], img, region);

    // Light text on a dark grade when the region is dark, and vice versa; then
    // solve the overlay alpha so both extremes of the region reach 4.5:1.
    const { dark, light } = extremes(colors);
    const lightText = lum.mean < 0.42 || contrast(light, dark) < 3;
    const textColor = lightText ? light : dark;
    const scrim = lightText ? dark : light;
    const alpha = Math.max(0.2, solveOverlayAlpha(textColor, scrim, lum.min, lum.max, 4.5));
    const fadeTop = Math.max(0, top - px(H * 0.22));
    ops.push({
      type: 'rect', x: 0, y: fadeTop, w: W, h: H - fadeTop,
      fill: { type: 'linear', x0: 0, y0: fadeTop, x1: 0, y1: top, stops: [[0, withAlpha(scrim, 0)], [1, withAlpha(scrim, alpha)]] },
    });
    this.drawText(ctx, ops, blocks, fit, box.x, top, textColor, textColor, textColor);
    return { ops, fits: fit.fits, need: fit.need, overlay: { alpha, lightText } };
  },

  blocks(ctx, mainText, secondText, metaText, width) {
    const { u, type, content: c } = ctx;
    const isQuote = c.kind === 'quote';
    return [
      { key: 'main', text: isQuote ? `“${mainText}”` : mainText, face: isQuote ? type.quote : type.display, min: px(36 * u * ds(type)), max: px(76 * u * ds(type)), lineHeight: type.lineHeight.display + (isQuote ? 0.06 : 0), width, balance: true, skip: !mainText },
      { key: 'second', text: secondText, face: type.text, min: px(24 * u * ts(type)), max: px(32 * u * ts(type)), lineHeight: type.lineHeight.text, width, gapBefore: px(24 * u), skip: !secondText },
      { key: 'meta', text: metaText, face: type.meta, min: px(20 * u), max: px(22 * u), lineHeight: 1.35, width, gapBefore: px(36 * u), skip: !metaText },
    ];
  },

  drawText(ctx, ops, blocks, fit, x, y, main, muted, meta) {
    const { env } = ctx;
    let first = true;
    for (const b of blocks) {
      if (b.skip) continue;
      if (!first) y += b.gapBefore ?? 0;
      first = false;
      const color = b.key === 'main' ? main : b.key === 'second' ? muted : meta;
      ops.push(...textOps(env, fit.items[b.key], { x, y, color }));
      y += fit.items[b.key].height;
    }
  },
};
