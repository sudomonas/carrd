// The user's own palettes and font pairings ("library"). Stored in
// localStorage, validated on load, and resolved by id like the built-ins.
import { PALETTE_ROLES } from '../config/palettes.js';
import { FAMILIES, buildFontPair, getFamily } from '../config/typography.js';
import { contrast } from '../engine/color.js';

const KEY = 'carrd:v1:library';
export const LIBRARY_LIMIT = 12;
export const NAME_LIMIT = 24;
const HEX = /^#[0-9a-f]{6}$/i;

export const emptyLibrary = () => ({ palettes: [], fontPairs: [] });

export function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const cleanName = (name, fallback) => (typeof name === 'string' && name.trim() ? name.trim().slice(0, NAME_LIMIT) : fallback);

export function normalizeCustomPalette(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.startsWith('custom-')) return null;
  const roles = {};
  for (const { id } of PALETTE_ROLES) {
    const v = raw.roles?.[id];
    if (typeof v !== 'string' || !HEX.test(v)) return null;
    roles[id] = v.toUpperCase();
  }
  return { id: raw.id, label: cleanName(raw.label, 'My palette'), tone: 'custom', custom: true, roles };
}

export function normalizeCustomFontPair(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id.startsWith('customfont-')) return null;
  const spec = raw.spec ?? {};
  if (!getFamily(spec.display) || !getFamily(spec.text) || getFamily(spec.code)?.category !== 'Mono') return null;
  return buildFontPair({ id: raw.id, label: cleanName(raw.label, 'My pairing'), ...spec });
}

export function normalizeLibrary(raw) {
  const lib = emptyLibrary();
  if (!raw || typeof raw !== 'object') return lib;
  const uniq = (list) => list.filter((x, i, a) => x && a.findIndex((y) => y.id === x.id) === i).slice(0, LIBRARY_LIMIT);
  lib.palettes = uniq((Array.isArray(raw.palettes) ? raw.palettes : []).map(normalizeCustomPalette));
  lib.fontPairs = uniq((Array.isArray(raw.fontPairs) ? raw.fontPairs : []).map(normalizeCustomFontPair));
  return lib;
}

export function readLibrary() {
  try {
    return normalizeLibrary(JSON.parse(localStorage.getItem(KEY) ?? 'null'));
  } catch {
    return emptyLibrary();
  }
}

/** Persists only what's needed to rebuild entries. Returns an Error or null. */
export function writeLibrary(lib) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      palettes: lib.palettes.map(({ id, label, roles }) => ({ id, label, roles })),
      fontPairs: lib.fontPairs.map(({ id, label, spec }) => ({ id, label, spec })),
    }));
    return null;
  } catch (e) {
    return e;
  }
}

/**
 * Readability checks for a palette. Warnings only — the user decides.
 * Body text pairs need 4.5:1 (WCAG AA); muted text and accents need 3:1.
 */
export function paletteChecks(roles) {
  const check = (label, a, b, min) => ({ label, ratio: contrast(roles[a], roles[b]), min });
  return [
    check('Text on canvas', 'text', 'canvas', 4.5),
    check('Text on surface', 'text', 'surface', 4.5),
    check('Muted on canvas', 'mutedText', 'canvas', 3),
    check('Accent on canvas', 'accent', 'canvas', 3),
  ].map((c) => ({ ...c, ok: c.ratio >= c.min }));
}

export { FAMILIES };
