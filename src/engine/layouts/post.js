import { layoutText, textOps, textWidth } from '../text.js';
import { mix } from '../color.js';
import { hostname, imageOp, metaLine, px, ds, ts } from './shared.js';

/** The name shown as the poster; never invented. */
const posterName = (c) => c.author || c.attribution || c.sourceName || null;

export function initials(name) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return name.slice(0, 1).toUpperCase();
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : '')).toUpperCase();
}

/** Larger type for shorter posts, so a one-liner fills the card. */
function maxBodySize(length) {
  if (length <= 80) return 92;
  if (length <= 160) return 74;
  if (length <= 280) return 60;
  return 50;
}

export default {
  id: 'post',
  label: 'Post',
  description: 'A social-post card: avatar initials, name, the words, and optional media.',
  supports: ['text', 'quote', 'article'],
  affinity: { text: 6, quote: 6, article: 4 },
  requiredFields: ['author | attribution | sourceName', 'text'],
  optionalFields: ['title', 'image', 'sourceUrl'],
  image: 'optional',
  textRange: { min: 1, max: 500 },
  aspect: { min: 0.45, max: 2.4 },
  minSize: { width: 480, height: 480 },
  typography: { name: 'meta (sentence case)', handle: 'text', title: 'display', body: 'text | quote' },
  // Header, gaps and padding are proportional to the body size `s`.
  spacing: { avatar: 2.0, headerGap: 0.95, titleGap: 0.45, mediaGap: 0.8, pad: 1.05 },
  photoTreatment: 'contained',
  overflow: 'Body shrinks to 26u (header and padding scale with it), attached media shrinks, then another layout is used.',

  requires(c) {
    if (!posterName(c)) return 'Needs an author or attribution to show who posted it.';
    const text = c.kind === 'quote' ? c.quote : c.title || c.body;
    return text ? null : 'Needs text.';
  },

  compose(ctx) {
    const { W, H, u, box, content: c, type, colors, env } = ctx;
    const ops = [];
    const sp = this.spacing;
    const wide = W / H > 1.3;
    const pw = wide ? Math.min(box.w, px(H * 1.4)) : box.w;
    const px0 = box.x + (box.w - pw) / 2;
    const peek = px(22 * u); // the second card showing below the panel
    const avail = box.h - peek;

    const name = posterName(c);
    const handleSrc = c.author || c.attribution ? c.sourceName || hostname(c.sourceUrl) : hostname(c.sourceUrl);
    const handle = handleSrc && handleSrc !== name ? handleSrc : null;
    const isQuote = c.kind === 'quote';
    const title = !isQuote && c.title && c.body ? c.title : null;
    const body = isQuote ? `“${c.quote}”` : c.body || c.title;
    const bodyFace = isQuote ? type.quote : type.text;
    const nameFace = { ...type.meta, uppercase: false, tracking: 0 };
    const handleFace = { ...type.text, uppercase: false, tracking: 0, style: 'normal' };
    const img = c.kind === 'article' && ctx.image ? ctx.image : null;

    // Everything is laid out from one body size `s`; the largest that fits wins.
    // On wide cards attached media sits beside the text instead of below it.
    const sideMedia = Boolean(img) && W / H > 1.25;
    const measureAt = (s, mediaFraction) => {
      const pad = px(Math.max(40 * u, s * sp.pad));
      const inner = pw - pad * 2;
      const mediaW = sideMedia ? px(inner * 0.4) : 0;
      const textW = sideMedia ? inner - mediaW - px(s * sp.mediaGap) : inner;
      const avatar = px(Math.min(s * sp.avatar, inner * 0.18));
      // The name shrinks on its own to fit beside the avatar, so a long name
      // never forces the whole post smaller (floor: 24u).
      const nameRoom = inner - avatar - px(s * 0.45);
      const nameSize = Math.max(px(24 * u), Math.min(px(s * 0.62), Math.floor(nameRoom / (textWidth(env, nameFace, 100, name) / 100))));
      const handleSize = Math.max(px(22 * u), px(s * 0.5));
      const titleLay = title ? layoutText(env, { text: title, face: type.display, size: px(s * 1.1 * ds(type)), lineHeight: type.lineHeight.display, width: textW, balance: true }) : null;
      const bodyLay = layoutText(env, { text: body, face: bodyFace, size: s, lineHeight: (isQuote ? type.lineHeight.display + 0.1 : type.lineHeight.text) - 0.04, width: textW, balance: body.length <= 160 });
      // Keep lines from collapsing to a word each: the longest word may use at most 62% of the measure.
      const longest = Math.max(...body.split(/\s+/).map((w) => textWidth(env, bodyFace, s, w)));
      const ragged = longest > textW * 0.62;
      let h = avatar + px(s * sp.headerGap) + bodyLay.height;
      if (titleLay) h += titleLay.height + px(s * sp.titleGap);
      const contentH = h;
      if (sideMedia) {
        // Media spans the text column's height, never shorter than 4:3.
        const textH = contentH - avatar - px(s * sp.headerGap);
        const mediaH = Math.max(textH, px(mediaW * 0.75));
        const total = avatar + px(s * sp.headerGap) + mediaH;
        const nameW = textWidth(env, nameFace, nameSize, name);
        return { s, pad, inner, textW, mediaW, avatar, nameSize, handleSize, titleLay, bodyLay, mediaH, height: total + pad * 2, nameFits: nameW <= nameRoom, side: true, ragged };
      }
      const mediaH = mediaFraction ? px((avail - pad * 2 - contentH) > 0 ? Math.min(avail * mediaFraction, avail - pad * 2 - contentH - px(s * sp.mediaGap)) : 0) : 0;
      if (mediaH > 0) h += px(s * sp.mediaGap) + mediaH;
      const nameW = textWidth(env, nameFace, nameSize, name);
      return { s, pad, inner, textW, mediaW: inner, avatar, nameSize, handleSize, titleLay, bodyLay, mediaH: Math.max(0, mediaH), height: h + pad * 2, nameFits: nameW <= nameRoom, side: false, ragged };
    };

    const length = (title?.length ?? 0) + body.length;
    const min = px(26 * u * ts(type));
    const max = Math.max(min, px(maxBodySize(length) * u * ts(type)));
    // Attached media must keep a sensible shape (no wider than 3.2:1); the
    // text gives way first.
    const fits = (m) => m.height <= avail && m.nameFits && (!m.ragged || m.s === min) && (!img || m.side || m.mediaH >= Math.max(avail * 0.18, m.inner / 3.2));
    let best = null;
    for (const fraction of img && !sideMedia ? [0.42, 0.32, 0.24] : [0]) {
      let lo = min;
      let hi = max;
      if (!fits(measureAt(lo, fraction))) continue;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        if (fits(measureAt(mid, fraction))) lo = mid;
        else hi = mid - 1;
      }
      best = measureAt(lo, fraction);
      break;
    }
    const ok = Boolean(best);
    const m = best ?? measureAt(min, img ? 0.24 : 0);

    const ph = Math.min(m.height, avail);
    // Optical centre: slightly above the middle, so the post doesn't look like it's sinking.
    const py = box.y + Math.max(0, (avail - ph) * 0.42);
    const radius = px(Math.max(20 * u, m.s * 0.55));
    // A second card peeking out below gives the post a quiet sense of a feed.
    ops.push({ type: 'rect', x: px(px0 + m.pad * 0.7), y: px(py + peek), w: px(pw - m.pad * 1.4), h: px(ph), fill: mix(colors.surface, colors.canvas, 0.55), radius, stroke: colors.divider, strokeWidth: Math.max(1, 1.5 * u) });
    ops.push({ type: 'rect', x: px(px0), y: px(py), w: px(pw), h: px(ph), fill: colors.surface, radius, stroke: colors.divider, strokeWidth: Math.max(1, 1.5 * u) });

    const x = px0 + m.pad;
    let y = py + m.pad;

    // Header: avatar initials, name and handle.
    ops.push({ type: 'rect', x: px(x), y: px(y), w: m.avatar, h: m.avatar, radius: m.avatar / 2, fill: colors.accent });
    const iniSize = px(m.avatar * 0.4);
    const ini = initials(name);
    const iw = textWidth(env, nameFace, iniSize, ini);
    ops.push({ type: 'text', text: ini, x: px(x + (m.avatar - iw) / 2), y: px(y + m.avatar / 2 + iniSize * 0.35), size: iniSize, face: nameFace, color: colors.surface });
    const nx = x + m.avatar + px(m.s * 0.45);
    const nameH = px(m.nameSize * 1.25);
    const handleH = handle ? px(m.handleSize * 1.3) : 0;
    const top = y + (m.avatar - nameH - handleH) / 2;
    ops.push(metaLine(env, nameFace, m.nameSize, name, nx, top, colors.text, 1.25).op);
    if (handle) ops.push(metaLine(env, handleFace, m.handleSize, handle, nx, top + nameH, colors.muted, 1.3).op);
    y += m.avatar + px(m.s * sp.headerGap);

    if (m.titleLay) {
      ops.push(...textOps(env, m.titleLay, { x, y, color: colors.text }));
      y += m.titleLay.height + px(m.s * sp.titleGap);
    }
    ops.push(...textOps(env, m.bodyLay, { x, y, color: title ? colors.muted : colors.text }));
    y += m.bodyLay.height;
    if (m.side) {
      const mediaTop = py + m.pad + m.avatar + px(m.s * sp.headerGap);
      ops.push(imageOp(img, { x: x + m.inner - m.mediaW, y: mediaTop, w: m.mediaW, h: m.mediaH }, { radius: px(radius * 0.6) }));
    } else if (m.mediaH > 0) {
      y += px(m.s * sp.mediaGap);
      ops.push(imageOp(img, { x, y, w: m.inner, h: m.mediaH }, { radius: px(radius * 0.6) }));
    }
    return { ops, fits: ok, need: ok ? m.height / avail : Math.max(1.05, m.height / avail) };
  },
};
