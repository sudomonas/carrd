// Registers the bundled fonts with the FontFace API, family by family.
// Card rendering waits for a pairing's families before measuring, so
// measurement and drawing always use identical files.
import interR from '@fontsource/inter/files/inter-latin-400-normal.woff2?url';
import interI from '@fontsource/inter/files/inter-latin-400-italic.woff2?url';
import interM from '@fontsource/inter/files/inter-latin-500-normal.woff2?url';
import interSB from '@fontsource/inter/files/inter-latin-600-normal.woff2?url';
import interB from '@fontsource/inter/files/inter-latin-700-normal.woff2?url';
import serifR from '@fontsource/source-serif-4/files/source-serif-4-latin-400-normal.woff2?url';
import serifI from '@fontsource/source-serif-4/files/source-serif-4-latin-400-italic.woff2?url';
import serifSB from '@fontsource/source-serif-4/files/source-serif-4-latin-600-normal.woff2?url';
import frauncesR from '@fontsource/fraunces/files/fraunces-latin-400-normal.woff2?url';
import frauncesI from '@fontsource/fraunces/files/fraunces-latin-400-italic.woff2?url';
import frauncesSB from '@fontsource/fraunces/files/fraunces-latin-600-normal.woff2?url';
import groteskR from '@fontsource/space-grotesk/files/space-grotesk-latin-400-normal.woff2?url';
import groteskM from '@fontsource/space-grotesk/files/space-grotesk-latin-500-normal.woff2?url';
import groteskSB from '@fontsource/space-grotesk/files/space-grotesk-latin-600-normal.woff2?url';
import plexR from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?url';
import plexI from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff2?url';
import plexSB from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?url';
import plexMonoR from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2?url';
import plexMonoM from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?url';
import jbR from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url';
import jbI from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-italic.woff2?url';
import jbM from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-500-normal.woff2?url';
import jbB from '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2?url';

import playfairR from '@fontsource/playfair-display/files/playfair-display-latin-400-normal.woff2?url';
import playfairI from '@fontsource/playfair-display/files/playfair-display-latin-400-italic.woff2?url';
import playfairB from '@fontsource/playfair-display/files/playfair-display-latin-700-normal.woff2?url';
import garamondR from '@fontsource/eb-garamond/files/eb-garamond-latin-400-normal.woff2?url';
import garamondI from '@fontsource/eb-garamond/files/eb-garamond-latin-400-italic.woff2?url';
import garamondSB from '@fontsource/eb-garamond/files/eb-garamond-latin-600-normal.woff2?url';
import dmSansR from '@fontsource/dm-sans/files/dm-sans-latin-400-normal.woff2?url';
import dmSansI from '@fontsource/dm-sans/files/dm-sans-latin-400-italic.woff2?url';
import dmSansM from '@fontsource/dm-sans/files/dm-sans-latin-500-normal.woff2?url';
import dmSansB from '@fontsource/dm-sans/files/dm-sans-latin-700-normal.woff2?url';
import manropeR from '@fontsource/manrope/files/manrope-latin-400-normal.woff2?url';
import manropeSB from '@fontsource/manrope/files/manrope-latin-600-normal.woff2?url';
import manropeXB from '@fontsource/manrope/files/manrope-latin-800-normal.woff2?url';
import instrumentR from '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff2?url';
import instrumentI from '@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2?url';
import bricolageR from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-400-normal.woff2?url';
import bricolageSB from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-600-normal.woff2?url';
import bricolageB from '@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-700-normal.woff2?url';
import dmSerifR from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-normal.woff2?url';
import dmSerifI from '@fontsource/dm-serif-display/files/dm-serif-display-latin-400-italic.woff2?url';

export const FACES = [
  ['Carrd Inter', 400, 'normal', interR], ['Carrd Inter', 400, 'italic', interI], ['Carrd Inter', 500, 'normal', interM],
  ['Carrd Inter', 600, 'normal', interSB], ['Carrd Inter', 700, 'normal', interB],
  ['Carrd Source Serif', 400, 'normal', serifR], ['Carrd Source Serif', 400, 'italic', serifI], ['Carrd Source Serif', 600, 'normal', serifSB],
  ['Carrd Fraunces', 400, 'normal', frauncesR], ['Carrd Fraunces', 400, 'italic', frauncesI], ['Carrd Fraunces', 600, 'normal', frauncesSB],
  ['Carrd Space Grotesk', 400, 'normal', groteskR], ['Carrd Space Grotesk', 500, 'normal', groteskM], ['Carrd Space Grotesk', 600, 'normal', groteskSB],
  ['Carrd Plex Sans', 400, 'normal', plexR], ['Carrd Plex Sans', 400, 'italic', plexI], ['Carrd Plex Sans', 600, 'normal', plexSB],
  ['Carrd Plex Mono', 400, 'normal', plexMonoR], ['Carrd Plex Mono', 500, 'normal', plexMonoM],
  ['Carrd JetBrains Mono', 400, 'normal', jbR], ['Carrd JetBrains Mono', 400, 'italic', jbI],
  ['Carrd JetBrains Mono', 500, 'normal', jbM], ['Carrd JetBrains Mono', 700, 'normal', jbB],
  ['Carrd Playfair', 400, 'normal', playfairR], ['Carrd Playfair', 400, 'italic', playfairI], ['Carrd Playfair', 700, 'normal', playfairB],
  ['Carrd EB Garamond', 400, 'normal', garamondR], ['Carrd EB Garamond', 400, 'italic', garamondI], ['Carrd EB Garamond', 600, 'normal', garamondSB],
  ['Carrd DM Sans', 400, 'normal', dmSansR], ['Carrd DM Sans', 400, 'italic', dmSansI], ['Carrd DM Sans', 500, 'normal', dmSansM], ['Carrd DM Sans', 700, 'normal', dmSansB],
  ['Carrd Manrope', 400, 'normal', manropeR], ['Carrd Manrope', 600, 'normal', manropeSB], ['Carrd Manrope', 800, 'normal', manropeXB],
  ['Carrd Instrument Serif', 400, 'normal', instrumentR], ['Carrd Instrument Serif', 400, 'italic', instrumentI],
  ['Carrd Bricolage', 400, 'normal', bricolageR], ['Carrd Bricolage', 600, 'normal', bricolageSB], ['Carrd Bricolage', 700, 'normal', bricolageB],
  ['Carrd DM Serif Display', 400, 'normal', dmSerifR], ['Carrd DM Serif Display', 400, 'italic', dmSerifI],
];

const families = new Map(); // family -> Promise<boolean> (true when every face loaded)
const loaded = new Set();

function loadFace([family, weight, style, url]) {
  const face = new FontFace(family, `url(${url}) format("woff2")`, { weight: String(weight), style, display: 'block' });
  document.fonts.add(face);
  return face.load();
}

/**
 * Loads every face of one bundled family once. Never rejects: a failed
 * family falls back to the system stack declared in its pairing, which
 * measurement and drawing then share.
 */
export function loadFamily(family, timeoutMs = 8000) {
  if (!families.has(family)) {
    const faces = FACES.filter((f) => f[0] === family);
    const all = Promise.all(faces.map(loadFace)).then(() => true, () => false);
    const timeout = new Promise((resolve) => setTimeout(() => resolve(false), timeoutMs));
    families.set(family, Promise.race([all, timeout]).then((ok) => {
      loaded.add(family);
      return ok;
    }));
  }
  return families.get(family);
}

/** Resolves once the given families have settled (loaded or failed). */
export function loadFamilies(list) {
  return Promise.all([...new Set(list)].map((f) => loadFamily(f)));
}

/** True once a family has settled, so measuring it is stable. */
export const isFamilySettled = (family) => loaded.has(family);

/** Families a pairing draws with. */
export function familiesOf(pair) {
  return [...new Set([pair.display, pair.quote, pair.text, pair.meta, pair.mono].map((f) => f.family))];
}

/** Loads all bundled families. Resolves to { failed: [family names] }. */
export async function loadFonts() {
  const names = [...new Set(FACES.map((f) => f[0]))];
  const results = await loadFamilies(names);
  return { failed: names.filter((_, i) => !results[i]) };
}
