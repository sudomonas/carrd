// Deterministic stand-in for canvas measureText: average glyph widths per
// face style, close enough to real fonts to exercise wrapping and fitting.
export const mockEnv = (images = {}) => ({
  measure: (face, size, text) => {
    const per = /Mono/.test(face.family) ? 0.6 : face.weight >= 600 ? 0.56 : 0.5;
    return text.length * size * per;
  },
  images,
});

export function lumaGrid(value, cols = 4, rows = 4) {
  return { cols, rows, values: new Array(cols * rows).fill(value) };
}
