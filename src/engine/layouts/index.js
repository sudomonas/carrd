// Layout registry. Order matters only as a deterministic tie-breaker.
import editorial from './editorial.js';
import centered from './centered.js';
import cinematic from './cinematic.js';
import headline from './headline.js';
import code from './code.js';
import list from './list.js';
import split from './split.js';
import framed from './framed.js';
import post from './post.js';
import figure from './figure.js';
import poster from './poster.js';

export const LAYOUTS = [editorial, centered, cinematic, headline, code, list, split, framed, post, figure, poster];

export function getLayout(id) {
  return LAYOUTS.find((l) => l.id === id) ?? null;
}
