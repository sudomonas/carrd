import { fitStack, textOps } from '../text.js';
import { rule, sourceLabel, splitLead, px, ds, ts } from './shared.js';

/** Decides which text is the headline and which is supporting copy. */
export function headlineParts(c) {
  if (c.kind === 'quote') return { headline: `“${c.quote}”`, support: null };
  if (c.title) return { headline: c.title, support: c.body || null };
  if (c.kind === 'list') return null;
  const body = c.body || '';
  if (body.length <= 220) return { headline: body, support: null };
  const lead = splitLead(body);
  return lead ? { headline: lead.lead, support: lead.rest } : null;
}

export default {
  id: 'headline',
  label: 'Headline',
  description: 'A large, direct statement with supporting text anchored below.',
  supports: ['text', 'article', 'quote'],
  affinity: { text: 9, article: 7, quote: 5 },
  requiredFields: ['title | short body | quote'],
  optionalFields: ['body', 'author', 'attribution', 'sourceName'],
  image: 'none',
  textRange: { min: 1, max: 600 },
  aspect: { min: 0.45, max: 2.4 },
  minSize: { width: 400, height: 400 },
  typography: { headline: 'display', support: 'text', meta: 'meta' },
  spacing: { barGap: 56, minMiddle: 56, metaGap: 32 },
  photoTreatment: 'surface',
  overflow: 'Shrinks type within its range, then falls back to another layout.',

  requires(c) {
    return headlineParts(c) ? null : 'Needs a title or a shorter opening sentence.';
  },

  compose(ctx) {
    const { box, u, content: c, type, colors, env } = ctx;
    const ops = [];
    const { headline, support } = headlineParts(c);
    const meta = [c.author || c.attribution, sourceLabel(c)].filter(Boolean).join('  ·  ');
    const wide = ctx.W / ctx.H > 1.3;
    const supportWidth = px(box.w * (wide ? 0.62 : 0.88));
    const barH = Math.max(3, px(8 * u));

    const blocks = [
      { key: 'bar', fixed: barH },
      { key: 'headline', text: headline, face: type.display, min: px(48 * u * ds(type)), max: px((headline.length < 60 ? 132 : 104) * u * ds(type)), lineHeight: type.lineHeight.display - 0.02, width: box.w, balance: true, gapBefore: px(this.spacing.barGap * u) },
      { key: 'support', text: support, face: type.text, min: px(25 * u * ts(type)), max: px(34 * u * ts(type)), lineHeight: type.lineHeight.text, width: supportWidth, gapBefore: px(this.spacing.minMiddle * u), skip: !support },
      { key: 'meta', text: meta, face: type.meta, min: px(20 * u), max: px(22 * u), lineHeight: 1.35, width: box.w, gapBefore: px((support ? this.spacing.metaGap : this.spacing.minMiddle) * u), skip: !meta },
    ];
    const fit = fitStack(env, blocks, box.h);
    const { items } = fit;

    ops.push(rule(box.x, box.y, px(72 * u), barH, colors.accent));
    let y = box.y + barH + px(this.spacing.barGap * u);
    ops.push(...textOps(env, items.headline, { x: box.x, y, color: colors.text }));

    // Supporting copy and metadata are anchored to the bottom edge.
    let bottom = box.y + box.h;
    if (items.meta && meta) {
      bottom -= items.meta.height;
      ops.push(...textOps(env, items.meta, { x: box.x, y: bottom, color: colors.muted }));
      bottom -= px((support ? this.spacing.metaGap : 0) * u);
    }
    if (items.support && support) {
      bottom -= items.support.height;
      ops.push(...textOps(env, items.support, { x: box.x, y: bottom, color: colors.muted }));
    }
    return { ops, fits: fit.fits, need: fit.need };
  },
};
