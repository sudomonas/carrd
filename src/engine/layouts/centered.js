import { fitStack, textOps } from '../text.js';
import { metaLine, rule, px, ds, ts } from './shared.js';

export default {
  id: 'centered',
  label: 'Centered',
  description: 'A quote or short thought, centred with generous whitespace.',
  supports: ['quote', 'text'],
  affinity: { quote: 10, text: 6 },
  requiredFields: ['quote | body'],
  optionalFields: ['attribution', 'sourceName', 'title'],
  image: 'none',
  textRange: { min: 1, max: 320 },
  aspect: { min: 0.45, max: 2.4 },
  minSize: { width: 400, height: 400 },
  typography: { quote: 'quote', attribution: 'meta', source: 'text' },
  spacing: { markGap: 16, ruleGap: 48 },
  photoTreatment: 'scrim',
  overflow: 'Shrinks type within its range, then falls back to another layout.',

  requires(c) {
    if (c.kind === 'quote') return c.quote ? null : 'Needs quote text.';
    return c.body || c.title ? null : 'Needs text.';
  },

  compose(ctx) {
    const { box, u, content: c, type, colors, env } = ctx;
    const ops = [];
    const isQuote = c.kind === 'quote';
    const width = Math.min(box.w, px(box.h * 1.4));
    const x = box.x + (box.w - width) / 2;
    const credit = isQuote ? c.attribution : c.attribution || c.author;
    const source = c.sourceName;
    const markSize = px(150 * u * ds(type));

    const blocks = [
      { key: 'mark', fixed: px(markSize * 0.5), skip: !isQuote },
      { key: 'title', text: c.title, face: type.display, min: px(40 * u * ds(type)), max: px(72 * u * ds(type)), lineHeight: type.lineHeight.display, width, balance: true, gapBefore: 0, skip: isQuote || !c.title },
      {
        key: 'main',
        text: isQuote ? c.quote : c.body,
        face: isQuote ? type.quote : c.title ? type.text : type.quote,
        min: px((isQuote || !c.title ? 36 : 26) * u * (isQuote ? ds(type) : ts(type))),
        max: px((isQuote || !c.title ? 78 : 38) * u * (isQuote ? ds(type) : ts(type))),
        lineHeight: isQuote || !c.title ? Math.max(1.18, type.lineHeight.display + 0.08) : type.lineHeight.text,
        width,
        balance: true,
        gapBefore: px((isQuote ? this.spacing.markGap : 32) * u),
        skip: !(isQuote ? c.quote : c.body),
      },
      { key: 'rule', fixed: Math.max(2, px(3 * u)), gapBefore: px(this.spacing.ruleGap * u), skip: !credit && !source },
      { key: 'credit', fixed: px(24 * u * 1.3), gapBefore: px(28 * u), skip: !credit },
      { key: 'source', fixed: px(24 * u * ts(type) * 1.3), gapBefore: px(8 * u), skip: !source },
    ];
    const fit = fitStack(env, blocks, box.h);
    let y = box.y + Math.max(0, (box.h - fit.height) / 2);

    for (const b of blocks) {
      if (b.skip) continue;
      if (b !== blocks.find((bb) => !bb.skip)) y += b.gapBefore ?? 0;
      const item = fit.items[b.key];
      if (b.key === 'mark') {
        const m = metaLine(env, { ...type.display, uppercase: false, tracking: 0 }, markSize, '“', 0, y - markSize * 0.12, colors.accent, 1);
        ops.push({ ...m.op, x: px(x + (width - m.width) / 2) });
      } else if (b.key === 'title' || b.key === 'main') {
        ops.push(...textOps(env, item, { x, y, color: b.key === 'main' && !isQuote && c.title ? colors.muted : colors.text, align: 'center', boxWidth: width }));
      } else if (b.key === 'rule') {
        ops.push(rule(x + width / 2 - px(24 * u), y, px(48 * u), b.fixed, colors.accent));
      } else if (b.key === 'credit') {
        const m = metaLine(env, type.meta, px(22 * u), credit, 0, y, colors.text);
        ops.push({ ...m.op, x: px(x + (width - m.width) / 2) });
        if (m.width > width) return { ops, fits: false, need: m.width / width };
      } else if (b.key === 'source') {
        const face = { ...type.text, style: 'italic' };
        const m = metaLine(env, face, px(24 * u * ts(type)), source, 0, y, colors.muted);
        ops.push({ ...m.op, x: px(x + (width - m.width) / 2) });
      }
      y += item.height;
    }
    return { ops, fits: fit.fits, need: fit.need };
  },
};

