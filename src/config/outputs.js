// Platforms group presets in the Size control. Dimensions follow each
// platform's recommended upload sizes; ratios beyond 1:3 (banners, headers)
// are left out because no layout composes well that wide.
export const PLATFORMS = [
  { id: 'common', label: 'Common' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'x', label: 'X' },
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'threads', label: 'Threads' },
  { id: 'bluesky', label: 'Bluesky' },
  { id: 'pinterest', label: 'Pinterest' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'web', label: 'Web' },
];

export const OUTPUT_PRESETS = [
  { id: 'square', platform: 'common', label: 'Square', width: 1080, height: 1080 },
  { id: 'portrait', platform: 'common', label: 'Portrait', width: 1080, height: 1350 },
  { id: 'story', platform: 'common', label: 'Story', width: 1080, height: 1920 },
  { id: 'landscape', platform: 'common', label: 'Landscape', width: 1200, height: 675 },

  { id: 'ig-square', platform: 'instagram', label: 'Square post', width: 1080, height: 1080 },
  { id: 'ig-portrait', platform: 'instagram', label: 'Portrait post', width: 1080, height: 1350 },
  { id: 'ig-story', platform: 'instagram', label: 'Story & Reels', width: 1080, height: 1920 },
  { id: 'ig-landscape', platform: 'instagram', label: 'Landscape post', width: 1080, height: 566 },

  { id: 'tt-cover', platform: 'tiktok', label: 'Photo & cover', width: 1080, height: 1920 },

  { id: 'x-post', platform: 'x', label: 'Post', width: 1600, height: 900 },
  { id: 'x-square', platform: 'x', label: 'Square', width: 1200, height: 1200 },
  { id: 'x-portrait', platform: 'x', label: 'Portrait', width: 1080, height: 1350 },

  { id: 'li-post', platform: 'linkedin', label: 'Landscape post', width: 1200, height: 627 },
  { id: 'li-square', platform: 'linkedin', label: 'Square post', width: 1200, height: 1200 },
  { id: 'li-portrait', platform: 'linkedin', label: 'Portrait post', width: 1080, height: 1350 },

  { id: 'fb-post', platform: 'facebook', label: 'Landscape post', width: 1200, height: 630 },
  { id: 'fb-square', platform: 'facebook', label: 'Square post', width: 1080, height: 1080 },
  { id: 'fb-portrait', platform: 'facebook', label: 'Portrait post', width: 1080, height: 1350 },
  { id: 'fb-story', platform: 'facebook', label: 'Story', width: 1080, height: 1920 },

  { id: 'th-portrait', platform: 'threads', label: 'Portrait post', width: 1080, height: 1350 },
  { id: 'th-square', platform: 'threads', label: 'Square post', width: 1080, height: 1080 },

  { id: 'bs-landscape', platform: 'bluesky', label: 'Landscape post', width: 1600, height: 900 },
  { id: 'bs-square', platform: 'bluesky', label: 'Square post', width: 1200, height: 1200 },

  { id: 'pin-standard', platform: 'pinterest', label: 'Standard pin', width: 1000, height: 1500 },
  { id: 'pin-square', platform: 'pinterest', label: 'Square pin', width: 1000, height: 1000 },

  { id: 'yt-thumbnail', platform: 'youtube', label: 'Thumbnail', width: 1280, height: 720 },
  { id: 'yt-post', platform: 'youtube', label: 'Community post', width: 1080, height: 1080 },

  { id: 'og-image', platform: 'web', label: 'Link preview (Open Graph)', width: 1200, height: 630 },
  { id: 'web-hero', platform: 'web', label: 'Blog header', width: 1600, height: 840 },
];

export const getPreset = (id) => OUTPUT_PRESETS.find((p) => p.id === id) ?? null;
export const platformLabel = (id) => PLATFORMS.find((p) => p.id === id)?.label ?? '';

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
    if (v.ok) return { id: 'custom', platform: 'common', label: 'Custom', name: 'Custom', width: v.width, height: v.height };
  }
  const preset = getPreset(design.outputPresetId) ?? OUTPUT_PRESETS[1];
  // Display name, e.g. "Instagram · Story & Reels" (common presets stay bare).
  const name = preset.platform === 'common' ? preset.label : `${platformLabel(preset.platform)} · ${preset.label}`;
  return { ...preset, name };
}
