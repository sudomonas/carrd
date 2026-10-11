// Registers the bundled fonts with the FontFace API. Card rendering waits for
// these before measuring, so measurement and drawing use identical files.
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

const FACES = [
  ['Carrd Inter', 400, 'normal', interR], ['Carrd Inter', 400, 'italic', interI], ['Carrd Inter', 500, 'normal', interM],
  ['Carrd Inter', 600, 'normal', interSB], ['Carrd Inter', 700, 'normal', interB],
  ['Carrd Source Serif', 400, 'normal', serifR], ['Carrd Source Serif', 400, 'italic', serifI], ['Carrd Source Serif', 600, 'normal', serifSB],
  ['Carrd Fraunces', 400, 'normal', frauncesR], ['Carrd Fraunces', 400, 'italic', frauncesI], ['Carrd Fraunces', 600, 'normal', frauncesSB],
  ['Carrd Space Grotesk', 400, 'normal', groteskR], ['Carrd Space Grotesk', 500, 'normal', groteskM], ['Carrd Space Grotesk', 600, 'normal', groteskSB],
  ['Carrd Plex Sans', 400, 'normal', plexR], ['Carrd Plex Sans', 400, 'italic', plexI], ['Carrd Plex Sans', 600, 'normal', plexSB],
  ['Carrd Plex Mono', 400, 'normal', plexMonoR], ['Carrd Plex Mono', 500, 'normal', plexMonoM],
  ['Carrd JetBrains Mono', 400, 'normal', jbR], ['Carrd JetBrains Mono', 400, 'italic', jbI],
  ['Carrd JetBrains Mono', 500, 'normal', jbM], ['Carrd JetBrains Mono', 700, 'normal', jbB],
];

let loading = null;

/**
 * Loads every bundled face once. Resolves to { failed: [family names] } and
 * never rejects: a failed face falls back to the system stack declared in
 * the pairing, which measurement and drawing then share.
 */
export function loadFonts(timeoutMs = 8000) {
  if (loading) return loading;
  const failed = new Set();
  const all = FACES.map(async ([family, weight, style, url]) => {
    try {
      const face = new FontFace(family, `url(${url}) format("woff2")`, { weight: String(weight), style, display: 'block' });
      document.fonts.add(face);
      await face.load();
    } catch {
      failed.add(family);
    }
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs));
  loading = Promise.race([Promise.all(all), timeout]).then(() => {
    for (const [family, weight, style] of FACES) {
      if (!document.fonts.check(`${style} ${weight} 16px "${family}"`)) failed.add(family);
    }
    return { failed: [...failed] };
  });
  return loading;
}
