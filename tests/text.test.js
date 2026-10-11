import { describe, it, expect } from 'vitest';
import { wrapText, wrapBalanced, fitStack, layoutText } from '../src/engine/text.js';
import { mockEnv } from './helpers.js';

const widthOf = (s) => s.length * 10;
const face = { family: 'Carrd Inter', weight: 400 };

describe('wrapping', () => {
  it('wraps on word boundaries', () => {
    expect(wrapText('aaa bbb ccc', 70, widthOf)).toEqual(['aaa bbb', 'ccc']);
  });
  it('breaks words longer than a line instead of overflowing', () => {
    const lines = wrapText('abcdefghijkl', 50, widthOf);
    expect(lines.join('')).toBe('abcdefghijkl');
    expect(lines.every((l) => widthOf(l) <= 50)).toBe(true);
  });
  it('keeps paragraph breaks as a single blank line', () => {
    expect(wrapText('a\n\n\n\nb', 100, widthOf)).toEqual(['a', '', 'b']);
  });
  it('balanced wrap keeps the line count but evens lines', () => {
    const text = 'one two three four five six seven';
    const greedy = wrapText(text, 200, widthOf);
    const bal = wrapBalanced(text, 200, widthOf);
    expect(bal.length).toBe(greedy.length);
    const spread = (ls) => Math.max(...ls.map(widthOf)) - Math.min(...ls.map(widthOf));
    expect(spread(bal)).toBeLessThanOrEqual(spread(greedy));
  });
});

describe('fitting', () => {
  const env = mockEnv();
  it('uses the largest size when there is room', () => {
    const r = fitStack(env, [{ key: 'a', text: 'Hi', face, min: 20, max: 80, lineHeight: 1.2, width: 1000 }], 1000);
    expect(r.fits).toBe(true);
    expect(r.items.a.size).toBe(80);
  });
  it('shrinks within the readable range to fit', () => {
    const text = 'word '.repeat(60);
    const r = fitStack(env, [{ key: 'a', text, face, min: 20, max: 80, lineHeight: 1.2, width: 600 }], 400);
    expect(r.fits).toBe(true);
    expect(r.items.a.size).toBeGreaterThanOrEqual(20);
    expect(r.items.a.size).toBeLessThan(80);
    expect(r.height).toBeLessThanOrEqual(400);
  });
  it('never goes below the minimum size; reports overflow instead', () => {
    const text = 'word '.repeat(2000);
    const r = fitStack(env, [{ key: 'a', text, face, min: 20, max: 80, lineHeight: 1.2, width: 600 }], 400);
    expect(r.fits).toBe(false);
    expect(r.items.a.size).toBe(20);
    expect(r.need).toBeGreaterThan(1);
  });
  it('layoutText never drops words', () => {
    const text = 'The quick brown fox jumps over the lazy dog';
    const lay = layoutText(env, { text, face, size: 40, lineHeight: 1.2, width: 300 });
    expect(lay.lines.join(' ')).toBe(text);
  });
});
