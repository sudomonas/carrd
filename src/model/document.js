// The normalized document: content and design are kept strictly separate.
// Binary image data never lives here — images are referenced by asset id.
import { PALETTES, DEFAULT_PALETTE_ID } from '../config/palettes.js';
import { FONT_PAIRS, DEFAULT_FONT_PAIR_ID } from '../config/typography.js';
import { BACKGROUNDS, DEFAULT_BACKGROUND_ID } from '../config/backgrounds.js';
import { OUTPUT_PRESETS, DEFAULT_OUTPUT_ID, validateCustomSize } from '../config/outputs.js';

export const SCHEMA_VERSION = 1;
export const CONTENT_KINDS = ['article', 'text', 'quote', 'image', 'code', 'list'];
export const LAYOUT_IDS = ['editorial', 'centered', 'cinematic', 'headline', 'code', 'list'];

export function emptyContent() {
  return {
    kind: 'text',
    title: '',
    body: '',
    quote: '',
    attribution: null,
    author: null,
    sourceName: null,
    sourceUrl: null,
    image: null,
    codeLanguage: null,
    items: [],
  };
}

export function defaultDesign() {
  return {
    layoutId: 'editorial',
    // false while the layout is chosen automatically; true once the user picks one.
    layoutLocked: false,
    paletteId: DEFAULT_PALETTE_ID,
    fontPairId: DEFAULT_FONT_PAIR_ID,
    backgroundId: DEFAULT_BACKGROUND_ID,
    outputPresetId: DEFAULT_OUTPUT_ID,
    custom: { width: 1080, height: 1080 },
  };
}

const str = (v) => (typeof v === 'string' ? v : '');
const optStr = (v) => {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t : null;
};

function normalizeImage(img) {
  if (!img || typeof img !== 'object') return null;
  const { assetId, width, height } = img;
  if (typeof assetId !== 'string' || !assetId) return null;
  if (!(width > 0) || !(height > 0)) return null;
  return { assetId, width: Math.round(width), height: Math.round(height), alt: str(img.alt) };
}

export function normalizeSourceUrl(v) {
  const s = optStr(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

export function normalizeContent(raw = {}) {
  const c = raw && typeof raw === 'object' ? raw : {};
  const kind = CONTENT_KINDS.includes(c.kind) ? c.kind : 'text';
  return {
    kind,
    title: str(c.title).trim(),
    // Code bodies are preserved byte-for-byte; other bodies are trimmed.
    body: kind === 'code' ? str(c.body) : str(c.body).trim(),
    quote: str(c.quote).trim(),
    attribution: optStr(c.attribution),
    author: optStr(c.author),
    sourceName: optStr(c.sourceName),
    sourceUrl: normalizeSourceUrl(c.sourceUrl),
    image: normalizeImage(c.image),
    codeLanguage: optStr(c.codeLanguage),
    items: Array.isArray(c.items) ? c.items.map((i) => str(i).trim()).filter(Boolean) : [],
  };
}

const ids = (list) => list.map((x) => x.id);

/**
 * `library` lists ids of the user's own palettes and pairings, which are valid
 * selections in addition to the built-ins.
 */
export function normalizeDesign(raw = {}, library = { paletteIds: [], fontPairIds: [] }) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const base = defaultDesign();
  const pick = (value, allowed, fallback) => (allowed.includes(value) ? value : fallback);
  const custom = validateCustomSize(d.custom?.width, d.custom?.height);
  return {
    layoutId: pick(d.layoutId, LAYOUT_IDS, base.layoutId),
    layoutLocked: d.layoutLocked === true,
    paletteId: pick(d.paletteId, [...ids(PALETTES), ...library.paletteIds], base.paletteId),
    fontPairId: pick(d.fontPairId, [...ids(FONT_PAIRS), ...library.fontPairIds], base.fontPairId),
    backgroundId: pick(d.backgroundId, ids(BACKGROUNDS), base.backgroundId),
    outputPresetId: pick(d.outputPresetId, [...ids(OUTPUT_PRESETS), 'custom'], DEFAULT_OUTPUT_ID),
    custom: custom.ok ? { width: custom.width, height: custom.height } : base.custom,
  };
}

/** Validates and normalizes an untrusted document (e.g. from storage). */
export function validateDocument(raw) {
  const errors = [];
  if (!raw || typeof raw !== 'object') {
    errors.push('Document is not an object.');
    raw = {};
  } else if (raw.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`Unsupported schema version: ${raw.schemaVersion}`);
  }
  return {
    document: {
      schemaVersion: SCHEMA_VERSION,
      content: normalizeContent(raw.content),
      design: normalizeDesign(raw.design),
    },
    errors,
  };
}

/** Whether the content has enough substance to compose a card. */
export function hasRenderableContent(c) {
  switch (c.kind) {
    case 'quote':
      return Boolean(c.quote);
    case 'image':
      return Boolean(c.image);
    case 'code':
      return c.body.trim().length > 0;
    case 'list':
      return c.items.length > 0;
    case 'article':
      return Boolean(c.title || c.body);
    default:
      return Boolean(c.title || c.body);
  }
}

/** Visible character count used for layout scoring. */
export function contentTextLength(c) {
  if (c.kind === 'quote') return c.quote.length;
  if (c.kind === 'list') return c.title.length + c.items.join(' ').length;
  return c.title.length + c.body.length;
}
