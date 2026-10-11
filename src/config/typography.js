// Curated font pairings. Families are bundled (see src/render/fonts.js); the
// "Carrd " prefix keeps them distinct from any identically named system font so
// measurement and drawing always resolve to the same file.
// The composition engine owns exact sizes; `scale` nudges a pairing's optical size.
const INTER = 'Carrd Inter';
const SERIF = 'Carrd Source Serif';
const FRAUNCES = 'Carrd Fraunces';
const GROTESK = 'Carrd Space Grotesk';
const PLEX = 'Carrd Plex Sans';
const PLEX_MONO = 'Carrd Plex Mono';
const JB_MONO = 'Carrd JetBrains Mono';

export const SANS_FALLBACK = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
export const SERIF_FALLBACK = 'Georgia, "Times New Roman", serif';
export const MONO_FALLBACK = 'ui-monospace, Menlo, Consolas, monospace';

export const FONT_PAIRS = [
  {
    id: 'literary',
    label: 'Literary',
    note: 'Serif headline, serif text',
    display: { family: SERIF, fallback: SERIF_FALLBACK, weight: 600 },
    quote: { family: SERIF, fallback: SERIF_FALLBACK, weight: 400, style: 'italic' },
    text: { family: SERIF, fallback: SERIF_FALLBACK, weight: 400 },
    meta: { family: INTER, fallback: SANS_FALLBACK, weight: 600, tracking: 0.12, uppercase: true },
    mono: { family: JB_MONO, fallback: MONO_FALLBACK, weight: 400 },
    lineHeight: { display: 1.12, text: 1.42 },
    scale: { display: 1, text: 1.04 },
  },
  {
    id: 'editorial',
    label: 'Editorial',
    note: 'Display serif with sans text',
    display: { family: FRAUNCES, fallback: SERIF_FALLBACK, weight: 600 },
    quote: { family: FRAUNCES, fallback: SERIF_FALLBACK, weight: 400, style: 'italic' },
    text: { family: INTER, fallback: SANS_FALLBACK, weight: 400 },
    meta: { family: INTER, fallback: SANS_FALLBACK, weight: 600, tracking: 0.12, uppercase: true },
    mono: { family: JB_MONO, fallback: MONO_FALLBACK, weight: 400 },
    lineHeight: { display: 1.08, text: 1.45 },
    scale: { display: 1, text: 0.96 },
  },
  {
    id: 'neutral',
    label: 'Neutral',
    note: 'Clean sans throughout',
    display: { family: INTER, fallback: SANS_FALLBACK, weight: 700 },
    quote: { family: INTER, fallback: SANS_FALLBACK, weight: 500 },
    text: { family: INTER, fallback: SANS_FALLBACK, weight: 400 },
    meta: { family: INTER, fallback: SANS_FALLBACK, weight: 600, tracking: 0.1, uppercase: true },
    mono: { family: JB_MONO, fallback: MONO_FALLBACK, weight: 400 },
    lineHeight: { display: 1.1, text: 1.45 },
    scale: { display: 0.94, text: 0.96 },
  },
  {
    id: 'modern',
    label: 'Modern',
    note: 'Geometric display sans',
    display: { family: GROTESK, fallback: SANS_FALLBACK, weight: 600 },
    quote: { family: GROTESK, fallback: SANS_FALLBACK, weight: 500 },
    text: { family: INTER, fallback: SANS_FALLBACK, weight: 400 },
    meta: { family: GROTESK, fallback: SANS_FALLBACK, weight: 500, tracking: 0.08, uppercase: true },
    mono: { family: JB_MONO, fallback: MONO_FALLBACK, weight: 400 },
    lineHeight: { display: 1.06, text: 1.45 },
    scale: { display: 1, text: 0.96 },
  },
  {
    id: 'technical',
    label: 'Technical',
    note: 'Plex sans with mono details',
    display: { family: PLEX, fallback: SANS_FALLBACK, weight: 600 },
    quote: { family: PLEX, fallback: SANS_FALLBACK, weight: 400, style: 'italic' },
    text: { family: PLEX, fallback: SANS_FALLBACK, weight: 400 },
    meta: { family: PLEX_MONO, fallback: MONO_FALLBACK, weight: 500, tracking: 0.04, uppercase: true },
    mono: { family: PLEX_MONO, fallback: MONO_FALLBACK, weight: 400 },
    lineHeight: { display: 1.12, text: 1.45 },
    scale: { display: 0.96, text: 0.96 },
  },
  {
    id: 'monospace',
    label: 'Monospace',
    note: 'Mono everything',
    display: { family: JB_MONO, fallback: MONO_FALLBACK, weight: 700 },
    quote: { family: JB_MONO, fallback: MONO_FALLBACK, weight: 400 },
    text: { family: JB_MONO, fallback: MONO_FALLBACK, weight: 400 },
    meta: { family: JB_MONO, fallback: MONO_FALLBACK, weight: 500, tracking: 0.04, uppercase: true },
    mono: { family: JB_MONO, fallback: MONO_FALLBACK, weight: 400 },
    lineHeight: { display: 1.14, text: 1.5 },
    scale: { display: 0.84, text: 0.86 },
  },
];

export const DEFAULT_FONT_PAIR_ID = 'literary';

/** Looks up a pairing among the built-ins and any user-made pairings. */
export function getFontPair(id, custom = []) {
  return FONT_PAIRS.find((f) => f.id === id) ?? custom.find((f) => f.id === id) ?? FONT_PAIRS[0];
}

// Families available for custom pairings, with the weights that are bundled
// for each role (see src/render/fonts.js — every face referenced here is loaded).
export const FAMILIES = [
  { id: 'source-serif', label: 'Source Serif', family: SERIF, fallback: SERIF_FALLBACK, category: 'Serif', display: 600, quote: [400, 'italic'], meta: 600 },
  { id: 'fraunces', label: 'Fraunces', family: FRAUNCES, fallback: SERIF_FALLBACK, category: 'Serif', display: 600, quote: [400, 'italic'], meta: 600 },
  { id: 'inter', label: 'Inter', family: INTER, fallback: SANS_FALLBACK, category: 'Sans', display: 700, quote: [500, 'normal'], meta: 600 },
  { id: 'space-grotesk', label: 'Space Grotesk', family: GROTESK, fallback: SANS_FALLBACK, category: 'Sans', display: 600, quote: [500, 'normal'], meta: 500 },
  { id: 'plex-sans', label: 'IBM Plex Sans', family: PLEX, fallback: SANS_FALLBACK, category: 'Sans', display: 600, quote: [400, 'italic'], meta: 600 },
  { id: 'plex-mono', label: 'IBM Plex Mono', family: PLEX_MONO, fallback: MONO_FALLBACK, category: 'Mono', display: 500, quote: [400, 'normal'], meta: 500 },
  { id: 'jetbrains-mono', label: 'JetBrains Mono', family: JB_MONO, fallback: MONO_FALLBACK, category: 'Mono', display: 700, quote: [400, 'italic'], meta: 500 },
];

export const CODE_FAMILIES = FAMILIES.filter((f) => f.category === 'Mono');

export const getFamily = (id) => FAMILIES.find((f) => f.id === id) ?? null;

/**
 * Builds a full pairing from a user's choice of headline, body and code
 * families. Weights, line heights and scale come from the catalogue, so the
 * composition engine keeps control of sizing.
 */
export function buildFontPair({ id, label, display, text, code }) {
  const d = getFamily(display) ?? FAMILIES[0];
  const t = getFamily(text) ?? FAMILIES[2];
  const c = getFamily(code)?.category === 'Mono' ? getFamily(code) : getFamily('jetbrains-mono');
  const mono = (f) => f.category === 'Mono';
  return {
    id,
    label,
    custom: true,
    spec: { display: d.id, text: t.id, code: c.id },
    note: `${d.label} + ${t.label}`,
    display: { family: d.family, fallback: d.fallback, weight: d.display },
    quote: { family: d.family, fallback: d.fallback, weight: d.quote[0], style: d.quote[1] },
    text: { family: t.family, fallback: t.fallback, weight: 400 },
    meta: { family: t.family, fallback: t.fallback, weight: t.meta, tracking: mono(t) ? 0.04 : 0.1, uppercase: true },
    mono: { family: c.family, fallback: c.fallback, weight: 400 },
    lineHeight: { display: d.category === 'Serif' ? 1.1 : 1.08, text: mono(t) ? 1.5 : 1.45 },
    scale: { display: mono(d) ? 0.84 : d.category === 'Sans' ? 0.96 : 1, text: mono(t) ? 0.86 : 0.98 },
  };
}

/** CSS / canvas font shorthand for a face at a pixel size. */
export function fontString(face, size) {
  const style = face.style === 'italic' ? 'italic ' : '';
  return `${style}${face.weight ?? 400} ${size}px "${face.family}", ${face.fallback}`;
}
