// "Shuffle": a random design that is guaranteed to work for the content.
// Size is never changed — it's where the card is going, not a style choice.
import { PALETTES } from '../config/palettes.js';
import { FONT_PAIRS } from '../config/typography.js';
import { BACKGROUNDS } from '../config/backgrounds.js';
import { composeCard, effectiveBackground, rankLayouts } from './compose.js';

const pick = (list, rng) => list[Math.floor(rng() * list.length) % list.length];

/** Picks from `list`, avoiding `current` when there is any alternative. */
function pickOther(list, current, rng) {
  const others = list.filter((x) => x !== current);
  return pick(others.length ? others : list, rng);
}

/** Backgrounds that can actually be drawn for this content and these assets. */
export function availableBackgrounds(content, design, env) {
  return BACKGROUNDS.filter((b) => {
    if (!b.needs) return true;
    const eff = effectiveBackground({ ...design, backgroundId: b.id }, content, env);
    return eff.id === b.id;
  }).map((b) => b.id);
}

/**
 * Returns a new design with a random layout, palette, typography and
 * background (custom palettes and pairings included), or null if no fitting
 * combination turns up within `attempts`. Every candidate is composed and
 * kept only if all text fits — shuffle never produces a broken card.
 */
export function shuffleDesign(content, design, env, { rng = Math.random, attempts = 24 } = {}) {
  const palettes = [...PALETTES, ...(env.palettes ?? [])].map((p) => p.id);
  const pairs = [...FONT_PAIRS, ...(env.fontPairs ?? [])].map((f) => f.id);
  const backgrounds = availableBackgrounds(content, design, env);
  // Photo backgrounds only appear sometimes, so text-led shuffles stay varied.
  const weighted = backgrounds.flatMap((id) => (id === 'photo' || id === 'source' ? [id] : [id, id]));

  for (let i = 0; i < attempts; i++) {
    const candidate = {
      ...design,
      paletteId: pickOther(palettes, design.paletteId, rng),
      fontPairId: pickOther(pairs, design.fontPairId, rng),
      backgroundId: pick(weighted, rng),
      layoutLocked: true,
    };
    const layouts = rankLayouts(content, candidate, env).map((r) => r.layout.id);
    if (!layouts.length) continue;
    candidate.layoutId = layouts.length > 1 ? pickOther(layouts, design.layoutId, rng) : layouts[0];
    const scene = composeCard({ content, design: candidate }, env, { fallback: false });
    if (scene.ok && scene.fits && scene.layoutId === candidate.layoutId) return candidate;
  }
  return null;
}
