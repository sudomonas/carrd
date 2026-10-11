// Layout registry. Order matters only as a deterministic tie-breaker.
import editorial from './editorial.js';
import centered from './centered.js';
import cinematic from './cinematic.js';
import headline from './headline.js';
import code from './code.js';
import list from './list.js';

export const LAYOUTS = [editorial, centered, cinematic, headline, code, list];

export function getLayout(id) {
  return LAYOUTS.find((l) => l.id === id) ?? null;
}
