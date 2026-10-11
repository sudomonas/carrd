// Deterministic composition engine: content + design -> a scene of draw
// operations at exact output pixels. Independent of React and the DOM; the
// caller provides `env = { measure, images }` where images maps asset ids to
// { width, height, luma } statistics of loaded images.
import { LAYOUTS, getLayout } from './layouts/index.js';
import { getPalette } from '../config/palettes.js';
import { getFontPair } from '../config/typography.js';
import { resolveOutput } from '../config/outputs.js';
import { BACKGROUNDS, getBackground, getTexture } from '../config/backgrounds.js';
import { contentTextLength, hasRenderableContent } from '../model/document.js';
import { mix, solveOverlayAlpha, withAlpha } from './color.js';
import { imageOp, marginsFor, regionLuma, unitFor, px } from './layouts/shared.js';

function colorsFor(palette) {
  const r = palette.roles;
  return { canvas: r.canvas, surface: r.surface, text: r.text, muted: r.mutedText, accent: r.accent, divider: r.divider };
}

const imageInfo = (assetId, env, fallback) => {
  const s = env.images?.[assetId];
  if (s) return { assetId, width: s.width, height: s.height };
  return fallback ? { assetId, width: fallback.width, height: fallback.height } : null;
};

/** Which background is actually drawn (a missing photo falls back to solid). */
export function effectiveBackground(design, content, env) {
  const bg = BACKGROUNDS.find((b) => b.id === design.backgroundId) ?? BACKGROUNDS[0];
  if (bg.id === 'photo') {
    return env.images?.background ? { id: 'photo', image: imageInfo('background', env) } : { id: 'paper', missing: 'photo' };
  }
  if (bg.id === 'source') {
    return content.image ? { id: 'source', image: imageInfo(content.image.assetId, env, content.image) } : { id: 'paper', missing: 'source' };
  }
  return { id: bg.id };
}

/** The photograph a layout would use: the content image, else a background photo. */
function layoutImage(layout, content, bg) {
  if (layout.image === 'none') return null;
  if (content.image) return { assetId: content.image.assetId, width: content.image.width, height: content.image.height };
  if (layout.image === 'required' && bg.image) return bg.image;
  return null;
}

export function eligibility(layout, content, design, env) {
  const { width: W, height: H } = resolveOutput(design);
  if (!layout.supports.includes(content.kind)) return { ok: false, reason: `Doesn't support ${content.kind} content.` };
  const bg = effectiveBackground(design, content, env);
  const reason = layout.requires(content, { image: layoutImage(layout, content, bg) });
  if (reason) return { ok: false, reason };
  const aspect = W / H;
  if (aspect < layout.aspect.min || aspect > layout.aspect.max) return { ok: false, reason: 'Unsupported aspect ratio.' };
  if (W < layout.minSize.width || H < layout.minSize.height) return { ok: false, reason: 'Output is too small.' };
  return { ok: true };
}

/**
 * Scoring rules (higher is better; ties keep registry order):
 *  - affinity:  layout.affinity[kind] × 10        (0–100) how well the layout suits the content type
 *  - length:    +10 inside layout.textRange; outside it, −1 per 10% of distance, capped at −30
 *  - image:     +12 when an optional thumbnail slot gets a real image
 *               +8  when a photo-led layout has a photo
 *               −15 when the content has an image and the layout cannot show it
 */
export function scoreLayout(layout, content, design, env) {
  const len = contentTextLength(content);
  const { min, max } = layout.textRange;
  let score = (layout.affinity[content.kind] ?? 0) * 10;
  if (len >= min && len <= max) score += 10;
  else {
    const dist = len < min ? (min - len) / Math.max(min, 1) : (len - max) / max;
    score -= Math.min(30, Math.round(dist * 10));
  }
  const bg = effectiveBackground(design, content, env);
  const img = layoutImage(layout, content, bg);
  if (layout.image === 'optional' && img) score += 12;
  if (layout.image === 'required' && img) score += 8;
  if (layout.image === 'none' && content.image) score -= 15;
  return score;
}

/** Eligible layouts, best first. */
export function rankLayouts(content, design, env) {
  return LAYOUTS.map((layout, order) => ({ layout, order, check: eligibility(layout, content, design, env) }))
    .filter((x) => x.check.ok)
    .map((x) => ({ ...x, score: scoreLayout(x.layout, content, design, env) }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .map(({ layout, score }) => ({ layout, score }));
}

function backgroundOps(bg, colors, W, H, env) {
  const ops = [{ type: 'rect', x: 0, y: 0, w: W, h: H, fill: colors.canvas }];
  const texture = getTexture(getBackground(bg.id).texture);
  if (texture) {
    ops.push({
      type: 'texture',
      id: texture.id,
      alpha: texture.alpha,
      color: colors[texture.role === 'mutedText' ? 'muted' : texture.role],
      scale: texture.scale * unitFor(W, H),
      x: 0, y: 0, w: W, h: H,
    });
  }
  if (bg.id === 'gradient') {
    ops[0] = {
      type: 'rect', x: 0, y: 0, w: W, h: H,
      fill: { type: 'linear', x0: 0, y0: 0, x1: W * 0.6, y1: H, stops: [[0, colors.canvas], [1, mix(colors.canvas, colors.accent, 0.28)]] },
    };
  }
  let photoOp = null;
  if (bg.image) {
    photoOp = imageOp(bg.image, { x: 0, y: 0, w: W, h: H });
    ops.push(photoOp);
  }
  return { ops, photoOp, stats: bg.image ? env.images?.[bg.image.assetId] : null };
}

function runLayout(layout, content, design, env) {
  const { width: W, height: H } = resolveOutput(design);
  const palette = getPalette(design.paletteId, env.palettes);
  const type = getFontPair(design.fontPairId, env.fontPairs);
  const colors = colorsFor(palette);
  const u = unitFor(W, H);
  const { mx, my } = marginsFor(W, H);
  const bg = effectiveBackground(design, content, env);
  const ops = [];
  let box = { x: mx, y: my, w: W - mx * 2, h: H - my * 2 };

  const isPhotoBg = Boolean(bg.image);
  const treatment = isPhotoBg ? layout.photoTreatment : null;
  // Cinematic draws its own photograph; a photo background is then redundant.
  const drawn = backgroundOps(treatment === 'own' ? { id: 'paper' } : bg, colors, W, H, env);
  ops.push(...drawn.ops);

  if (treatment === 'surface') {
    // Contained text surface over the photograph.
    const inset = px(Math.min(W, H) * 0.05);
    ops.push({ type: 'rect', x: inset, y: inset, w: W - inset * 2, h: H - inset * 2, fill: colors.surface, radius: px(10 * u) });
    const ix = px(mx * 0.8);
    const iy = px(my * 0.8);
    box = { x: inset + ix, y: inset + iy, w: W - (inset + ix) * 2, h: H - (inset + iy) * 2 };
  } else if (treatment === 'scrim') {
    const lum = regionLuma(drawn.stats, drawn.photoOp, { x: 0, y: 0, w: W, h: H });
    const alpha = Math.max(0.35, solveOverlayAlpha(colors.text, colors.canvas, lum.min, lum.max, 4.5));
    ops.push({ type: 'rect', x: 0, y: 0, w: W, h: H, fill: withAlpha(colors.canvas, alpha) });
  }

  const ctx = { W, H, u, box, content, colors, type, env, image: layoutImage(layout, content, bg), backgroundIsPhoto: isPhotoBg };
  const res = layout.compose(ctx);
  return { ...res, ops: [...ops, ...res.ops], width: W, height: H, bg };
}

/** Picks the best eligible layout that fits; used when the layout is automatic. */
export function selectLayout(content, design, env) {
  const ranked = rankLayouts(content, design, env);
  for (const { layout } of ranked) {
    if (runLayout(layout, content, design, env).fits) return layout.id;
  }
  return ranked[0]?.layout.id ?? null;
}

function overflowMessage(layout, result, content, outputLabel) {
  if (content.kind === 'code' && result.detail) {
    return `This snippet needs ${result.detail.rows} lines; about ${result.detail.fitRows} fit at the smallest readable size. Shorten it or choose a taller size such as Story.`;
  }
  const extra = Math.max(5, Math.round((result.need - 1) * 100 / 5) * 5);
  const what = content.kind === 'article' ? 'Shorten the excerpt' : content.kind === 'list' ? 'Remove an item or shorten them' : 'Shorten the text';
  return `The content needs about ${extra}% more room than ${outputLabel} allows at a readable size. ${what}, or choose a taller size.`;
}

/**
 * Composes a card.
 * options.layoutId   – force a layout (thumbnails); defaults to design.layoutId
 * options.fallback   – try other eligible layouts when the chosen one overflows (default true)
 * Returns { ok, layoutId, requestedLayoutId, width, height, ops, fits, notices, background }.
 */
export function composeCard(doc, env, options = {}) {
  const { content, design } = doc;
  const out = resolveOutput(design);
  const notices = [];
  if (!hasRenderableContent(content)) {
    return { ok: false, width: out.width, height: out.height, ops: [], fits: true, notices: [{ level: 'info', text: 'Add some content to compose a card.' }] };
  }
  const requestedId = options.layoutId ?? design.layoutId;
  const ranked = rankLayouts(content, design, env);
  if (!ranked.length) {
    return { ok: false, width: out.width, height: out.height, ops: [], fits: false, notices: [{ level: 'error', text: 'No layout can show this content at this size. Try a different output size.' }] };
  }
  const requested = getLayout(requestedId);
  let layout = ranked.find((r) => r.layout.id === requestedId)?.layout;
  if (!layout) {
    layout = ranked[0].layout;
    if (requested && design.layoutLocked && !options.layoutId) {
      notices.push({ level: 'info', text: `${requested.label} can't show this content here, so ${layout.label} is used.` });
    }
  }
  let result = runLayout(layout, content, design, env);
  if (!result.fits && options.fallback !== false) {
    for (const { layout: alt } of ranked) {
      if (alt === layout) continue;
      const r = runLayout(alt, content, design, env);
      if (r.fits) {
        notices.push({ level: 'info', text: `${layout.label} can't fit this content at ${out.name}; showing ${alt.label} instead.` });
        layout = alt;
        result = r;
        break;
      }
    }
  }
  if (!result.fits) notices.push({ level: 'error', text: overflowMessage(layout, result, content, out.name) });
  if (result.bg.missing === 'source') notices.push({ level: 'info', text: 'This content has no source image, so a solid background is used.' });

  return {
    ok: true,
    layoutId: layout.id,
    requestedLayoutId: requestedId,
    width: out.width,
    height: out.height,
    ops: result.ops,
    fits: result.fits,
    notices,
    background: result.bg.id,
  };
}

/** Plain-text description of a card for assistive technology. */
export function describeCard(content) {
  const parts = [];
  if (content.kind === 'quote') parts.push(`Quote: ${content.quote}`, content.attribution && `— ${content.attribution}`);
  else if (content.kind === 'list') parts.push(content.title, ...content.items.map((t, i) => `${i + 1}. ${t}`));
  else if (content.kind === 'code') parts.push(content.title, `Code${content.codeLanguage ? ` (${content.codeLanguage})` : ''}`);
  else parts.push(content.title, content.body, content.author && `By ${content.author}`, content.attribution);
  if (content.sourceName) parts.push(content.sourceName);
  return parts.filter(Boolean).join('. ').slice(0, 600);
}
