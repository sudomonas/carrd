import { describe, it, expect, vi } from 'vitest';
import { exportCard, sanitizeFilename, ExportError } from '../src/render/export.js';
import { normalizeContent, defaultDesign } from '../src/model/document.js';
import { validateCustomSize, resolveOutput, OUTPUT_PRESETS } from '../src/config/outputs.js';
import { mockEnv } from './helpers.js';

// Minimal canvas double: records size and returns a blob.
function fakeCanvasFactory(log) {
  return (width, height) => {
    const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })), set: (t, k, v) => ((t[k] = v), true) });
    const canvas = { width, height, getContext: () => ctx, toBlob: (cb, type) => cb(new Blob(['x'], { type })) };
    log.push(canvas);
    return canvas;
  };
}

const content = normalizeContent({ kind: 'article', title: 'Hello, Wörld! / ../etc', body: 'Body text.' });

describe('filenames', () => {
  it('sanitizes titles into safe slugs', () => {
    expect(sanitizeFilename('Hello, Wörld! / ../etc', 1080, 1350, 'png')).toBe('hello-world-etc-1080x1350.png');
    expect(sanitizeFilename('', 10, 10, 'jpg')).toBe('carrd-card-10x10.jpg');
    expect(sanitizeFilename('日本語', 1, 1, 'png')).toBe('carrd-card-1x1.png');
    expect(sanitizeFilename('a'.repeat(200), 1, 1, 'png').length).toBeLessThan(80);
  });
});

describe('custom dimensions', () => {
  it('accepts valid and rejects invalid sizes', () => {
    expect(validateCustomSize(2000, 1000).ok).toBe(true);
    expect(validateCustomSize(100, 1000).ok).toBe(false);
    expect(validateCustomSize(5000, 1000).ok).toBe(false);
    expect(validateCustomSize(4000, 4000).ok).toBe(false); // area
    expect(validateCustomSize(3600, 1000).ok).toBe(false); // aspect
    expect(validateCustomSize(1000.5, 1000).ok).toBe(false);
  });
  it('invalid custom settings fall back to a preset', () => {
    expect(resolveOutput({ outputPresetId: 'custom', custom: { width: 1, height: 1 } }).id).toBe('portrait');
  });
});

describe('export pipeline', () => {
  const sizes = [...OUTPUT_PRESETS.map((p) => ({ outputPresetId: p.id, w: p.width, h: p.height })), { outputPresetId: 'custom', custom: { width: 1600, height: 900 }, w: 1600, h: 900 }];
  for (const s of sizes) {
    it(`renders ${s.outputPresetId} at exactly ${s.w}×${s.h}`, async () => {
      const canvases = [];
      const download = vi.fn();
      const design = { ...defaultDesign(), layoutId: 'editorial', ...s };
      const r = await exportCard({ content, design }, 'png', { env: mockEnv(), createCanvas: fakeCanvasFactory(canvases), download });
      expect([r.width, r.height]).toEqual([s.w, s.h]);
      expect([canvases[0].width, canvases[0].height]).toEqual([s.w, s.h]);
      expect(download).toHaveBeenCalledWith(expect.any(Blob), `hello-world-etc-${s.w}x${s.h}.png`);
    });
  }

  it('waits for fonts and images before composing', async () => {
    const order = [];
    await exportCard({ content, design: defaultDesign() }, 'jpeg', {
      env: mockEnv(),
      ensureFonts: async () => order.push('fonts'),
      ensureImages: async () => order.push('images'),
      createCanvas: (w, h) => { order.push('canvas'); return fakeCanvasFactory([])(w, h); },
      download: () => order.push('download'),
    });
    expect(order).toEqual(['fonts', 'images', 'canvas', 'download']);
  });

  it('refuses to export overflowing content and leaves the document intact', async () => {
    const big = normalizeContent({ kind: 'text', title: 'Essay', body: 'words '.repeat(4000) });
    const d = { content: big, design: { ...defaultDesign(), outputPresetId: 'landscape' } };
    const snapshot = JSON.stringify(d);
    await expect(exportCard(d, 'png', { env: mockEnv(), createCanvas: fakeCanvasFactory([]), download: () => {} })).rejects.toMatchObject({ code: 'overflow' });
    expect(JSON.stringify(d)).toBe(snapshot);
  });

  it('fails clearly when an image element is missing', async () => {
    const c = normalizeContent({ kind: 'image', image: { assetId: 'upload', width: 100, height: 100 } });
    await expect(exportCard({ content: c, design: { ...defaultDesign(), layoutId: 'cinematic' } }, 'png', { env: mockEnv(), images: {}, createCanvas: fakeCanvasFactory([]), download: () => {} })).rejects.toBeInstanceOf(ExportError);
  });

  it('reports encoding failures', async () => {
    const createCanvas = (w, h) => ({ ...fakeCanvasFactory([])(w, h), toBlob: (cb) => cb(null) });
    await expect(exportCard({ content, design: defaultDesign() }, 'png', { env: mockEnv(), createCanvas, download: () => {} })).rejects.toMatchObject({ code: 'encode' });
  });
});
