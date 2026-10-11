import { fitStack, textOps, textWidth } from '../text.js';
import { rule, sourceLabel, px, ds, ts } from './shared.js';

export default {
  id: 'list',
  label: 'Index',
  description: 'A numbered list of points or facts with ruled rows.',
  supports: ['list'],
  affinity: { list: 10 },
  requiredFields: ['items'],
  optionalFields: ['title', 'sourceName', 'attribution'],
  image: 'none',
  textRange: { min: 1, max: 900 },
  aspect: { min: 0.45, max: 2.4 },
  minSize: { width: 480, height: 400 },
  typography: { title: 'display', items: 'text', numbers: 'display' },
  spacing: { titleGap: 48, rowPad: 22 },
  photoTreatment: 'surface',
  overflow: 'Shrinks type within its range; long lists are reported rather than truncated.',

  requires(c) {
    if (!c.items.length) return 'Needs at least one item.';
    return c.items.length > 14 ? 'Too many items (14 max).' : null;
  },

  compose(ctx) {
    const { box, u, content: c, type, colors, env } = ctx;
    const ops = [];
    const meta = [c.attribution, sourceLabel(c)].filter(Boolean).join('  ·  ');
    const rowPad = px(this.spacing.rowPad * u);
    const itemMin = px(24 * u * ts(type));
    const itemMax = px(40 * u * ts(type));
    // Number column sized for two digits at the largest item size.
    const numW = textWidth(env, type.display, itemMax, '00') + px(28 * u);
    const itemW = box.w - numW;

    const blocks = [
      { key: 'title', text: c.title, face: type.display, min: px(40 * u * ds(type)), max: px(80 * u * ds(type)), lineHeight: type.lineHeight.display, width: box.w, balance: true, skip: !c.title },
      ...c.items.map((text, i) => ({
        key: `i${i}`, text, face: type.text, min: itemMin, max: itemMax, lineHeight: 1.32, width: itemW,
        gapBefore: i === 0 ? (c.title ? px(this.spacing.titleGap * u) : 0) + rowPad : rowPad * 2,
      })),
      { key: 'meta', text: meta, face: type.meta, min: px(20 * u), max: px(22 * u), lineHeight: 1.35, width: box.w, gapBefore: px(48 * u), skip: !meta },
    ];
    const fit = fitStack(env, blocks, box.h);
    const { items } = fit;

    // Short lists sit in the vertical centre; long ones start at the top.
    let y = box.y + Math.max(0, (box.h - fit.height) / 2);
    if (c.title) {
      ops.push(...textOps(env, items.title, { x: box.x, y, color: colors.text }));
      y += items.title.height + px(this.spacing.titleGap * u);
    }
    c.items.forEach((_, i) => {
      const lay = items[`i${i}`];
      ops.push(rule(box.x, y, box.w, Math.max(1, (i === 0 ? 2 : 1) * u), i === 0 ? colors.text : colors.divider));
      y += rowPad;
      const num = { ...lay, face: type.display, lines: [String(i + 1).padStart(2, '0')] };
      ops.push(...textOps(env, num, { x: box.x, y, color: colors.accent }));
      ops.push(...textOps(env, lay, { x: box.x + numW, y, color: colors.text }));
      y += lay.height + rowPad;
    });
    if (items.meta && meta) {
      ops.push(...textOps(env, items.meta, { x: box.x, y: box.y + box.h - items.meta.height, color: colors.muted }));
    }
    return { ops, fits: fit.fits, need: fit.need };
  },
};
