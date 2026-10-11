export const OUTPUT_PRESETS = [
  { id: 'square', label: 'Square', width: 1080, height: 1080 },
  { id: 'portrait', label: 'Portrait', width: 1080, height: 1350 },
  { id: 'story', label: 'Story', width: 1080, height: 1920 },
  { id: 'landscape', label: 'Landscape', width: 1200, height: 675 },
];

export const DEFAULT_OUTPUT_ID = 'portrait';

// Custom-size limits. The area cap stays below the 16.7 MP canvas ceiling of
// iOS Safari so exports cannot fail silently on mobile.
export const CUSTOM_LIMITS = {
  minSide: 320,
  maxSide: 4096,
  maxArea: 12_000_000,
  maxAspect: 3, // longest side / shortest side
};

/** Returns { ok: true, width, height } or { ok: false, error }. */
export function validateCustomSize(width, height) {
  const w = Number(width);
  const h = Number(height);
  const { minSide, maxSide, maxArea, maxAspect } = CUSTOM_LIMITS;
  if (!Number.isInteger(w) || !Number.isInteger(h)) {
    return { ok: false, error: 'Use whole numbers for width and height.' };
  }
  if (w < minSide || h < minSide) return { ok: false, error: `Each side must be at least ${minSide} px.` };
  if (w > maxSide || h > maxSide) return { ok: false, error: `Each side must be at most ${maxSide} px.` };
  if (w * h > maxArea) return { ok: false, error: `That is ${(w * h / 1e6).toFixed(1)} MP; the limit is ${maxArea / 1e6} MP.` };
  if (Math.max(w, h) / Math.min(w, h) > maxAspect) {
    return { ok: false, error: `Aspect ratio can be at most ${maxAspect}:1.` };
  }
  return { ok: true, width: w, height: h };
}

/** Resolves the design's output setting into concrete pixel dimensions. */
export function resolveOutput(design) {
  if (design.outputPresetId === 'custom' && design.custom) {
    const v = validateCustomSize(design.custom.width, design.custom.height);
    if (v.ok) return { id: 'custom', label: 'Custom', width: v.width, height: v.height };
  }
  const preset = OUTPUT_PRESETS.find((p) => p.id === design.outputPresetId) ?? OUTPUT_PRESETS[1];
  return { ...preset };
}
