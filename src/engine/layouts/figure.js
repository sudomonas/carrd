import { fitStack, textOps, textWidth } from '../text.js';
import { metaLine, rule, sourceLabel, px, ds, ts } from './shared.js';

// A leading figure: optional currency/sign, digits, optional unit (%, ×, k, M…).
const FIGURE = /^([$€£¥₹]?[+\-−~≈]?\d[\d,.]*(?:\s?(?:%|×|x|k|K|M|B|bn|m))?\+?)\s+(\S[\s\S]*)$/;

/**
 * Splits "87% of teams ship weekly." into the figure "87%" and the statement
 * "of teams ship weekly." — the two always rejoin to the original text.
 */
export function figureParts(c) {
  if (c.kind !== 'text' && c.kind !== 'article') return null;
  const source = c.title || c.body;
  const m = source && source.match(FIGURE);
  if (!m || m[1].replace(/\D/g, '').length > 7) return null;
  return { figure: m[1], statement: m[2], support: c.title ? c.body || null : null };
}

export default {
  id: 'figure',
  label: 'Figure',
  description: 'A big number with the statement it supports — for stats and milestones.',
  supports: ['text', 'article'],
  affinity: { text: 10, article: 7 },
  requiredFields: ['title | body starting with a number'],
  optionalFields: ['body', 'attribution', 'author', 'sourceName'],
  image: 'none',
  textRange: { min: 1, max: 360 },
  aspect: { min: 0.45, max: 2.4 },
  minSize: { width: 480, height: 400 },
  typography: { figure: 'display', statement: 'display', support: 'text', meta: 'meta' },
  spacing: { ruleGap: 36, supportGap: 28 },
  photoTreatment: 'surface',
  overflow: 'The figure scales to the width; the statement shrinks within its range, then another layout is used.',

  requires(c) {
    return figureParts(c) ? null : 'Needs text that starts with a number.';
  },

  compose(ctx) {
    const { box, u, content: c, type, colors, env } = ctx;
    const ops = [];
    const { figure, statement, support } = figureParts(c);
    const label = sourceLabel(c);
    const credit = c.author || c.attribution;
    const face = type.display;

    // The figure is as large as the width allows, capped at ~40% of the height.
    const per100 = textWidth(env, face, 100, figure) / 100;
    const figSize = Math.max(px(80 * u), Math.floor(Math.min(px(340 * u * ds(type)), box.w / per100, (box.h * 0.4) / 0.9)));
    const figH = px(figSize * 0.9);
    const labelH = label ? px(19 * u * 1.3) + px(28 * u) : 0;
    const ruleH = Math.max(3, px(6 * u));

    const blocks = [
      { key: 'figure', fixed: figH },
      { key: 'rule', fixed: ruleH, gapBefore: px(this.spacing.ruleGap * u) },
      { key: 'statement', text: statement, face, min: px(36 * u * ds(type)), max: px(66 * u * ds(type)), lineHeight: type.lineHeight.display, width: box.w, balance: true, gapBefore: px(this.spacing.ruleGap * u) },
      { key: 'support', text: support, face: type.text, min: px(23 * u * ts(type)), max: px(30 * u * ts(type)), lineHeight: type.lineHeight.text, width: box.w, gapBefore: px(this.spacing.supportGap * u), skip: !support },
      { key: 'credit', text: credit, face: type.meta, min: px(19 * u), max: px(21 * u), lineHeight: 1.3, width: box.w, gapBefore: px(40 * u), skip: !credit },
    ];
    const fit = fitStack(env, blocks, box.h - labelH);

    if (label) ops.push(metaLine(env, type.meta, px(19 * u), label, box.x, box.y, colors.muted).op);
    // Content sits low on the card, like a poster; label stays at the top.
    let y = Math.max(box.y + labelH, box.y + box.h - fit.height);
    ops.push({ type: 'text', text: figure, x: box.x - px(figSize * 0.04), y: px(y + figSize * 0.76), size: figSize, face, color: colors.accent });
    y += figH + blocks[1].gapBefore;
    ops.push(rule(box.x, y, px(96 * u), ruleH, colors.text));
    y += ruleH + blocks[2].gapBefore;
    ops.push(...textOps(env, fit.items.statement, { x: box.x, y, color: colors.text }));
    y += fit.items.statement.height;
    for (const key of ['support', 'credit']) {
      const b = blocks.find((x) => x.key === key);
      if (b.skip) continue;
      y += b.gapBefore;
      ops.push(...textOps(env, fit.items[key], { x: box.x, y, color: colors.muted }));
      y += fit.items[key].height;
    }
    return { ops, fits: fit.fits, need: fit.need };
  },
};
