import { describe, it, expect } from 'vitest';
import { composeCard, rankLayouts, selectLayout, eligibility } from '../src/engine/compose.js';
import { LAYOUTS, getLayout } from '../src/engine/layouts/index.js';
import { wrapCode } from '../src/engine/layouts/code.js';
import { normalizeContent, defaultDesign } from '../src/model/document.js';
import { OUTPUT_PRESETS } from '../src/config/outputs.js';
import { mockEnv, lumaGrid } from './helpers.js';

const env = mockEnv({ upload: { width: 1600, height: 1000, luma: lumaGrid(0.05) }, background: { width: 1200, height: 1200, luma: lumaGrid(0.9) } });
const img = { assetId: 'upload', width: 1600, height: 1000 };

const CONTENT = {
  article: normalizeContent({ kind: 'article', title: 'The quiet return of the small web', body: 'Personal sites are back, and they look nothing like they used to.', sourceName: 'The Example', author: 'Ada Lovelace', sourceUrl: 'https://example.com/a' }),
  articleImg: normalizeContent({ kind: 'article', title: 'The quiet return of the small web', body: 'Personal sites are back.', sourceName: 'The Example', image: img }),
  quote: normalizeContent({ kind: 'quote', quote: 'Simplicity is prerequisite for reliability.', attribution: 'Edsger W. Dijkstra' }),
  text: normalizeContent({ kind: 'text', body: 'Ship the boring version first.' }),
  image: normalizeContent({ kind: 'image', image: img, title: 'Morning light', attribution: 'Jane Doe' }),
  code: normalizeContent({ kind: 'code', title: 'Debounce', body: 'function debounce(fn, ms) {\n\tlet t;\n  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };\n}', codeLanguage: 'javascript' }),
  list: normalizeContent({ kind: 'list', title: 'Three facts', items: ['One', 'Two', 'Three'] }),
};

const doc = (content, design = {}) => ({ content, design: { ...defaultDesign(), ...design } });
const texts = (scene) => scene.ops.filter((o) => o.type === 'text').map((o) => o.text);
const allText = (scene) => texts(scene).join(' ');

describe('layout selection', () => {
  const expected = { article: 'editorial', articleImg: 'editorial', quote: 'centered', text: 'headline', image: 'cinematic', code: 'code', list: 'list' };
  for (const [name, id] of Object.entries(expected)) {
    it(`${name} defaults to ${id}`, () => {
      expect(selectLayout(CONTENT[name], defaultDesign(), env)).toBe(id);
    });
  }

  it('excludes incompatible layouts', () => {
    const ids = rankLayouts(CONTENT.code, defaultDesign(), env).map((r) => r.layout.id);
    expect(ids).toEqual(['code']);
    expect(eligibility(getLayout('cinematic'), CONTENT.quote, defaultDesign(), env).ok).toBe(false);
  });

  it('a background photo makes cinematic eligible for quotes', () => {
    const d = { ...defaultDesign(), backgroundId: 'photo' };
    expect(eligibility(getLayout('cinematic'), CONTENT.quote, d, env).ok).toBe(true);
  });

  it('is stable when unrelated settings change', () => {
    const base = selectLayout(CONTENT.article, defaultDesign(), env);
    for (const patch of [{ paletteId: 'ink' }, { paletteId: 'blackout' }, { backgroundId: 'texture' }, { backgroundId: 'gradient' }]) {
      expect(selectLayout(CONTENT.article, { ...defaultDesign(), ...patch }, env)).toBe(base);
      const s = composeCard(doc(CONTENT.article, { layoutId: base, ...patch }), env);
      expect(s.layoutId).toBe(base);
    }
  });

  it('every layout declares the documented contract', () => {
    for (const l of LAYOUTS) {
      for (const key of ['supports', 'requiredFields', 'optionalFields', 'image', 'textRange', 'aspect', 'minSize', 'typography', 'spacing', 'overflow']) {
        expect(l[key], `${l.id}.${key}`).toBeDefined();
      }
    }
  });
});

describe('composition', () => {
  it('produces scenes at exact output sizes and reflows per size', () => {
    const heights = new Set();
    for (const p of OUTPUT_PRESETS) {
      const s = composeCard(doc(CONTENT.article, { layoutId: 'editorial', outputPresetId: p.id }), env);
      expect([s.width, s.height]).toEqual([p.width, p.height]);
      expect(s.fits).toBe(true);
      const head = s.ops.find((o) => o.type === 'text' && o.face.weight === 600 && o.size > 40);
      heights.add(`${head.size}:${texts(s).length}`);
    }
    expect(heights.size).toBeGreaterThan(1);
  });

  it('keeps content and attribution through palette, type and background changes', () => {
    for (const paletteId of ['warm-paper', 'ink', 'newsprint']) {
      for (const fontPairId of ['literary', 'monospace']) {
        for (const backgroundId of ['paper', 'gradient', 'photo']) {
          const s = composeCard(doc(CONTENT.quote, { layoutId: 'centered', paletteId, fontPairId, backgroundId }), env);
          const t = allText(s).replace(/\s+/g, ' ');
          expect(t).toContain('Simplicity');
          expect(t).toContain('reliability.');
          expect(t.toUpperCase()).toContain('EDSGER W. DIJKSTRA');
        }
      }
    }
  });

  it('typography changes trigger remeasurement', () => {
    const a = composeCard(doc(CONTENT.article, { layoutId: 'editorial', fontPairId: 'literary' }), env);
    const b = composeCard(doc(CONTENT.article, { layoutId: 'editorial', fontPairId: 'monospace' }), env);
    expect(JSON.stringify(a.ops)).not.toBe(JSON.stringify(b.ops));
  });

  it('background changes never mutate content', () => {
    const content = structuredClone(CONTENT.articleImg);
    const before = JSON.stringify(content);
    composeCard(doc(content, { backgroundId: 'source' }), env);
    composeCard(doc(content, { backgroundId: 'photo' }), env);
    expect(JSON.stringify(content)).toBe(before);
  });

  it('missing metadata leaves no empty placeholders', () => {
    const bare = normalizeContent({ kind: 'article', title: 'Just a title' });
    const s = composeCard(doc(bare, { layoutId: 'editorial' }), env);
    expect(texts(s).every((t) => t.trim().length > 0)).toBe(true);
    expect(allText(s)).toBe('Just a title');
  });

  it('long headlines stay within the card', () => {
    const long = normalizeContent({ kind: 'article', title: 'An extraordinarily long headline that keeps going '.repeat(3), body: 'Body.' });
    const s = composeCard(doc(long, { layoutId: 'editorial' }), env);
    expect(s.fits).toBe(true);
    for (const op of s.ops.filter((o) => o.type === 'text')) {
      expect(op.x).toBeGreaterThanOrEqual(0);
      expect(op.y).toBeLessThanOrEqual(s.height);
      expect(op.x + env.measure(op.face, op.size, op.text)).toBeLessThanOrEqual(s.width);
    }
  });

  it('falls back to another layout when the chosen one overflows', () => {
    const c = normalizeContent({ kind: 'text', body: `${'This sentence explains a small idea in plain words. '.repeat(20)}` });
    const s = composeCard(doc(c, { layoutId: 'centered', layoutLocked: true }), env);
    expect(s.fits).toBe(true);
    expect(s.layoutId).not.toBe('centered');
    expect(s.notices.some((n) => /instead/.test(n.text))).toBe(true);
  });

  it('unfittable content produces an actionable error, not clipped text', () => {
    const c = normalizeContent({ kind: 'text', title: 'Essay', body: 'words '.repeat(3000) });
    const s = composeCard(doc(c, { layoutId: 'editorial', outputPresetId: 'landscape' }), env);
    expect(s.fits).toBe(false);
    const err = s.notices.find((n) => n.level === 'error');
    expect(err.text).toMatch(/Shorten|taller/);
  });

  it('code text is never modified', () => {
    const s = composeCard(doc(CONTENT.code, { layoutId: 'code' }), env);
    expect(s.fits).toBe(true);
    const { lines } = wrapCode(CONTENT.code.body, Infinity);
    const drawn = texts(s).join('').replace(/\s/g, '');
    expect(drawn).toContain(lines.join('').replace(/\s/g, '').slice(0, 40));
    expect(drawn.replace(/JAVASCRIPT|Debounce/g, '')).toBe(CONTENT.code.body.replace(/\s/g, ''));
  });

  it('wrapCode only splits lines, never alters characters', () => {
    const line = 'const veryLongName = someFunction(argumentOne, argumentTwo, argumentThree);';
    const { rows, lines } = wrapCode(`  ${line}`, 20);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.map((r) => lines[r.lineIndex].slice(r.start, r.end)).join('')).toBe(`  ${line}`);
    expect(rows.slice(1).every((r) => r.cont)).toBe(true);
  });

  it('oversized code reports how much fits', () => {
    const c = normalizeContent({ kind: 'code', body: Array.from({ length: 200 }, (_, i) => `line_${i}();`).join('\n') });
    const s = composeCard(doc(c, { layoutId: 'code', outputPresetId: 'landscape' }), env);
    expect(s.fits).toBe(false);
    expect(s.notices.find((n) => n.level === 'error').text).toMatch(/200 lines/);
  });

  it('cinematic solves a readable overlay over the photo', () => {
    const s = composeCard(doc(CONTENT.image, { layoutId: 'cinematic' }), env);
    expect(s.ops.some((o) => o.type === 'image' && o.assetId === 'upload')).toBe(true);
    const scrim = s.ops.find((o) => o.type === 'rect' && o.fill?.type === 'linear');
    expect(scrim).toBeTruthy();
    expect(s.fits).toBe(true);
  });

  it('image crops preserve aspect (cover, no stretching)', () => {
    const s = composeCard(doc(CONTENT.image, { layoutId: 'cinematic', outputPresetId: 'story' }), env);
    const op = s.ops.find((o) => o.type === 'image');
    expect(op.sw / op.sh).toBeCloseTo(op.w / op.h, 3);
  });

  it('source background falls back with a notice when there is no image', () => {
    const s = composeCard(doc(CONTENT.quote, { layoutId: 'centered', backgroundId: 'source' }), env);
    expect(s.background).toBe('paper');
    expect(s.notices.some((n) => /source image/.test(n.text))).toBe(true);
  });

  it('empty content composes nothing', () => {
    const s = composeCard(doc(normalizeContent({})), env);
    expect(s.ok).toBe(false);
  });
});

describe('content integrity across every layout', () => {
  const imgEnv = mockEnv({ upload: { width: 1600, height: 1000, luma: lumaGrid(0.3) } });
  const samples = [
    normalizeContent({ kind: 'article', title: 'Quiet web returns', body: 'Personal sites are back again.', sourceName: 'Margin', author: 'Ada Park', image: img }),
    normalizeContent({ kind: 'quote', quote: 'Less but better.', attribution: 'Dieter Rams', sourceName: 'Interview' }),
    normalizeContent({ kind: 'text', title: 'Ship early', body: 'Then improve with feedback.', attribution: 'Notes' }),
    normalizeContent({ kind: 'text', body: '87% of teams ship weekly.', author: 'Survey desk' }),
    normalizeContent({ kind: 'image', image: img, title: 'Harbour light', attribution: 'Jane Doe' }),
  ];
  const words = (s) => s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}%]+/gu, ' ').trim().split(' ').filter(Boolean);

  for (const layout of LAYOUTS) {
    for (const content of samples) {
      if (!eligibility(layout, content, defaultDesign(), imgEnv).ok) continue;
      it(`${layout.id} shows every word of ${content.kind}${content.title ? ` "${content.title}"` : ''}`, () => {
        for (const outputPresetId of ['portrait', 'landscape', 'story']) {
          const s = composeCard(doc(content, { layoutId: layout.id, outputPresetId }), imgEnv, { fallback: false });
          if (!s.fits) continue;
          const shown = new Set(words(texts(s).join(' ')));
          const expected = [content.title, content.body, content.quote, content.attribution, content.author, content.sourceName].filter(Boolean).flatMap(words);
          for (const w of expected) expect(shown.has(w), `${layout.id}@${outputPresetId} missing "${w}"`).toBe(true);
        }
      });
    }
  }
});
