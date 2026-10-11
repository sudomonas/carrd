// Text measurement, wrapping and fitting. Pure functions: the caller supplies
// `env.measure(face, size, text) -> width`, backed in the browser by canvas
// measureText using the same bundled fonts the renderer draws with.

export function displayString(face, text) {
  return face.uppercase ? text.toUpperCase() : text;
}

/**
 * Width of a run of text. Tracked faces (letter-spaced metadata) are drawn
 * glyph-by-glyph by the renderer, so they are measured the same way.
 */
export function textWidth(env, face, size, text) {
  if (!text) return 0;
  if (!face.tracking) return env.measure(face, size, text);
  let w = 0;
  for (const ch of text) w += env.measure(face, size, ch);
  return w + face.tracking * size * (Array.from(text).length - 1);
}

/** Splits a word that is wider than maxWidth into character chunks. */
function breakWord(word, maxWidth, widthOf) {
  const parts = [];
  let cur = '';
  for (const ch of word) {
    if (cur && widthOf(cur + ch) > maxWidth) {
      parts.push(cur);
      cur = ch;
    } else cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

/**
 * Greedy word wrap. Newlines are respected; a blank line is returned as ''
 * (rendered as a paragraph gap). Consecutive blank lines collapse into one.
 */
export function wrapText(text, maxWidth, widthOf) {
  const lines = [];
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n');
  for (const para of paragraphs) {
    const words = para.split(/[ \t]+/).filter(Boolean);
    if (!words.length) {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('');
      continue;
    }
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (widthOf(candidate) <= maxWidth) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (widthOf(word) <= maxWidth) {
        line = word;
      } else {
        const chunks = breakWord(word, maxWidth, widthOf);
        lines.push(...chunks.slice(0, -1));
        line = chunks[chunks.length - 1];
      }
    }
    if (line) lines.push(line);
  }
  while (lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * Balanced wrap (like CSS `text-wrap: balance`): finds the narrowest width
 * that keeps the greedy line count, so headlines avoid a lone last word.
 */
export function wrapBalanced(text, maxWidth, widthOf) {
  const greedy = wrapText(text, maxWidth, widthOf);
  if (greedy.length < 2) return greedy;
  let lo = maxWidth * 0.5;
  let hi = maxWidth;
  for (let i = 0; i < 10; i++) {
    const mid = (lo + hi) / 2;
    if (wrapText(text, mid, widthOf).length <= greedy.length) hi = mid;
    else lo = mid;
  }
  return wrapText(text, hi, widthOf);
}

/**
 * Lays out a text block at a fixed size.
 * Returns { lines, size, lineHeight, height, width } (width = widest line).
 */
export function layoutText(env, { text, face, size, lineHeight, width, balance = false }) {
  const shown = displayString(face, text);
  const widthOf = (s) => textWidth(env, face, size, s);
  const lines = balance ? wrapBalanced(shown, width, widthOf) : wrapText(shown, width, widthOf);
  const lh = Math.round(size * lineHeight);
  let height = 0;
  let widest = 0;
  for (const l of lines) {
    height += l === '' ? Math.round(lh * 0.5) : lh;
    if (l) widest = Math.max(widest, widthOf(l));
  }
  return { lines, size, lineHeight: lh, height, width: widest, face };
}

const sizeAt = (block, t) => Math.round(block.min + (block.max - block.min) * t);

function measureStack(env, blocks, t) {
  const items = {};
  let height = 0;
  let first = true;
  for (const b of blocks) {
    if (b.skip) continue;
    const gap = first ? 0 : b.gapBefore ?? 0;
    first = false;
    if (b.fixed != null) {
      height += gap + b.fixed;
      items[b.key] = { height: b.fixed };
      continue;
    }
    const lay = layoutText(env, { ...b, size: sizeAt(b, t) });
    const over = b.maxLines && lay.lines.length > b.maxLines;
    items[b.key] = lay;
    height += gap + lay.height + (over ? 1e6 : 0);
  }
  return { items, height };
}

/**
 * Fits a vertical stack of blocks into `available` height. Every text block
 * has a readable size range [min, max]; all blocks scale together by a shared
 * factor t in [0, 1] found by binary search. Text is never truncated: when
 * even t = 0 does not fit, the result reports overflow and how much more
 * room the content needs (`need` = required / available).
 */
export function fitStack(env, blocks, available) {
  const top = measureStack(env, blocks, 1);
  if (top.height <= available) return { fits: true, t: 1, ...top, need: top.height / available };
  const bottom = measureStack(env, blocks, 0);
  if (bottom.height > available) {
    return { fits: false, t: 0, ...bottom, need: bottom.height / available };
  }
  let lo = 0;
  let hi = 1;
  let best = bottom;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const m = measureStack(env, blocks, mid);
    if (m.height <= available) {
      lo = mid;
      best = m;
    } else hi = mid;
  }
  return { fits: true, t: lo, ...best, need: best.height / available };
}

/** Alphabetic baseline that optically centres cap height in the line box. */
export function baselineFor(top, lineHeight, size) {
  return Math.round(top + (lineHeight + size * 0.7) / 2);
}

/**
 * Converts a laid-out block into text draw operations.
 * align: 'left' | 'center' | 'right' within [x, x + boxWidth].
 */
export function textOps(env, lay, { x, y, color, align = 'left', boxWidth = 0 }) {
  const ops = [];
  let top = y;
  for (const line of lay.lines) {
    if (line === '') {
      top += Math.round(lay.lineHeight * 0.5);
      continue;
    }
    let lx = x;
    if (align !== 'left') {
      const w = textWidth(env, lay.face, lay.size, line);
      lx = align === 'center' ? x + (boxWidth - w) / 2 : x + boxWidth - w;
    }
    ops.push({
      type: 'text',
      text: line,
      x: Math.round(lx),
      y: baselineFor(top, lay.lineHeight, lay.size),
      size: lay.size,
      face: lay.face,
      color,
    });
    top += lay.lineHeight;
  }
  return ops;
}
