import { fitStack, textOps, textWidth } from '../text.js';
import { tokenizeLine, languageLabel } from '../code.js';
import { mix } from '../color.js';
import { metaLine, rule, px, ds } from './shared.js';

const TAB = '  ';

/**
 * Code wrapping policy: the source text is never altered. Lines wider than
 * the panel soft-wrap at a character boundary (preferring the last space in
 * the final 40% of the line); continuation rows are indented two columns past
 * the original indent and marked in the gutter. Leading and trailing blank
 * lines are not drawn, and tabs are displayed as two spaces.
 */
export function wrapCode(code, maxChars) {
  const lines = code.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\t/g, TAB));
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  const rows = [];
  lines.forEach((line, lineIndex) => {
    if (line.length <= maxChars) {
      rows.push({ lineIndex, start: 0, end: line.length, cont: false, indent: 0 });
      return;
    }
    const indent = Math.min(line.length - line.trimStart().length, Math.floor(maxChars / 2));
    let start = 0;
    let first = true;
    while (start < line.length) {
      const pad = first ? 0 : indent + 2;
      const room = Math.max(1, maxChars - pad);
      let end = Math.min(line.length, start + room);
      if (end < line.length) {
        const space = line.lastIndexOf(' ', end - 1);
        if (space > start + room * 0.6) end = space + 1;
      }
      rows.push({ lineIndex, start, end, cont: !first, indent: pad });
      start = end;
      first = false;
    }
  });
  return { lines, rows };
}

function sliceTokens(tokens, start, end) {
  const out = [];
  let pos = 0;
  for (const t of tokens) {
    const a = Math.max(start, pos);
    const b = Math.min(end, pos + t.text.length);
    if (a < b) out.push({ text: t.text.slice(a - pos, b - pos), type: t.type });
    pos += t.text.length;
  }
  return out;
}

export default {
  id: 'code',
  label: 'Code',
  description: 'A readable code panel with a title and language label.',
  supports: ['code'],
  affinity: { code: 10 },
  requiredFields: ['body'],
  optionalFields: ['title', 'codeLanguage'],
  image: 'none',
  textRange: { min: 1, max: 1600 },
  aspect: { min: 0.4, max: 2.6 },
  minSize: { width: 480, height: 400 },
  typography: { code: 'mono', title: 'display', label: 'meta' },
  spacing: { panelPad: 44, titleGap: 40, lineHeight: 1.55 },
  photoTreatment: 'surface',
  overflow: 'Shrinks code to 18u; long lines soft-wrap. If it still does not fit, reports how many lines fit — code is never clipped.',

  requires(c) {
    return c.body.trim() ? null : 'Needs code.';
  },

  compose(ctx) {
    const { box, u, content: c, type, colors, env } = ctx;
    const ops = [];
    const pad = px(this.spacing.panelPad * u);
    const lang = c.codeLanguage && c.codeLanguage !== 'plain' ? languageLabel(c.codeLanguage) : null;
    const face = type.mono;
    const lh = this.spacing.lineHeight;

    const titleFit = c.title
      ? fitStack(env, [{ key: 't', text: c.title, face: type.display, min: px(36 * u * ds(type)), max: px(56 * u * ds(type)), lineHeight: type.lineHeight.display, width: box.w, balance: true }], box.h * 0.3)
      : null;
    const titleH = titleFit ? titleFit.items.t.height + px(this.spacing.titleGap * u) : 0;
    const labelSize = px(19 * u);
    const headerH = lang ? px(labelSize * 1.3) + px(24 * u) : 0;
    const gutter = px(22 * u);
    const codeW = box.w - pad * 2 - gutter;
    const available = box.h - titleH - pad * 2 - headerH;

    const measure = (size) => {
      const charW = textWidth(env, face, size, 'M');
      const wrapped = wrapCode(c.body, Math.max(8, Math.floor(codeW / charW)));
      return { size, charW, ...wrapped, lineH: Math.round(size * lh), height: wrapped.rows.length * Math.round(size * lh) };
    };
    const minSize = Math.max(11, px(18 * u));
    // Prefer the largest size at which the longest line still doesn't wrap.
    const longest = Math.max(1, ...wrapCode(c.body, Infinity).lines.map((l) => l.length));
    const charRatio = textWidth(env, face, 100, 'M') / 100;
    const noWrap = Math.floor(codeW / (longest * charRatio));
    const maxSize = Math.max(minSize, Math.min(px(30 * u), noWrap));
    let best = measure(minSize);
    const fits = best.height <= available;
    if (fits) {
      let lo = minSize;
      let hi = maxSize;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const m = measure(mid);
        if (m.height <= available) { lo = mid; best = m; } else hi = mid - 1;
      }
    }

    const panelH = pad * 2 + headerH + best.height;
    const groupH = titleH + panelH;
    let y = box.y + Math.max(0, (box.h - groupH) / 2);
    if (titleFit) {
      ops.push(...textOps(env, titleFit.items.t, { x: box.x, y, color: colors.text }));
      y += titleH;
    }
    ops.push({ type: 'rect', x: box.x, y: px(y), w: box.w, h: px(Math.min(panelH, box.y + box.h - y)), fill: colors.surface, radius: px(18 * u), stroke: colors.divider, strokeWidth: Math.max(1, 1.5 * u) });
    let cy = y + pad;
    if (lang) {
      const m = metaLine(env, type.meta, labelSize, lang, box.x + pad, cy, colors.muted);
      ops.push(m.op);
      cy += m.height + px(12 * u);
      ops.push(rule(box.x + pad, cy, box.w - pad * 2, Math.max(1, u), colors.divider));
      cy += px(12 * u);
    }

    const palette = {
      plain: colors.text,
      keyword: colors.accent,
      string: mix(colors.accent, colors.text, 0.45),
      number: colors.accent,
      comment: colors.muted,
      punct: mix(colors.text, colors.muted, 0.5),
    };
    const tokenCache = new Map();
    const codeX = box.x + pad + gutter;
    for (const row of best.rows) {
      if (cy + best.lineH > box.y + box.h + 1) break; // only reached when reporting overflow
      if (!tokenCache.has(row.lineIndex)) tokenCache.set(row.lineIndex, tokenizeLine(best.lines[row.lineIndex], c.codeLanguage));
      let x = codeX + row.indent * best.charW;
      const baseline = Math.round(cy + (best.lineH + best.size * 0.7) / 2);
      if (row.cont) ops.push(rule(codeX - gutter * 0.75, cy + best.lineH / 2, gutter * 0.45, Math.max(1, 2 * u), colors.divider));
      for (const tok of sliceTokens(tokenCache.get(row.lineIndex), row.start, row.end)) {
        if (tok.text.trim()) ops.push({ type: 'text', text: tok.text, x: px(x), y: baseline, size: best.size, face, color: palette[tok.type] });
        x += textWidth(env, face, best.size, tok.text);
      }
      cy += best.lineH;
    }
    const fitLines = Math.max(0, Math.floor(available / best.lineH));
    return { ops, fits, need: best.height / available, detail: fits ? null : { rows: best.rows.length, fitRows: fitLines } };
  },
};
