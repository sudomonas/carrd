import { fitStack, textOps } from '../text.js';
import { imageOp, marginsFor, sourceLabel, px, ds, ts } from './shared.js';

function parts(c) {
  if (c.kind === 'quote') return { label: c.sourceName, main: c.quote ? `“${c.quote}”` : '', mainIsQuote: true, second: null, credit: c.attribution };
  if (c.kind === 'image') return { label: null, main: c.title, second: null, credit: c.attribution };
  return { label: sourceLabel(c), main: c.title || c.body, second: c.title ? c.body || null : null, credit: c.author ? `By ${c.author}` : c.attribution };
}

export default {
  id: 'split',
  label: 'Split',
  description: 'Photograph and text in two clean halves — side by side on wide cards, stacked on tall ones.',
  supports: ['article', 'image', 'quote', 'text'],
  affinity: { article: 8, image: 7, quote: 6, text: 5 },
  requiredFields: ['image (content image or background photo)', 'title | quote | caption'],
  optionalFields: ['body', 'sourceName', 'author', 'attribution'],
  image: 'required',
  textRange: { min: 1, max: 420 },
  aspect: { min: 0.45, max: 2.6 },
  minSize: { width: 480, height: 400 },
  typography: { label: 'meta', main: 'display | quote', second: 'text', credit: 'meta' },
  spacing: { gap: 28, labelGap: 24 },
  photoTreatment: 'own',
  overflow: 'Shrinks type within its range, then falls back to another layout. The photo half never shrinks.',

  requires(c, ctx) {
    if (!ctx.image) return 'Needs a photograph.';
    return parts(c).main ? null : 'Needs a headline, quote or caption.';
  },

  compose(ctx) {
    const { W, H, u, box, content: c, type, colors, env, image } = ctx;
    const { mx, my } = marginsFor(W, H);
    const ops = [];
    const side = W / H >= 1.2;
    const p = parts(c);

    let imgBox;
    let tb;
    if (side) {
      imgBox = { x: 0, y: 0, w: px(W * 0.5), h: H };
      const x = imgBox.w + px(mx * 0.9);
      tb = { x, y: box.y, w: W - x - mx, h: box.h };
    } else {
      const imgH = px(H * (H / W > 1.5 ? 0.5 : 0.46));
      imgBox = { x: 0, y: 0, w: W, h: imgH };
      const y = imgH + px(my * 0.85);
      tb = { x: box.x, y, w: box.w, h: H - y - my };
    }
    if (ctx.backgroundIsPhoto) {
      ops.push({ type: 'rect', x: side ? imgBox.w : 0, y: side ? 0 : imgBox.h, w: side ? W - imgBox.w : W, h: side ? H : H - imgBox.h, fill: colors.surface });
    }
    ops.push(imageOp(image, imgBox));

    const blocks = [
      { key: 'label', text: p.label, face: type.meta, min: px(19 * u), max: px(21 * u), lineHeight: 1.3, width: tb.w, skip: !p.label },
      { key: 'main', text: p.main, face: p.mainIsQuote ? type.quote : type.display, min: px(34 * u * ds(type)), max: px((side ? 64 : 78) * u * ds(type)), lineHeight: type.lineHeight.display + (p.mainIsQuote ? 0.06 : 0), width: tb.w, balance: true, gapBefore: px(this.spacing.labelGap * u) },
      { key: 'second', text: p.second, face: type.text, min: px(23 * u * ts(type)), max: px(31 * u * ts(type)), lineHeight: type.lineHeight.text, width: tb.w, gapBefore: px(this.spacing.gap * u), skip: !p.second },
      { key: 'credit', text: p.credit, face: type.meta, min: px(19 * u), max: px(21 * u), lineHeight: 1.3, width: tb.w, gapBefore: px(36 * u), skip: !p.credit },
    ];
    const fit = fitStack(env, blocks, tb.h);
    let y = side ? tb.y + Math.max(0, (tb.h - fit.height) / 2) : tb.y;
    let first = true;
    for (const b of blocks) {
      if (b.skip) continue;
      if (!first) y += b.gapBefore ?? 0;
      first = false;
      const color = b.key === 'label' ? colors.accent : b.key === 'main' ? colors.text : colors.muted;
      ops.push(...textOps(env, fit.items[b.key], { x: tb.x, y, color }));
      y += fit.items[b.key].height;
    }
    return { ops, fits: fit.fits, need: fit.need };
  },
};
