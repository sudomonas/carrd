import { useMemo, useRef, useState } from 'react';
import { composeCard, selectLayout } from './engine/compose.js';
import { defaultDesign, normalizeContent } from './model/document.js';
import { emptySource, sourceToContent } from './model/input.js';
import { PALETTES } from './config/palettes.js';
import { FONT_PAIRS, getFontPair } from './config/typography.js';
import { OUTPUT_PRESETS, PLATFORMS } from './config/outputs.js';
import { LAYOUTS } from './engine/layouts/index.js';
import { familiesOf } from './render/fonts.js';
import { useTextures } from './lib/textures.js';
import { TEXTURES } from './config/backgrounds.js';
import { useMeasure, useReveal, useWidth } from './lib/hooks.js';
import { createSamplePhoto } from './lib/samplePhoto.js';
import { HANDOFF_KEY } from './lib/storage.js';
import SceneCanvas from './components/SceneCanvas.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';
import './styles/landing.css';

const DEMO_TEXT = '“The details are not the details. They make the design.”\n— Charles Eames';
const DEMO_PALETTES = ['warm-paper', 'ink', 'sage', 'midnight', 'clay', 'cobalt', 'sunflower'];
const DEMO_SIZES = [
  { id: 'portrait', label: '4:5' },
  { id: 'square', label: '1:1' },
  { id: 'story', label: '9:16' },
];

const photo = { assetId: 'sample', width: 1200, height: 900 };

/** Sample cards for the gallery: real content, real engine, fixed designs. */
const GALLERY = [
  {
    layout: 'editorial',
    caption: 'Editorial',
    note: 'Articles and shared links',
    content: { kind: 'article', title: 'The quiet return of the small web', body: 'Personal sites are back — and they look nothing like they used to.', sourceName: 'The Margin', author: 'Ada Park', image: photo },
    design: { paletteId: 'warm-paper', fontPairId: 'editorial' },
  },
  {
    layout: 'centered',
    caption: 'Centered',
    note: 'Quotes and short thoughts',
    content: { kind: 'quote', quote: 'Simplicity is prerequisite for reliability.', attribution: 'Edsger W. Dijkstra' },
    design: { paletteId: 'ink', fontPairId: 'literary', backgroundId: 'texture' },
  },
  {
    layout: 'cinematic',
    caption: 'Cinematic',
    note: 'Photographs and captions',
    content: { kind: 'image', title: 'First light over the harbour', attribution: 'Field notes, no. 12', image: photo },
    design: { paletteId: 'porcelain', fontPairId: 'literary' },
  },
  {
    layout: 'headline',
    caption: 'Headline',
    note: 'Announcements and posts',
    content: { kind: 'text', title: 'Ship the boring version first.', body: 'Then make it better with real feedback instead of guesses.', attribution: 'Notes on building' },
    design: { paletteId: 'newsprint', fontPairId: 'modern' },
  },
  {
    layout: 'code',
    caption: 'Code',
    note: 'Snippets, kept exact',
    content: { kind: 'code', title: 'A tiny debounce', codeLanguage: 'javascript', body: 'export function debounce(fn, wait = 200) {\n  let timer;\n  return (...args) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), wait);\n  };\n}' },
    design: { paletteId: 'midnight', fontPairId: 'technical' },
  },
  {
    layout: 'list',
    caption: 'Index',
    note: 'Lists and facts',
    content: { kind: 'list', title: 'Three rules for small tools', items: ['Do one thing and do it well', 'Defaults matter more than options', 'Ship the boring version first'] },
    design: { paletteId: 'sage', fontPairId: 'literary', backgroundId: 'gradient' },
  },
  {
    layout: 'split',
    caption: 'Split',
    note: 'Photo and words, half and half',
    content: { kind: 'article', title: 'Notes from a slower harbour town', body: 'Three days without a schedule, and what it taught me about attention.', sourceName: 'Field Notes', image: photo },
    design: { paletteId: 'linen', fontPairId: 'magazine' },
  },
  {
    layout: 'framed',
    caption: 'Framed',
    note: 'Letterpress-style quotes',
    content: { kind: 'quote', quote: 'Have nothing in your house that you do not know to be useful, or believe to be beautiful.', attribution: 'William Morris', sourceName: 'Hopes and Fears for Art' },
    design: { paletteId: 'espresso', fontPairId: 'classic' },
  },
  {
    layout: 'post',
    caption: 'Post',
    note: 'Social-style posts',
    content: { kind: 'text', body: 'Shipped the smallest possible version today. It does one thing. People already love it more than the big plan.', author: 'Ada Park', sourceName: 'adapark.dev' },
    design: { paletteId: 'mist', fontPairId: 'friendly' },
  },
  {
    layout: 'figure',
    caption: 'Figure',
    note: 'Stats and milestones',
    content: { kind: 'text', body: '87% of readers decide in under three seconds whether to stop scrolling.', attribution: 'Attention report, 2026' },
    design: { paletteId: 'cobalt', fontPairId: 'swiss' },
  },
  {
    layout: 'poster',
    caption: 'Poster',
    note: 'A few words, very large',
    content: { kind: 'text', body: 'Make it simple, but significant', attribution: 'Don Draper' },
    design: { paletteId: 'sunflower', fontPairId: 'grotesque' },
  },
];

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const inWords = (n) => NUMBER_WORDS[n] ?? String(n);
const capitalize = (t) => t[0].toUpperCase() + t.slice(1);

// Fonts the landing page renders with; everything else loads in the background.
const LANDING_FAMILIES = [...new Set(['literary', ...GALLERY.map((g) => g.design.fontPairId)].flatMap((id) => familiesOf(getFontPair(id))))];

const Arrow = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
);

function StudioLink({ onNavigate, className = 'btn btn-primary', children, onBefore }) {
  return (
    <a
      href="/studio"
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        onBefore?.();
        onNavigate('/studio');
      }}
    >
      {children}
    </a>
  );
}

function CardSkeleton({ width, ratio }) {
  return <div className="card-skeleton" style={{ width, aspectRatio: ratio }} aria-hidden="true" />;
}

/** The hero's live demo: type a line, pick a palette, watch it compose. */
function TryIt({ env, images, textures, onNavigate }) {
  const [text, setText] = useState(DEMO_TEXT);
  const [paletteId, setPaletteId] = useState('warm-paper');
  const [size, setSize] = useState('portrait');
  const [frameRef, frameWidth] = useWidth();

  const scene = useMemo(() => {
    if (!env) return null;
    const content = sourceToContent({ ...emptySource(), text: { value: text, attribution: '', as: 'auto' } });
    const base = { ...defaultDesign(), paletteId, outputPresetId: size };
    const layoutId = selectLayout(content, base, env);
    return layoutId ? composeCard({ content, design: { ...base, layoutId } }, env) : composeCard({ content, design: base }, env);
  }, [env, text, paletteId, size]);

  const ratio = size === 'square' ? 1 : size === 'story' ? 1080 / 1920 : 1080 / 1350;
  const maxH = size === 'story' ? 520 : 460;
  const width = Math.max(0, Math.min(frameWidth, Math.round(maxH * ratio)));
  const handOff = () => {
    try {
      sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ text, paletteId }));
    } catch {
      /* the studio simply opens without the text */
    }
  };

  return (
    <div className="tryit">
      <div className="tryit-stage" ref={frameRef}>
        {scene?.ok ? (
          <SceneCanvas key={size} className="tryit-card" scene={scene} displayWidth={width} images={images} textures={textures} label="Live preview of your card" />
        ) : scene ? (
          <div className="tryit-empty" style={{ width, aspectRatio: ratio }}>Type something to see a card.</div>
        ) : (
          <CardSkeleton width={width} ratio={ratio} />
        )}
      </div>
      <div className="tryit-controls">
        <label className="tryit-label" htmlFor="tryit-text">Try it — edit the text</label>
        <textarea id="tryit-text" className="input textarea tryit-input" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="tryit-row">
          <div className="tryit-swatches" role="radiogroup" aria-label="Palette">
            {DEMO_PALETTES.map((id) => {
              const p = PALETTES.find((x) => x.id === id);
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={paletteId === id}
                  aria-label={p.label}
                  title={p.label}
                  className="dot"
                  style={{ background: p.roles.canvas, color: p.roles.accent, borderColor: p.roles.divider }}
                  onClick={() => setPaletteId(id)}
                >
                  <span style={{ background: p.roles.accent }} />
                </button>
              );
            })}
          </div>
          <div className="segmented segmented-sm" role="radiogroup" aria-label="Size">
            {DEMO_SIZES.map((s) => (
              <button key={s.id} type="button" role="radio" aria-checked={size === s.id} className="seg" onClick={() => setSize(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <StudioLink onNavigate={onNavigate} className="btn tryit-continue" onBefore={handOff}>
          Continue in the studio <Arrow />
        </StudioLink>
      </div>
    </div>
  );
}

function GalleryItem({ item, images, textures }) {
  const [ref, width] = useWidth();
  return (
    <figure className="gallery-item" data-reveal>
      <div ref={ref} className="gallery-frame">
        {item.scene?.ok && width > 0 ? (
          <SceneCanvas scene={item.scene} displayWidth={width} images={images} textures={textures} label={`${item.caption} layout example`} className="gallery-card" />
        ) : (
          <CardSkeleton width="100%" ratio={1080 / 1350} />
        )}
      </div>
      <figcaption>
        <strong>{item.caption}</strong>
        <span>{item.note}</span>
      </figcaption>
    </figure>
  );
}

function Gallery({ env, images, textures, onNavigate }) {
  const items = useMemo(() => {
    if (!env) return GALLERY;
    return GALLERY.map((g) => ({
      ...g,
      scene: composeCard({ content: normalizeContent(g.content), design: { ...defaultDesign(), ...g.design, layoutId: g.layout, layoutLocked: true } }, env),
    }));
  }, [env]);
  return (
    <div className="gallery">
      {items.map((g) => <GalleryItem key={g.layout} item={g} images={images} textures={textures} />)}
      <figure className="gallery-item gallery-yours" data-reveal>
        <div className="gallery-yours-card">
          <span className="gallery-yours-mark" aria-hidden="true">+</span>
          <p>Your words, your palette, your size.</p>
          <StudioLink onNavigate={onNavigate} className="btn btn-primary btn-sm">Make one <Arrow /></StudioLink>
        </div>
        <figcaption>
          <strong>Yours</strong>
          <span>Start in the studio</span>
        </figcaption>
      </figure>
    </div>
  );
}

const STEPS = [
  { n: '01', title: 'Paste', text: 'A link, a quote, a paragraph, an image, code or a list. carrd works out what it is.' },
  { n: '02', title: 'Compose', text: 'A deterministic engine picks a layout, sets type to fit, and never clips a word.' },
  { n: '03', title: 'Export', text: 'PNG or JPEG at the exact pixels you chose — the same render you saw in the preview.' },
];

function FiveControls() {
  const shown = PALETTES.filter((p) => ['warm-paper', 'sage', 'blush', 'forest', 'midnight', 'cobalt', 'sunflower'].includes(p.id));
  return (
    <div className="five">
      <div className="five-item" data-reveal>
        <span className="five-n">1</span>
        <h3>Layout</h3>
        <p>{capitalize(inWords(LAYOUTS.length))} compositions, filtered to what suits your content. Auto by default.</p>
        <div className="five-visual five-layouts" aria-hidden="true">
          <i className="l-ed" /><i className="l-ce" /><i className="l-he" />
        </div>
      </div>
      <div className="five-item" data-reveal>
        <span className="five-n">2</span>
        <h3>Palette</h3>
        <p>{capitalize(inWords(PALETTES.length))} curated palettes with semantic roles — or build your own, with contrast checks.</p>
        <div className="five-visual five-swatches" aria-hidden="true">
          {shown.map((p) => <i key={p.id} style={{ background: p.roles.canvas, borderColor: p.roles.divider, color: p.roles.accent }} />)}
          <i className="add">+</i>
        </div>
      </div>
      <div className="five-item" data-reveal>
        <span className="five-n">3</span>
        <h3>Typography</h3>
        <p>{capitalize(inWords(FONT_PAIRS.length))} bundled pairings, plus your own mixes. carrd sets the sizes.</p>
        <div className="five-visual five-type" aria-hidden="true">
          {FONT_PAIRS.filter((f) => ['literary', 'magazine', 'elegant', 'grotesque', 'swiss'].includes(f.id)).map((f) => (
            <span key={f.id} style={{ fontFamily: `"${f.display.family}", ${f.display.fallback}`, fontWeight: f.display.weight }}>Aa</span>
          ))}
        </div>
      </div>
      <div className="five-item" data-reveal>
        <span className="five-n">4</span>
        <h3>Background</h3>
        <p>Solid, gradient, {inWords(TEXTURES.length)} textures from paper grain to graph paper, your photo or the article’s image — readable by construction.</p>
        <div className="five-visual five-bg" aria-hidden="true">
          <i className="bg-solid" /><i className="bg-texture" /><i className="bg-gradient" /><i className="bg-photo" />
        </div>
      </div>
      <div className="five-item" data-reveal>
        <span className="five-n">5</span>
        <h3>Size</h3>
        <p>{OUTPUT_PRESETS.length} presets for {PLATFORMS.length - 1} platforms — Instagram to YouTube — or custom. Changing size reflows, never stretches.</p>
        <div className="five-visual five-sizes" aria-hidden="true">
          <i style={{ width: 22, height: 22 }} /><i style={{ width: 20, height: 25 }} /><i style={{ width: 16, height: 28 }} /><i style={{ width: 32, height: 18 }} />
        </div>
      </div>
    </div>
  );
}

export default function Landing({ onNavigate }) {
  const rootRef = useRef(null);
  useReveal(rootRef);
  const measure = useMeasure(LANDING_FAMILIES);
  const sample = useMemo(() => createSamplePhoto(), []);
  const env = useMemo(() => (measure ? { measure, images: { sample: sample.stats } } : null), [measure, sample]);
  const images = useMemo(() => ({ sample: sample.element }), [sample]);
  const textures = useTextures();

  return (
    <div className="landing" ref={rootRef}>
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="l-header">
        <a className="wordmark" href="/" aria-label="carrd home">carrd<span aria-hidden="true">.</span></a>
        <nav className="l-nav" aria-label="Sections">
          <a href="#how">How it works</a>
          <a href="#layouts">Layouts</a>
          <a href="#controls">Controls</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <div className="l-header-actions">
          <ThemeToggle />
          <StudioLink onNavigate={onNavigate} className="btn btn-primary btn-sm">Open studio</StudioLink>
        </div>
      </header>

      <main id="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">A small publishing utility</p>
            <h1 className="hero-title">
              Content in.
              <br />
              <em>Card out.</em>
            </h1>
            <p className="hero-lede">
              Paste a link, a quote, a paragraph or a snippet of code. carrd typesets it into a card worth sharing — you choose the finish and export at exact size.
            </p>
            <div className="cta-row">
              <StudioLink onNavigate={onNavigate}>Open the studio <Arrow /></StudioLink>
              <a className="btn btn-ghost" href="#how">How it works</a>
            </div>
            <ul className="hero-facts">
              <li>No account</li>
              <li>Runs in your browser</li>
              <li>Exact-pixel PNG &amp; JPEG</li>
            </ul>
          </div>
          <TryIt env={env} images={images} textures={textures} onNavigate={onNavigate} />
        </section>

        <section id="how" className="section">
          <div className="section-head" data-reveal>
            <p className="eyebrow">How it works</p>
            <h2>Three steps. No canvas to wrangle.</h2>
          </div>
          <ol className="steps">
            {STEPS.map((s) => (
              <li key={s.n} data-reveal>
                <span className="step-n">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="layouts" className="section">
          <div className="section-head" data-reveal>
            <p className="eyebrow">Layouts</p>
            <h2>{capitalize(inWords(LAYOUTS.length))} compositions, chosen for your content.</h2>
            <p className="section-lede">Every card below was rendered just now, in your browser, by the same engine the studio uses.</p>
          </div>
          <Gallery env={env} images={images} textures={textures} onNavigate={onNavigate} />
        </section>

        <section id="controls" className="section">
          <div className="section-head" data-reveal>
            <p className="eyebrow">Controls</p>
            <h2>Five decisions, not five hundred.</h2>
            <p className="section-lede">No freeform canvas, no layers, no handles. carrd makes the composition decisions; you make a few aesthetic ones.</p>
          </div>
          <FiveControls />
        </section>

        <section id="privacy" className="section">
          <div className="section-head" data-reveal>
            <p className="eyebrow">Privacy</p>
            <h2>Your work stays on your device.</h2>
          </div>
          <div className="pillars">
            <div data-reveal>
              <h3>Local-first</h3>
              <p>Drafts, images, palettes and pairings are stored in your browser. Nothing is uploaded to make a card.</p>
            </div>
            <div data-reveal>
              <h3>No account, no tracking</h3>
              <p>No sign-up, no analytics, no ads. Fonts are bundled — not fetched from a third party.</p>
            </div>
            <div data-reveal>
              <h3>Links, only when asked</h3>
              <p>Fetching a link sends just that URL to carrd’s metadata service, which reads the page’s public title and image.</p>
            </div>
          </div>
        </section>

        <section className="final" data-reveal>
          <h2>
            Make the next thing you share
            <br />
            <em>look considered.</em>
          </h2>
          <StudioLink onNavigate={onNavigate}>Open the studio <Arrow /></StudioLink>
        </section>
      </main>

      <footer className="l-footer">
        <span className="wordmark wordmark-sm">carrd<span aria-hidden="true">.</span></span>
        <span>Typeset with open-source fonts (SIL OFL). Made to be small.</span>
      </footer>
    </div>
  );
}
