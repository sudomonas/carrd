import { describe, it, expect } from 'vitest';
import { emptySource, looksLikeCode, looksLikeUrl, makeExcerpt, normalizeSource, parseListItems, parseText, sourceToContent } from '../src/model/input.js';
import { hasRenderableContent, validateDocument, normalizeContent, normalizeDesign, SCHEMA_VERSION } from '../src/model/document.js';

const withMode = (mode, patch) => {
  const s = emptySource();
  return { ...s, mode, [mode]: { ...s[mode], ...patch } };
};

describe('input detection', () => {
  it('detects URLs, including bare domains', () => {
    expect(looksLikeUrl('https://example.com/a?b=1')).toBe(true);
    expect(looksLikeUrl('example.com/post')).toBe(true);
    expect(looksLikeUrl('hello world')).toBe(false);
    expect(looksLikeUrl('javascript:alert(1)')).toBe(false);
  });

  it('detects code', () => {
    expect(looksLikeCode('const a = 1;\nfunction f() {\n  return a;\n}')).toBe(true);
    expect(looksLikeCode('Just a sentence.\nAnd another.')).toBe(false);
  });

  it('reads quoted text with an attribution line as a quote', () => {
    const r = parseText('“Less, but better.”\n— Dieter Rams');
    expect(r).toMatchObject({ kind: 'quote', quote: 'Less, but better.', attribution: 'Dieter Rams' });
  });

  it('reads a short first line followed by text as a titled post', () => {
    const r = parseText('A title\n\nSome longer body text follows here.');
    expect(r).toMatchObject({ kind: 'text', title: 'A title', body: 'Some longer body text follows here.' });
  });

  it('honours an explicit "read as" override', () => {
    expect(parseText('Plain sentence.', '', 'quote').kind).toBe('quote');
    expect(parseText('“Quoted”', '', 'post').kind).toBe('text');
  });

  it('strips bullets from list items', () => {
    expect(parseListItems('- one\n* two\n3. three\n\n• four')).toEqual(['one', 'two', 'three', 'four']);
  });
});

describe('excerpt policy', () => {
  it('keeps short excerpts intact', () => {
    expect(makeExcerpt('Short.')).toEqual({ excerpt: 'Short.', trimmed: false });
  });
  it('cuts long excerpts at a sentence boundary and flags them', () => {
    const text = `${'First sentence is here. '.repeat(10)}${'x'.repeat(200)}`;
    const r = makeExcerpt(text, 280);
    expect(r.trimmed).toBe(true);
    expect(r.excerpt.endsWith('.')).toBe(true);
    expect(r.excerpt.length).toBeLessThanOrEqual(280);
  });
});

describe('every adapter produces a valid normalized document', () => {
  const cases = {
    text: withMode('text', { value: 'Hello there, this is a thought.' }),
    quote: withMode('text', { value: '"Stay hungry."', attribution: 'Steve Jobs' }),
    link: { ...withMode('link', { url: 'https://example.com/x', title: 'An article', excerpt: 'Summary.', sourceName: 'Example' }) },
    image: withMode('image', { caption: 'A view' }),
    code: withMode('code', { value: '\tfoo();  \n\n', language: 'auto' }),
    list: withMode('list', { title: 'Facts', value: 'a\nb' }),
  };
  for (const [name, source] of Object.entries(cases)) {
    it(name, () => {
      const content = sourceToContent(source, { upload: { width: 800, height: 600 } });
      const { document, errors } = validateDocument({ schemaVersion: SCHEMA_VERSION, content, design: {} });
      expect(errors).toEqual([]);
      expect(document.content).toEqual(content);
      expect(hasRenderableContent(content)).toBe(true);
    });
  }

  it('preserves code byte-for-byte', () => {
    const code = '\tfoo();  \n\n';
    expect(sourceToContent(withMode('code', { value: code })).body).toBe(code);
  });

  it('image content without an image is not renderable', () => {
    expect(hasRenderableContent(sourceToContent(withMode('image', { caption: 'x' }), {}))).toBe(false);
  });

  it('a failed link keeps the URL as source information', () => {
    const c = sourceToContent(withMode('link', { url: 'example.com/a', status: 'error' }));
    expect(c.sourceUrl).toBe('https://example.com/a');
    expect(c.sourceName).toBe('example.com');
    expect(hasRenderableContent(c)).toBe(false);
  });
});

describe('validation of untrusted state', () => {
  it('normalizes garbage into defaults', () => {
    const { document, errors } = validateDocument({ schemaVersion: 99, content: { kind: 'evil', items: 'x', sourceUrl: 'javascript:1' }, design: { paletteId: 'nope', custom: { width: 1e9, height: 5 } } });
    expect(errors.length).toBe(1);
    expect(document.content.kind).toBe('text');
    expect(document.content.items).toEqual([]);
    expect(document.content.sourceUrl).toBeNull();
    expect(document.design.paletteId).toBe('warm-paper');
    expect(document.design.custom).toEqual({ width: 1080, height: 1080 });
  });

  it('drops malformed image references', () => {
    expect(normalizeContent({ kind: 'image', image: { assetId: 'a', width: 0, height: 10 } }).image).toBeNull();
  });

  it('normalizeSource discards wrong types and resets in-flight fetches', () => {
    const s = normalizeSource({ mode: 'link', link: { url: 5, status: 'loading', title: 'ok' } });
    expect(s.link.url).toBe('');
    expect(s.link.title).toBe('ok');
    expect(s.link.status).toBe('idle');
  });

  it('normalizeDesign keeps valid settings', () => {
    expect(normalizeDesign({ paletteId: 'ink', outputPresetId: 'custom', custom: { width: 2000, height: 1000 } })).toMatchObject({ paletteId: 'ink', outputPresetId: 'custom', custom: { width: 2000, height: 1000 } });
  });
});
