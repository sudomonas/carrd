import { fitStack, textOps } from '../text.js';
import { metaLine, px, ds, ts } from './shared.js';

const CLEAR = 'rgba(0, 0, 0, 0)';

export default {
  id: 'framed',
  label: 'Framed',
  description: 'A letterpress-style double frame around a centred quote or thought.',
  supports: ['quote', 'text'],
  affinity: { quote: 8, text: 5 },
  requiredFields: ['quote | body'],
  optionalFields: ['attribution', 'sourceName', 'title'],
  image: 'none',
  textRange: { min: 1, max: 280 },
  aspect: { min: 0.45, max: 2.4 },
  minSize: { width: 480, height: 480 },
  typography: { main: 'quote', label: 'meta', credit: 'meta' },
  spacing: { frameInset: 0.045, innerGap: 12, ornamentGap: 40 },
  photoTreatment: 'scrim',
  overflow: 'Shrinks type within its range, then falls back to another layout.',

  requires(c) {
    if (c.kind === 'quote') return c.quote ? null : 'Needs quote text.';
    return c.body || c.title ? null : 'Needs text.';
  },

  compose(ctx) {
    const { W, H, u, content: c, type, colors, env } = ctx;
    const ops = [];
    const isQuote = c.kind === 'quote';
    const outer = px(Math.min(W, H) * this.spacing.frameInset);
    const gap = px(this.spacing.innerGap * u);
    const thick = Math.max(2, px(3 * u));
    ops.push({ type: 'rect', x: outer, y: outer, w: W - outer * 2, h: H - outer * 2, fill: CLEAR, stroke: colors.text, strokeWidth: thick });
    const inner = outer + thick + gap;
    ops.push({ type: 'rect', x: inner, y: inner, w: W - inner * 2, h: H - inner * 2, fill: CLEAR, stroke: colors.accent, strokeWidth: Math.max(1, u) });

    const pad = px(Math.min(W, H) * 0.075);
    const box = { x: inner + pad, y: inner + pad, w: W - (inner + pad) * 2, h: H - (inner + pad) * 2 };
    const label = c.sourceName;
    const credit = c.attribution || c.author;
    // A titled post keeps its hierarchy: title in the display face, body smaller and muted.
    const titled = !isQuote && c.title && c.body;
    const text = isQuote ? c.quote : titled ? c.title : c.title || c.body;
    const dot = Math.max(4, px(7 * u));

    const blocks = [
      { key: 'main', text, face: isQuote ? type.quote : type.display, min: px(32 * u * ds(type)), max: px((titled ? 66 : 74) * u * ds(type)), lineHeight: titled ? type.lineHeight.display : Math.max(1.16, type.lineHeight.display + 0.08), width: box.w, balance: true },
      { key: 'body', text: titled ? c.body : '', face: type.text, min: px(23 * u * ts(type)), max: px(32 * u * ts(type)), lineHeight: type.lineHeight.text, width: box.w, balance: true, gapBefore: px(28 * u), skip: !titled },
      { key: 'dots', fixed: dot, gapBefore: px(this.spacing.ornamentGap * u), skip: !credit },
      { key: 'credit', fixed: px(22 * u * 1.3), gapBefore: px(this.spacing.ornamentGap * u * 0.8), skip: !credit },
    ];
    const byKey = Object.fromEntries(blocks.map((b) => [b.key, b]));
    const labelH = label ? px(19 * u * 1.3) + px(32 * u) : 0;
    const fit = fitStack(env, blocks, box.h - labelH * 2);

    if (label) {
      const m = metaLine(env, type.meta, px(19 * u), label, 0, box.y, colors.muted);
      const lx = px((W - m.width) / 2);
      ops.push({ ...m.op, x: lx });
      const ry = box.y + m.height / 2;
      const len = px(36 * u);
      ops.push({ type: 'rect', x: lx - px(16 * u) - len, y: px(ry), w: len, h: Math.max(1, px(u)), fill: colors.divider });
      ops.push({ type: 'rect', x: lx + px(m.width + 16 * u), y: px(ry), w: len, h: Math.max(1, px(u)), fill: colors.divider });
    }

    let y = box.y + Math.max(0, (box.h - fit.height) / 2);
    ops.push(...textOps(env, fit.items.main, { x: box.x, y, color: colors.text, align: 'center', boxWidth: box.w }));
    y += fit.items.main.height;
    if (titled) {
      y += byKey.body.gapBefore;
      ops.push(...textOps(env, fit.items.body, { x: box.x, y, color: colors.muted, align: 'center', boxWidth: box.w }));
      y += fit.items.body.height;
    }
    if (credit) {
      y += byKey.dots.gapBefore;
      for (const k of [-1, 0, 1]) {
        ops.push({ type: 'rect', x: px(W / 2 + k * dot * 2.6 - dot / 2), y: px(y), w: dot, h: dot, radius: dot / 2, fill: colors.accent });
      }
      y += dot + byKey.credit.gapBefore;
      const m = metaLine(env, type.meta, px(22 * u), credit, 0, y, colors.text);
      ops.push({ ...m.op, x: px((W - m.width) / 2) });
      if (m.width > box.w) return { ops, fits: false, need: m.width / box.w };
    }
    return { ops, fits: fit.fits, need: fit.need };
  },
};

