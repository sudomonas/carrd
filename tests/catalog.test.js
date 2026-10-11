import { describe, it, expect } from 'vitest';
import { PALETTES } from '../src/config/palettes.js';
import { FONT_PAIRS } from '../src/config/typography.js';
import { OUTPUT_PRESETS, PLATFORMS, validateCustomSize, resolveOutput } from '../src/config/outputs.js';
import { contrast } from '../src/engine/color.js';
import { rankLayouts, composeCard, selectLayout } from '../src/engine/compose.js';
import { LAYOUTS } from '../src/engine/layouts/index.js';
import { figureParts } from '../src/engine/layouts/figure.js';
import { initials } from '../src/engine/layouts/post.js';
import { posterLines } from '../src/engine/layouts/poster.js';
import { normalizeContent, defaultDesign } from '../src/model/document.js';
import { mockEnv } from './helpers.js';

describe('palettes', () => {
  it('has unique ids and at least 20 entries', () => {
    expect(new Set(PALETTES.map((p) => p.id)).size).toBe(PALETTES.length);
    expect(PALETTES.length).toBeGreaterThanOrEqual(20);
  });
  for (const p of PALETTES) {
    it(`${p.id} meets contrast targets`, () => {
      const r = p.roles;
      expect(contrast(r.text, r.canvas)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(r.text, r.surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(r.mutedText, r.canvas)).toBeGreaterThanOrEqual(3);
      expect(contrast(r.accent, r.canvas)).toBeGreaterThanOrEqual(3);
    });
  }
  it('keeps the default palette first', () => {
    expect(PALETTES[0].id).toBe('warm-paper');
  });
});

describe('font pairings', () => {
  it('has unique ids and at least 13 entries', () => {
    expect(new Set(FONT_PAIRS.map((f) => f.id)).size).toBe(FONT_PAIRS.length);
    expect(FONT_PAIRS.length).toBeGreaterThanOrEqual(13);
  });
});

describe('social sizes', () => {
  it('every preset is valid, belongs to a platform and has unique id', () => {
    expect(new Set(OUTPUT_PRESETS.map((p) => p.id)).size).toBe(OUTPUT_PRESETS.length);
    for (const p of OUTPUT_PRESETS) {
      expect(validateCustomSize(p.width, p.height).ok, p.id).toBe(true);
      expect(PLATFORMS.some((x) => x.id === p.platform), p.id).toBe(true);
    }
  });
  it('every preset can show an article and a quote', () => {
    const env = mockEnv();
    const article = normalizeContent({ kind: 'article', title: 'A headline that matters', body: 'Short excerpt.', sourceName: 'Example' });
    const quote = normalizeContent({ kind: 'quote', quote: 'Less, but better.', attribution: 'Dieter Rams' });
    for (const p of OUTPUT_PRESETS) {
      for (const content of [article, quote]) {
        const design = { ...defaultDesign(), outputPresetId: p.id };
        expect(rankLayouts(content, design, env).length, `${p.id}`).toBeGreaterThan(0);
        const s = composeCard({ content, design: { ...design, layoutId: selectLayout(content, design, env) } }, env);
        expect([s.width, s.height]).toEqual([p.width, p.height]);
        expect(s.fits, `${p.id} ${content.kind}`).toBe(true);
      }
    }
  });
  it('names platform presets for display', () => {
    expect(resolveOutput({ outputPresetId: 'ig-story' }).name).toBe('Instagram · Story & Reels');
    expect(resolveOutput({ outputPresetId: 'portrait' }).name).toBe('Portrait');
  });
});

describe('new layouts', () => {
  it('registry has 11 layouts with unique ids', () => {
    expect(LAYOUTS).toHaveLength(11);
    expect(new Set(LAYOUTS.map((l) => l.id)).size).toBe(11);
  });

  it('figureParts splits a leading number without losing text', () => {
    const cases = ['87% of teams ship weekly.', '$1.2M raised in seed funding', '3.5× faster builds', '10k people joined'];
    for (const t of cases) {
      const p = figureParts(normalizeContent({ kind: 'text', body: t }));
      expect(`${p.figure} ${p.statement}`).toBe(t);
    }
    expect(figureParts(normalizeContent({ kind: 'text', body: 'No number here' }))).toBeNull();
    expect(figureParts(normalizeContent({ kind: 'text', body: '42' }))).toBeNull();
  });

  it('number-led posts default to the figure layout', () => {
    const c = normalizeContent({ kind: 'text', body: '87% of teams ship weekly.' });
    expect(selectLayout(c, defaultDesign(), mockEnv())).toBe('figure');
  });

  it('initials come from the first and last word', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Grace Brewster Hopper')).toBe('GH');
    expect(initials('@carrd')).toBe('C');
  });

  it('poster lines fill the width and never split words', () => {
    const env = mockEnv();
    const face = { family: 'Carrd Inter', weight: 700 };
    const set = posterLines(env, face, 'Make it simple but significant', 900, 1200, { min: 48, cap: 400 });
    expect(set.lines.join(' ')).toBe('MAKE IT SIMPLE BUT SIGNIFICANT');
    for (const [i, line] of set.lines.entries()) {
      expect(env.measure(face, set.sizes[i], line)).toBeLessThanOrEqual(900 + 1);
    }
  });

  it('post requires a real name rather than inventing one', () => {
    const env = mockEnv();
    const post = LAYOUTS.find((l) => l.id === 'post');
    expect(post.requires(normalizeContent({ kind: 'text', body: 'Hello' }), {})).toMatch(/author/);
    expect(post.requires(normalizeContent({ kind: 'text', body: 'Hello', attribution: 'Sam' }), {})).toBeNull();
    const s = composeCard({ content: normalizeContent({ kind: 'text', body: 'Hello world', attribution: 'Sam Lee' }), design: { ...defaultDesign(), layoutId: 'post' } }, env);
    expect(s.ops.some((o) => o.type === 'text' && o.text === 'SL')).toBe(true);
  });
});

describe('post layout quality', () => {
  const env = mockEnv({ upload: { width: 1600, height: 1000 } });
  const design = (outputPresetId) => ({ ...defaultDesign(), layoutId: 'post', layoutLocked: true, outputPresetId });
  const textOps = (s) => s.ops.filter((o) => o.type === 'text');

  it('short posts get large type, long posts smaller', () => {
    const short = composeCard({ content: normalizeContent({ kind: 'text', body: 'Defaults matter more than options.', author: 'Sam Lee' }), design: design('portrait') }, env);
    const long = composeCard({ content: normalizeContent({ kind: 'text', body: 'word '.repeat(80).trim(), author: 'Sam Lee' }), design: design('portrait') }, env);
    const bodySize = (s) => Math.max(...textOps(s).map((o) => o.size));
    expect(bodySize(short)).toBeGreaterThan(bodySize(long) * 1.5);
  });

  it('a long name shrinks itself instead of the post', () => {
    const body = 'Simplicity is prerequisite for reliability.';
    const shortName = composeCard({ content: normalizeContent({ kind: 'quote', quote: body, attribution: 'Ed' }), design: design('story') }, env);
    const longName = composeCard({ content: normalizeContent({ kind: 'quote', quote: body, attribution: 'Edsger W. Dijkstra' }), design: design('story') }, env);
    const quoteSize = (s) => textOps(s).find((o) => o.text.startsWith('“')).size;
    expect(quoteSize(longName)).toBe(quoteSize(shortName));
  });

  it('wide cards place attached media beside the text', () => {
    const content = normalizeContent({ kind: 'article', title: 'Small web', body: 'Personal sites are back.', author: 'Ada Park', image: { assetId: 'upload', width: 1600, height: 1000 } });
    const s = composeCard({ content, design: design('landscape') }, env);
    expect(s.fits).toBe(true);
    const img = s.ops.find((o) => o.type === 'image');
    const body = textOps(s).find((o) => o.text.startsWith('Personal'));
    expect(img.x).toBeGreaterThan(body.x);
    expect(img.w / img.h).toBeLessThanOrEqual(3.2);
  });
});

describe('textures', () => {
  it('every texture background resolves to a texture op tinted from the palette', async () => {
    const { BACKGROUNDS } = await import('../src/config/backgrounds.js');
    const env = mockEnv();
    const content = normalizeContent({ kind: 'quote', quote: 'Less, but better.', attribution: 'Dieter Rams' });
    for (const bg of BACKGROUNDS.filter((b) => b.texture)) {
      const s = composeCard({ content, design: { ...defaultDesign(), layoutId: 'centered', paletteId: 'ink', backgroundId: bg.id } }, env);
      const op = s.ops.find((o) => o.type === 'texture');
      expect(op?.id, bg.id).toBe(bg.texture);
      expect(op.color).toMatch(/^#/);
      expect(op.scale).toBeGreaterThan(0);
    }
  });

  it('keeps the original "texture" id as paper grain for saved drafts', async () => {
    const { getBackground } = await import('../src/config/backgrounds.js');
    expect(getBackground('texture').texture).toBe('paper');
  });
});

describe('shuffle', async () => {
  const { shuffleDesign, availableBackgrounds } = await import('../src/engine/shuffle.js');
  const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const env = mockEnv();
  const content = normalizeContent({ kind: 'article', title: 'The quiet return of the small web', body: 'Personal sites are back.', sourceName: 'Margin', author: 'Ada Park' });
  const base = { ...defaultDesign(), layoutId: 'editorial', outputPresetId: 'ig-story' };

  it('changes style but never the size, and always fits', () => {
    const rng = seeded(1);
    for (let i = 0; i < 40; i++) {
      const d = shuffleDesign(content, base, env, { rng });
      expect(d).not.toBeNull();
      expect(d.outputPresetId).toBe('ig-story');
      expect(d.paletteId).not.toBe(base.paletteId);
      expect(d.fontPairId).not.toBe(base.fontPairId);
      expect(d.layoutLocked).toBe(true);
      const s = composeCard({ content, design: d }, env, { fallback: false });
      expect(s.fits).toBe(true);
      expect(s.layoutId).toBe(d.layoutId);
    }
  });

  it('is deterministic for a given random source', () => {
    expect(shuffleDesign(content, base, env, { rng: seeded(7) })).toEqual(shuffleDesign(content, base, env, { rng: seeded(7) }));
  });

  it('includes custom palettes and pairings', () => {
    const custom = { id: 'custom-x', label: 'X', roles: { canvas: '#111111', surface: '#222222', text: '#FFFFFF', mutedText: '#BBBBBB', accent: '#FFCC00', divider: '#333333' } };
    const withCustom = { ...env, palettes: [custom] };
    const seen = new Set();
    const rng = seeded(3);
    for (let i = 0; i < 200; i++) seen.add(shuffleDesign(content, base, withCustom, { rng }).paletteId);
    expect(seen.has('custom-x')).toBe(true);
  });

  it('never offers photo or source backgrounds without an image', () => {
    const ids = availableBackgrounds(content, base, env);
    expect(ids).not.toContain('photo');
    expect(ids).not.toContain('source');
    expect(ids).toContain('tex-grid');
  });

  it('returns null when nothing can fit', () => {
    const huge = normalizeContent({ kind: 'text', title: 'Essay', body: 'words '.repeat(4000) });
    expect(shuffleDesign(huge, { ...base, outputPresetId: 'landscape' }, env, { rng: seeded(2), attempts: 5 })).toBeNull();
  });
});
