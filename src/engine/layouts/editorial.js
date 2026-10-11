import { fitStack, layoutText, textOps } from '../text.js';
import { imageOp, metaLine, rule, sourceLabel, px, ds, ts } from './shared.js';

export default {
  id: 'editorial',
  label: 'Editorial',
  description: 'Source line, prominent headline, excerpt and optional thumbnail.',
  supports: ['article', 'text', 'image'],
  // kind -> base affinity (0–10), see compose.js scoring
  affinity: { article: 10, text: 7, image: 4 },
  requiredFields: ['title'],
  optionalFields: ['body', 'sourceName', 'author', 'attribution', 'image'],
  image: 'optional',
  textRange: { min: 20, max: 700 },
  aspect: { min: 0.5, max: 2.2 },
  minSize: { width: 480, height: 400 },
  typography: { headline: 'display', excerpt: 'text', meta: 'meta' },
  spacing: { headerGap: 40, headlineGap: 40, excerptGap: 28 },
  photoTreatment: 'surface',
  overflow: 'Shrinks type within its range, then reduces the thumbnail, then falls back to another layout.',

  requires(c) {
    return c.title ? null : 'Needs a headline.';
  },

  compose(ctx) {
    const { box, u, content: c, type, colors, env } = ctx;
    const ops = [];
    const landscape = ctx.W / ctx.H > 1.3;
    const img = ctx.image;
    let tb = { ...box };

    if (img && landscape) {
      const iw = px(box.w * 0.4);
      ops.push(imageOp(img, { x: box.x + box.w - iw, y: box.y, w: iw, h: box.h }));
      tb = { ...box, w: box.w - iw - px(56 * u) };
    }

    let y = tb.y;
    const label = sourceLabel(c);
    const metaSize = px(20 * u);
    if (label) {
      const m = metaLine(env, type.meta, metaSize, label, tb.x, y, colors.accent);
      ops.push(m.op);
      y += m.height + px(16 * u);
      ops.push(rule(tb.x, y, tb.w, Math.max(1, 1.5 * u), colors.divider));
      y += px(this.spacing.headerGap * u);
    }

    const byline = c.author ? `By ${c.author}` : c.attribution;
    let footer = null;
    if (byline) {
      footer = layoutText(env, { text: byline, face: type.text, size: px(24 * u * ts(type)), lineHeight: 1.3, width: tb.w });
    }
    const footerH = footer ? footer.height + px(28 * u) : 0;
    const available = tb.y + tb.h - footerH - y;

    const textBlocks = [
      { key: 'headline', text: c.title, face: type.display, min: px(44 * u * ds(type)), max: px(92 * u * ds(type)), lineHeight: type.lineHeight.display, width: tb.w, balance: true, gapBefore: px(this.spacing.headlineGap * u) },
      { key: 'excerpt', text: c.body, face: type.text, min: px(25 * u * ts(type)), max: px(34 * u * ts(type)), lineHeight: type.lineHeight.text, width: tb.w, gapBefore: px(this.spacing.excerptGap * u), skip: !c.body },
    ];

    // Portrait thumbnails shrink step by step before the text is declared too long.
    const imageFractions = img && !landscape ? [0.44, 0.34, 0.26] : [0];
    let fit;
    let imgH = 0;
    for (const f of imageFractions) {
      imgH = px(available * f);
      const blocks = f ? [{ key: 'image', fixed: imgH }, ...textBlocks] : textBlocks;
      fit = fitStack(env, blocks, available);
      if (fit.fits) break;
    }

    // Without a thumbnail the text sits low, like a magazine cover; with one it follows the image.
    let top = imgH ? y : Math.max(y, tb.y + tb.h - footerH - fit.height);
    if (imgH) {
      ops.push(imageOp(img, { x: tb.x, y: top, w: tb.w, h: imgH }));
      top += imgH + px(this.spacing.headlineGap * u);
    }
    const head = fit.items.headline;
    ops.push(...textOps(env, head, { x: tb.x, y: top, color: colors.text }));
    top += head.height;
    if (fit.items.excerpt && c.body) {
      top += px(this.spacing.excerptGap * u);
      ops.push(...textOps(env, fit.items.excerpt, { x: tb.x, y: top, color: colors.muted }));
    }

    if (footer) {
      const fy = tb.y + tb.h - footer.height;
      ops.push(rule(tb.x, fy - px(20 * u), px(48 * u), Math.max(1, 2 * u), colors.accent));
      ops.push(...textOps(env, footer, { x: tb.x, y: fy, color: colors.muted }));
    }
    return { ops, fits: fit.fits, need: fit.need };
  },
};
