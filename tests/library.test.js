import { describe, it, expect } from 'vitest';
import { normalizeLibrary, paletteChecks, LIBRARY_LIMIT } from '../src/model/library.js';
import { buildFontPair, FAMILIES, getFontPair } from '../src/config/typography.js';
import { getPalette } from '../src/config/palettes.js';
import { normalizeDesign, normalizeContent, defaultDesign } from '../src/model/document.js';
import { composeCard } from '../src/engine/compose.js';
import { mockEnv } from './helpers.js';
import { FACES } from '../src/render/fonts.js';
import { FONT_PAIRS } from '../src/config/typography.js';

const roles = { canvas: '#1F3D2B', surface: '#16243A', text: '#E6ECF5', mutedText: '#8D9BB0', accent: '#E8B04B', divider: '#26364F' };
const palette = { id: 'custom-forest', label: 'Forest', roles };
const pairSpec = { id: 'customfont-a', label: 'Mine', spec: { display: 'space-grotesk', text: 'plex-sans', code: 'plex-mono' } };

describe('library validation', () => {
  it('keeps valid entries and rebuilds pairings from their spec', () => {
    const lib = normalizeLibrary({ palettes: [palette], fontPairs: [pairSpec] });
    expect(lib.palettes[0]).toMatchObject({ id: 'custom-forest', label: 'Forest', custom: true });
    expect(lib.fontPairs[0].display.family).toBe('Carrd Space Grotesk');
    expect(lib.fontPairs[0].mono.family).toBe('Carrd Plex Mono');
  });

  it('drops malformed entries', () => {
    const lib = normalizeLibrary({
      palettes: [{ ...palette, roles: { ...roles, text: 'red' } }, { ...palette, id: 'warm-paper' }, 'x'],
      fontPairs: [{ ...pairSpec, spec: { display: 'comic-sans', text: 'inter', code: 'plex-mono' } }, { ...pairSpec, spec: { ...pairSpec.spec, code: 'inter' } }],
    });
    expect(lib).toEqual({ palettes: [], fontPairs: [] });
  });

  it('dedupes, trims names and caps the count', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...palette, id: `custom-${i}`, label: `  ${'n'.repeat(40)}  ` }));
    const lib = normalizeLibrary({ palettes: [...many, many[0]] });
    expect(lib.palettes).toHaveLength(LIBRARY_LIMIT);
    expect(lib.palettes[0].label).toHaveLength(24);
  });

  it('flags low-contrast palettes', () => {
    const checks = paletteChecks({ ...roles, text: '#2A4A35' });
    expect(checks.find((c) => c.label === 'Text on canvas').ok).toBe(false);
    expect(paletteChecks(roles).every((c) => c.ok)).toBe(true);
  });
});

describe('pairing builder', () => {
  it('only references bundled weights for every family combination', () => {
    const bundled = new Set(FACES.map(([family, weight, style]) => `${family}/${weight}/${style}`));
    for (const d of FAMILIES) {
      for (const t of FAMILIES) {
        const p = buildFontPair({ id: 'customfont-x', label: 'x', display: d.id, text: t.id, code: 'jetbrains-mono' });
        for (const face of [p.display, p.quote, p.text, p.meta, p.mono]) {
          expect(bundled.has(`${face.family}/${face.weight}/${face.style ?? 'normal'}`), `${d.id}+${t.id}: ${face.family} ${face.weight}`).toBe(true);
        }
      }
    }
  });
});

describe('built-in pairings', () => {
  it('only use bundled faces', () => {
    const bundled = new Set(FACES.map(([family, weight, style]) => `${family}/${weight}/${style}`));
    for (const p of FONT_PAIRS) {
      for (const face of [p.display, p.quote, p.text, p.meta, p.mono]) {
        expect(bundled.has(`${face.family}/${face.weight}/${face.style ?? 'normal'}`), `${p.id}: ${face.family} ${face.weight}`).toBe(true);
      }
    }
  });
});

describe('custom styles in the engine', () => {
  const lib = normalizeLibrary({ palettes: [palette], fontPairs: [pairSpec] });

  it('lookups resolve custom ids and fall back for unknown ones', () => {
    expect(getPalette('custom-forest', lib.palettes).label).toBe('Forest');
    expect(getPalette('custom-gone', lib.palettes).id).toBe('warm-paper');
    expect(getFontPair('customfont-a', lib.fontPairs).label).toBe('Mine');
  });

  it('normalizeDesign accepts custom ids only when they exist', () => {
    const ids = { paletteIds: ['custom-forest'], fontPairIds: ['customfont-a'] };
    expect(normalizeDesign({ paletteId: 'custom-forest', fontPairId: 'customfont-a' }, ids)).toMatchObject({ paletteId: 'custom-forest', fontPairId: 'customfont-a' });
    expect(normalizeDesign({ paletteId: 'custom-forest' }).paletteId).toBe('warm-paper');
  });

  it('composes with custom colours and fonts', () => {
    const env = { ...mockEnv(), palettes: lib.palettes, fontPairs: lib.fontPairs };
    const content = normalizeContent({ kind: 'quote', quote: 'Less, but better.', attribution: 'Dieter Rams' });
    const s = composeCard({ content, design: { ...defaultDesign(), layoutId: 'centered', paletteId: 'custom-forest', fontPairId: 'customfont-a' } }, env);
    expect(s.ops[0].fill).toBe('#1F3D2B');
    expect(s.ops.some((o) => o.type === 'text' && o.face.family === 'Carrd Space Grotesk')).toBe(true);
  });
});
