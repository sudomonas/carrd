// Colour math for contrast-aware treatments (WCAG relative luminance).

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
}

const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function luminanceRgb([r, g, b]) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export const luminance = (hex) => luminanceRgb(hexToRgb(hex));

export function contrastLum(l1, l2) {
  const [a, b] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
}

export const contrast = (hexA, hexB) => contrastLum(luminance(hexA), luminance(hexB));

/** Mixes two hex colours; t = 0 gives a, t = 1 gives b. */
export function mix(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(ca.map((v, i) => v + (cb[i] - v) * t));
}

export function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
}

/** Grey sRGB value whose luminance equals `l` (used to model photo pixels). */
export function greyForLuminance(l) {
  const c = l <= 0.03928 / 12.92 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  const v = Math.round(c * 255);
  return [v, v, v];
}

/**
 * Smallest overlay alpha (in 0.05 steps) at which `textHex` reaches `target`
 * contrast over an overlay of `overlayHex` blended onto both the darkest and
 * lightest pixels of the photo region (lumMin..lumMax).
 */
export function solveOverlayAlpha(textHex, overlayHex, lumMin, lumMax, target = 4.5) {
  const text = luminance(textHex);
  const over = hexToRgb(overlayHex);
  for (let a = 0; a <= 1.0001; a += 0.05) {
    const ok = [lumMin, lumMax].every((l) => {
      const px = greyForLuminance(l);
      const blended = px.map((v, i) => v * (1 - a) + over[i] * a);
      return contrastLum(text, luminanceRgb(blended)) >= target;
    });
    if (ok) return Math.round(a * 100) / 100;
  }
  return 1;
}
