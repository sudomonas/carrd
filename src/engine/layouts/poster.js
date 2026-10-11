import { textWidth, wrapText } from '../text.js';
import { metaLine, rule, sourceLabel, px } from './shared.js';

const LEADING = 0.9;

function posterText(c) {
  if (c.kind === 'quote') return c.quote ? `“${c.quote}”` : '';
  // A poster carries one line of text; a titled post with a body doesn't qualify.
  if (c.title && c.body) return '';
  return c.title || c.body || '';
}

/**
 * Typographic poster: each line is set at its own size so it spans the full
 * measure. Tries the largest base size first (fewest lines) and steps down
 * until the stack fits; no line may drop below the readable minimum.
 */
export function posterLines(env, face, text, width, height, { min, cap }) {
  const upper = text.toUpperCase();
  const w100 = (s) => textWidth(env, face, 100, s) / 100;
  let base = Math.min(cap, height);
  while (base >= min) {
    const lines = wrapText(upper, width, (s) => w100(s) * base).filter(Boolean);
    // Never split a word across lines: a broken word means the base is too big.
    if (lines.join(' ').split(/\s+/).length !== upper.split(/\s+/).filter(Boolean).length) {
      base = Math.floor(base * 0.94);
      continue;
    }
    const sizes = lines.map((l) => Math.floor(Math.min(cap, base * 2, width / w100(l))));
    const total = sizes.reduce((sum, s) => sum + s * LEADING, 0);
    if (total <= height && Math.min(...sizes) >= min) return { lines, sizes, height: total };
    base = Math.floor(base * 0.94);
  }
  return null;
}

export default {
  id: 'poster',
  label: 'Poster',
  description: 'Short words set huge, every line stretched edge to edge.',
  supports: ['quote', 'text'],
  affinity: { text: 7, quote: 5 },
  requiredFields: ['short title | short body | short quote'],
  optionalFields: ['attribution', 'author', 'sourceName'],
  image: 'none',
  textRange: { min: 1, max: 80 },
  aspect: { min: 0.45, max: 2.4 },
  minSize: { width: 480, height: 400 },
  typography: { lines: 'display (uppercase)', meta: 'meta' },
  spacing: { metaGap: 40 },
  photoTreatment: 'scrim',
  overflow: 'Lines shrink until the stack fits (never below 48u); long text is not eligible.',

  requires(c) {
    const t = posterText(c);
    if (!t) return c.title && c.body ? 'Shows a single line of text, not a title with a body.' : 'Needs a short line of text.';
    return t.length <= 120 ? null : 'Too long for a poster (120 characters max).';
  },

  compose(ctx) {
    const { box, u, content: c, type, colors, env } = ctx;
    const ops = [];
    const face = { ...type.display, uppercase: false, tracking: 0 };
    const meta = [c.attribution || c.author, sourceLabel(c)].filter(Boolean).join('  ·  ');
    const metaH = meta ? px(20 * u * 1.3) + px(this.spacing.metaGap * u) : 0;
    const barH = Math.max(4, px(10 * u));

    const set = posterLines(env, face, posterText(c), box.w, box.h - metaH - barH - px(36 * u), { min: px(48 * u), cap: px(Math.min(box.h * 0.4, 420 * u)) });
    ops.push(rule(box.x, box.y, px(110 * u), barH, colors.accent));
    if (meta) ops.push(metaLine(env, type.meta, px(20 * u), meta, box.x, box.y + barH + px(28 * u), colors.muted).op);
    if (!set) return { ops, fits: false, need: 1.5 };

    // Lines are anchored to the bottom edge.
    let y = box.y + box.h - set.height;
    set.lines.forEach((line, i) => {
      const size = set.sizes[i];
      ops.push({ type: 'text', text: line, x: box.x, y: px(y + size * 0.74), size, face, color: colors.text });
      y += size * LEADING;
    });
    return { ops, fits: true, need: set.height / box.h };
  },
};
