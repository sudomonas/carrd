import { fontString } from '../config/typography.js';

/** Canvas-backed text measurement with a bounded cache. */
export function createMeasure() {
  const ctx = document.createElement('canvas').getContext('2d');
  const cache = new Map();
  return (face, size, text) => {
    const font = fontString(face, size);
    const key = `${font}|${text}`;
    let w = cache.get(key);
    if (w === undefined) {
      ctx.font = font;
      w = ctx.measureText(text).width;
      if (cache.size > 50000) cache.clear();
      cache.set(key, w);
    }
    return w;
  };
}
