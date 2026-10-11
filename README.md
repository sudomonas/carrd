# carrd

A small, local-first publishing utility. You paste a link, a quote, a paragraph, an image, a code snippet or a list, and carrd composes a polished card image from it. You can then adjust exactly five things: **layout, palette, typography, background and size**. Then export a PNG or JPEG at exact pixel dimensions.

There's no account, no tracking and no AI. Composition is done by a deterministic engine.

- **`/`** is the landing page. It has a live "try it" demo and a gallery of every layout, all rendered by the real engine in the browser. Text typed in the demo carries into the studio.
- **`/studio`** is the editor.
- Both pages support **light, dark and system** themes. The toggle cycles through them, the choice is saved, and `public/theme-init.js` applies it before first paint so there's no flash.
- Inside the Palette and Typography controls you can **create your own palettes and font pairings**:
  - **Palettes:** set the six semantic roles with colour pickers or hex values. Live contrast checks warn about readability (4.5:1 for text, 3:1 for muted text and accents).
  - **Pairings:** choose headline, body and code fonts from the bundled families. carrd still controls sizes, weights and line heights.
  - Names must be unique.
  - Edits preview live on the card before you save. Saved styles persist in the browser (up to 12 of each), and deleting one can be undone.

## Commands

```bash
npm install                      # install dependencies
npm run dev                      # dev server at http://localhost:5173 (includes /api/meta)
npm test                         # unit tests (Vitest)
npx playwright install chromium  # once, for end-to-end tests
npm run test:e2e                 # browser tests: exact export sizes, responsive, visual baselines
npm run build                    # production build into dist/
npm start                        # serve dist/ + /api/meta on http://127.0.0.1:4173
```

`npm start` reads the `PORT` and `HOST` environment variables. It also reads `TRUST_PROXY=1`, which rate-limits by the first `X-Forwarded-For` hop. Set that only behind a trusted reverse proxy.

Text, image, code and list cards work from any static hosting of `dist/`. Only link extraction needs the Node server.

## Architecture

```
src/
  Root.jsx      two routes: "/" → Landing.jsx, "/studio" → App.jsx (the studio)
  Landing.jsx   landing page (live demo, gallery, theme toggle)
  config/       palettes, font pairings, backgrounds, output sizes (declarative)
  model/        document.js – normalized document + validation
                input.js    – input adapters (text/link/image/code/list → content)
                library.js  – user palettes & pairings: validation, storage, contrast checks
  engine/       compose.js  – eligibility, scoring, selection, fitting, fallback
                text.js     – measurement-driven wrapping & fitting
                code.js     – language detection + tokenizer
                color.js    – WCAG contrast, overlay solver
                layouts/    – registry + 11 layouts (see below)
  render/       canvas.js (scene → canvas, tinted texture patterns), fonts.js, measure.js, images.js, export.js
  lib/          storage.js (localStorage + IndexedDB), useAssets.js, theme.js, hooks.js, samplePhoto.js
  components/   React UI
server/         ip.js, fetch.js (SSRF-safe fetch), parse.js, meta.js (handler), index.js
scripts/        make-textures.mjs (generates the committed texture tiles)
tests/          Vitest unit tests
e2e/            Playwright tests, fixture photo, visual baselines
```

**One renderer for preview and export.** `composeCard(doc, env)` is pure JavaScript with no React or DOM dependency. It returns a *scene*: rects, gradients, image crops and positioned text lines at exact output pixels. The same `renderScene()` draws that scene for the live preview (scaled to the screen), the layout thumbnails, and the export (scale 1). Text is measured with canvas `measureText` using the same bundled font files the renderer draws with. Fonts are registered under `Carrd …` family names so a system font with the same name can never be used by mistake. That's why the preview and the exported file can't drift apart, and no HTML-to-image conversion is needed.

### Catalogue

| | |
|---|---|
| **Layouts (11)** | Editorial, Centered, Cinematic, Headline, Code, Index (lists), Split (photo and text halves), Framed (double-rule letterpress quote), Post (social-post card with avatar initials), Figure (a big leading number such as "87%"), Poster (short text, each line stretched edge to edge) |
| **Palettes (20)** | Light, muted, dark and bold/high-contrast groups. A unit test checks every palette for 4.5:1 text contrast and 3:1 muted-text and accent contrast. |
| **Pairings (13)** | Literary, Editorial, Neutral, Modern, Technical, Monospace, Classic, Magazine, Elegant, Statement, Grotesque, Swiss, Friendly |
| **Backgrounds** | Solid, Gradient, Photo, Source image, plus six textures: Paper, Linen, Grain, Dots, Grid and Stripes. Each texture is a static alpha-mask tile from `scripts/make-textures.mjs` (`npm run textures`), tinted with a palette colour when drawn, so it suits every palette and scales with the card. |
| **Sizes (30 presets)** | Common, Instagram, TikTok, X, LinkedIn, Facebook, Threads, Bluesky, Pinterest, YouTube and Web (Open Graph, blog header), plus Custom. Banners wider than 3:1 are left out because no layout composes well at that ratio. |

Layouts never drop content:
- Poster and Figure are only eligible when they can show all of the text.
- Post requires a real author or attribution and never invents a name.
- A test checks that every eligible layout shows every word of the title, body, quote, attribution, author and source.

**Shuffle** (the dice button in the studio header) picks a random layout, palette, typography and background. Your own palettes and pairings are included, and photo backgrounds are only offered when there's a photo.
- **Size is never changed:** it's where the card is going, not a style choice.
- **Always fits:** every candidate is composed, and only one where all the text fits is accepted. If nothing fits, carrd says so instead of producing a broken card.
- **Undo:** the confirmation toast offers Undo.
- **Testable:** the logic is the pure function `shuffleDesign()` in `src/engine/shuffle.js`, which takes an injectable random source.

**Fonts load on demand.** The studio waits only for the families the current pairing uses, and loads the rest in the background. Text measurement is rebuilt whenever a family finishes loading, so cached widths never come from a fallback font.

**Custom styles** use the same shape as the built-ins. Their ids are prefixed `custom-` and `customfont-`, and they're resolved through `env.palettes` and `env.fontPairs` in the engine. A pairing is stored only as its family choices (`{display, text, code}`) and rebuilt by `buildFontPair()`. Every face it can reference is bundled, and a unit test checks every combination. A palette or pairing that's being edited is passed to the engine as a temporary entry, so the preview, thumbnails and export all reflect it.

**The document** is `{ schemaVersion, content, design }`. Content is normalized from raw input. Images are referenced by asset id. Their blobs live outside the document: as object URLs in memory (revoked when replaced or on unmount) and in IndexedDB for persistence. Design holds only the five settings, plus `layoutLocked`, which records whether the user picked a layout or carrd did.

**Layout selection** (scoring is documented in `engine/compose.js`):
1. Filter layouts by supported content kind, required fields, image availability, aspect ratio and minimum size.
2. Score each one: affinity × 10, ±10 for the recommended text length, and image bonuses or penalties.
3. Run a fit check in score order and pick the first layout that fits.

Selection runs only when the content changes. Palette, background and size changes never move the layout. When the chosen layout overflows at a new size, another layout is shown with a notice and the document is left unchanged, so switching back restores it. If nothing fits, an actionable error says roughly how much room is missing.

**Text fitting.** Every text block has a readable size range. All blocks in a layout scale together, and binary search finds the largest scale that fits. Headlines are wrapped with balanced lines. Text is never truncated or shrunk below its minimum.
- **Article excerpts** are trimmed once, at input time, at a sentence break of about 280 characters. The trim is flagged in the UI, and the excerpt stays editable with a "Use full text" option.
- **Code** is never altered. Long lines soft-wrap with a gutter marker, and tabs display as two spaces. If the code still doesn't fit, export is blocked with a line count.

**Photo backgrounds** use either a contained surface panel or a contrast-solved overlay. The overlay's alpha is the smallest value that gives 4.5:1 text contrast against both the 10th and 90th percentile luminance of the photo under the text, measured from a 16×16 luminance grid.

**Export.** The pipeline waits for fonts and images, recomposes at the selected size, refuses to export if anything overflows, renders to a canvas of exact size, verifies its dimensions, encodes (PNG, or JPEG at quality 0.92) and downloads with a sanitized filename. A failure never touches the document, and the button is disabled while an export is running.

## URL metadata service and its security

`POST /api/meta {url}` returns the title, description, site name, author, canonical URL and the preview image (validated bytes, at most 4 MB). It's not a general proxy. Protections:

- Only http and https on default ports. URLs with credentials are rejected, as are `localhost`, `.local`/`.internal`-style names and single-label hosts.
- IP literals and **every** DNS answer must be globally routable. Loopback, private, CGNAT, link-local (including cloud metadata), multicast, reserved and documentation ranges are blocked, as are IPv4-mapped, NAT64 and 6to4 IPv6 forms.
- The socket connects to the validated address through a pinned lookup, which defeats DNS rebinding.
- At most 4 redirects, each one re-validated. There's an 8 s deadline for the page and 6 s for the image. Bodies are capped at 2 MB of HTML and 4 MB of image, measured after decompression. Content types are checked, and image magic bytes are verified.
- HTML is scanned for tags and never executed. JSON-LD is parsed with `JSON.parse`.
- A per-client rate limit of 20 requests a minute, at most 8 fetches at once, and a 4 KB request-body cap.
- Users only ever see generic error messages. Internal details are never echoed back.

The UI states that fetching sends the URL to this service. If extraction fails, the original URL is kept and the user can fill in the fields manually.

The production server also sends a strict CSP and `nosniff`/`no-referrer` headers, and rejects path traversal.

## Dependencies

| Package | Why | License |
|---|---|---|
| react, react-dom | UI | MIT |
| @fontsource/{inter, source-serif-4, fraunces, space-grotesk, ibm-plex-sans, ibm-plex-mono, jetbrains-mono, playfair-display, eb-garamond, dm-sans, manrope, instrument-serif, bricolage-grotesque, dm-serif-display} | bundled card fonts (latin subset, woff2) | OFL-1.1 |
| vite, @vitejs/plugin-react | dev server and build | MIT |
| vitest | unit tests | MIT |
| @playwright/test | browser tests: exact export dimensions, responsive checks, visual baselines | Apache-2.0 |

No other runtime dependencies. Validation, the tokenizer, metadata parsing and SSRF checks are small, hand-written modules.

## Known limitations

- Bundled fonts cover the **Latin** subset only. Other scripts render in system fallback fonts. Measurement still matches the drawing because both use the same canvas, but the typography is less refined.
- Only the first frame of an animated GIF is used.
- The code tokenizer is line-based and deliberately simple. It doesn't track block comments or template strings across lines.
- The rate limiter and concurrency cap are in memory and per process. A multi-instance deployment needs a shared limiter.
- Visual baselines in `e2e/*-snapshots` are platform-specific (Linux Chromium).
- "carrd" is the working name. carrd.co is an existing website builder, so check trademark availability before launching publicly.
- E2E tests run in Chromium only. Firefox and Safari haven't been verified automatically.
