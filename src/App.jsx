import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { defaultDesign, hasRenderableContent, normalizeDesign } from './model/document.js';
import { emptySource, makeExcerpt, normalizeSource, sourceToContent } from './model/input.js';
import { composeCard, eligibility, selectLayout } from './engine/compose.js';
import { getLayout } from './engine/layouts/index.js';
import { shuffleDesign } from './engine/shuffle.js';
import { getPalette } from './config/palettes.js';
import { getBackground } from './config/backgrounds.js';
import { resolveOutput } from './config/outputs.js';
import { familiesOf, isFamilySettled, loadFamilies, loadFonts } from './render/fonts.js';
import { createMeasure } from './render/measure.js';
import { base64ToBlob, validateImageFile, ImageError } from './render/images.js';
import { exportCard, ExportError } from './render/export.js';
import { HANDOFF_KEY, clearDraft, readDraft, writeDraft } from './lib/storage.js';
import { useAssets } from './lib/useAssets.js';
import { readLibrary, writeLibrary } from './model/library.js';
import { DEFAULT_PALETTE_ID } from './config/palettes.js';
import { DEFAULT_FONT_PAIR_ID, getFontPair } from './config/typography.js';
import { useTextures } from './lib/textures.js';
import Header from './components/Header.jsx';
import ContentPanel from './components/ContentPanel.jsx';
import DesignPanel from './components/DesignPanel.jsx';
import Preview from './components/Preview.jsx';
import ExportControl from './components/ExportControl.jsx';
import Toast from './components/Toast.jsx';



function initialState() {
  const draft = readDraft();
  const library = readLibrary();
  const ids = { paletteIds: library.palettes.map((p) => p.id), fontPairIds: library.fontPairs.map((f) => f.id) };
  return {
    source: normalizeSource(draft.source),
    design: draft.design ? normalizeDesign(draft.design, ids) : defaultDesign(),
    library,
  };
}

/** Text handed over from the landing page's "try it" box, consumed once. */
function takeHandoff() {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    sessionStorage.removeItem(HANDOFF_KEY);
    const data = raw ? JSON.parse(raw) : null;
    return typeof data?.text === 'string' && data.text.trim() ? data : null;
  } catch {
    return null;
  }
}


export default function Studio({ onNavigate }) {
  const [{ source: initialSource, design: initialDesign, library: initialLibrary }] = useState(initialState);
  const [source, setSource] = useState(initialSource);
  const [design, setDesign] = useState(initialDesign);
  const [library, setLibrary] = useState(initialLibrary);
  // A palette or pairing being edited, previewed live before it's saved.
  const [draftStyle, setDraftStyle] = useState(null);
  // Bumped whenever a font family finishes loading, to refresh measurement.
  const [fontVersion, setFontVersion] = useState(0);
  const [fontsFailed, setFontsFailed] = useState([]);
  const [tab, setTab] = useState('content');
  const [toast, setToast] = useState(null);
  const [announcement, setAnnouncement] = useState('');
  const [exportFormat, setExportFormat] = useState('png');
  const [exporting, setExporting] = useState(false);
  const [storageWarning, setStorageWarning] = useState(null);
  const textures = useTextures();

  const announce = useCallback((text) => {
    setAnnouncement('');
    requestAnimationFrame(() => setAnnouncement(text));
  }, []);
  const onStorageError = useCallback(() => setStorageWarning('Images could not be saved in this browser; they will be lost on reload.'), []);
  const { assets, setFromBlob, remove } = useAssets({ onStorageError });

  useEffect(() => {
    let alive = true;
    // Everything else loads in the background after the current pairing.
    loadFonts().then((r) => {
      if (!alive) return;
      setFontsFailed(r.failed);
      setFontVersion((v) => v + 1);
    });
    return () => {
      alive = false;
    };
  }, []);

  // ---- derived document -------------------------------------------------
  const ready = (id) => (assets[id]?.status === 'ready' ? assets[id] : null);
  const contentAssets = { upload: ready('upload'), link: ready('link') };
  const content = useMemo(
    () => sourceToContent(source, contentAssets),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [source, contentAssets.upload, contentAssets.link],
  );
  const deferredContent = useDeferredValue(content);

  const imageStats = useMemo(() => {
    const out = {};
    for (const [id, a] of Object.entries(assets)) {
      if (a.status === 'ready') out[id] = { width: a.width, height: a.height, luma: a.luma };
    }
    return out;
  }, [assets]);
  const imageElements = useMemo(() => {
    const out = {};
    for (const [id, a] of Object.entries(assets)) if (a.status === 'ready') out[id] = a.img;
    return out;
  }, [assets]);
  const palettes = useMemo(
    () => (draftStyle?.kind === 'palette' ? [...library.palettes.filter((p) => p.id !== draftStyle.value.id), draftStyle.value] : library.palettes),
    [library.palettes, draftStyle],
  );
  const fontPairs = useMemo(
    () => (draftStyle?.kind === 'fontPair' ? [...library.fontPairs.filter((f) => f.id !== draftStyle.value.id), draftStyle.value] : library.fontPairs),
    [library.fontPairs, draftStyle],
  );
  // What's on screen: the saved design, with any style being edited applied.
  const shownDesign = useMemo(() => {
    if (draftStyle?.kind === 'palette') return { ...design, paletteId: draftStyle.value.id };
    if (draftStyle?.kind === 'fontPair') return { ...design, fontPairId: draftStyle.value.id };
    return design;
  }, [design, draftStyle]);
  // Only the families the shown pairing uses gate the preview; measurement is
  // rebuilt once they settle so cached widths never come from a fallback font.
  const neededFamilies = familiesOf(getFontPair(shownDesign.fontPairId, fontPairs)).join('|');
  const fontsReady = neededFamilies.split('|').every(isFamilySettled);
  useEffect(() => {
    let alive = true;
    loadFamilies(neededFamilies.split('|')).then(() => alive && setFontVersion((v) => v + 1));
    return () => {
      alive = false;
    };
  }, [neededFamilies]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const measure = useMemo(() => (fontsReady ? createMeasure() : null), [fontsReady, fontVersion]);
  const env = useMemo(() => (measure ? { measure, images: imageStats, palettes, fontPairs } : null), [measure, imageStats, palettes, fontPairs]);
  const envRef = useRef(env);
  envRef.current = env;

  const renderable = hasRenderableContent(content);
  const [started, setStarted] = useState(renderable);
  useEffect(() => {
    if (renderable) setStarted(true);
  }, [renderable]);

  // ---- automatic layout selection ----------------------------------------
  // Runs only when content (or available images/fonts) change — never on
  // palette, background or size changes, so unrelated edits can't move the
  // layout. A locked layout that no longer suits the content is unlocked.
  const designRef = useRef(design);
  designRef.current = design;
  useEffect(() => {
    const env = envRef.current;
    if (!env || !hasRenderableContent(deferredContent)) return;
    const d = designRef.current;
    const current = getLayout(d.layoutId);
    if (d.layoutLocked && current && eligibility(current, deferredContent, d, env).ok) return;
    const id = selectLayout(deferredContent, d, env);
    if (id && (id !== d.layoutId || d.layoutLocked)) setDesign({ ...d, layoutId: id, layoutLocked: false });
  }, [deferredContent, measure, imageStats]);

  const doc = useMemo(() => ({ schemaVersion: 1, content: deferredContent, design: shownDesign }), [deferredContent, shownDesign]);
  const scene = useMemo(() => (env ? composeCard(doc, env) : null), [doc, env]);

  // ---- persistence -------------------------------------------------------
  useEffect(() => {
    const t = setTimeout(() => {
      const persistable = { ...source, link: { ...source.link, status: source.link.status === 'loading' ? 'idle' : source.link.status } };
      const err = writeDraft(persistable, design);
      setStorageWarning(err ? 'Drafts can’t be saved in this browser (storage is full or blocked).' : null);
    }, 300);
    return () => clearTimeout(t);
  }, [source, design]);

  // Flush immediately when the page is hidden or unloaded, so a fast reload
  // never loses the last debounced change.
  const latest = useRef({ source, design });
  latest.current = { source, design };
  useEffect(() => {
    const flush = () => writeDraft(latest.current.source, latest.current.design);
    const onVisibility = () => document.visibilityState === 'hidden' && flush();
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useEffect(() => {
    if (writeLibrary(library)) setStorageWarning('Your palettes and pairings can’t be saved in this browser.');
  }, [library]);

  // ---- content actions ---------------------------------------------------
  const updateSource = useCallback((mode, patch) => {
    setSource((s) => ({ ...s, [mode]: { ...s[mode], ...patch } }));
  }, []);
  const setMode = useCallback((mode) => setSource((s) => ({ ...s, mode })), []);

  const addImage = useCallback(async (id, file) => {
    try {
      validateImageFile(file);
    } catch (e) {
      const msg = e instanceof ImageError ? e.message : 'That file could not be used.';
      announce(msg);
      return msg;
    }
    const ok = await setFromBlob(id, file);
    if (!ok) {
      const msg = "The image couldn't be read. It may be damaged or in an unsupported format.";
      announce(msg);
      return msg;
    }
    announce('Image added.');
    return null;
  }, [setFromBlob, announce]);

  const fetchLink = useCallback(async (url) => {
    setSource((s) => ({ ...s, mode: 'link', link: { ...s.link, url, status: 'loading', error: null } }));
    announce('Fetching link details…');
    try {
      const res = await fetch('/api/meta', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
        signal: AbortSignal.timeout(20000),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 404 && !data) {
        throw new Error('Link details need the carrd server (run “npm start”). You can fill them in below.');
      }
      if (!res.ok || !data?.ok) throw new Error(data?.error ?? 'We couldn’t read that page.');
      const m = data.meta;
      const { excerpt, trimmed } = makeExcerpt(m.description ?? '');
      setSource((s) => ({
        ...s,
        link: {
          ...s.link,
          status: 'done',
          error: null,
          fetchedUrl: url,
          title: m.title ?? '',
          excerpt,
          excerptTrimmed: trimmed,
          originalExcerpt: m.description ?? '',
          sourceName: m.siteName ?? '',
          author: m.author ?? '',
          canonicalUrl: m.canonicalUrl ?? m.url ?? null,
        },
      }));
      if (m.image) await setFromBlob('link', base64ToBlob(m.image.data, m.image.type));
      else remove('link');
      announce(m.title ? `Loaded “${m.title}”.` : 'Page loaded, but it has no title. Add one below.');
    } catch (e) {
      const message = e.name === 'TimeoutError' ? 'The page took too long to respond. Fill in the details below.' : e.message || 'We couldn’t read that page.';
      setSource((s) => ({ ...s, link: { ...s.link, status: 'error', error: message, fetchedUrl: url } }));
      announce(message);
    }
  }, [announce, setFromBlob, remove]);

  // ---- design actions ----------------------------------------------------
  const updateDesign = useCallback((patch) => setDesign((d) => ({ ...d, ...patch })), []);

  const resetAppearance = useCallback(() => {
    const base = defaultDesign();
    const layoutId = env && hasRenderableContent(content) ? selectLayout(content, base, env) : base.layoutId;
    setDesign({ ...base, layoutId: layoutId ?? base.layoutId });
    announce('Appearance reset to defaults.');
  }, [env, content, announce]);

  const clearCard = useCallback(() => {
    const snapshot = {
      source,
      design,
      blobs: Object.fromEntries(Object.entries(assets).filter(([, a]) => a.status === 'ready').map(([id, a]) => [id, a.blob])),
    };
    setSource(emptySource());
    setDesign((d) => ({ ...d, layoutLocked: false }));
    for (const id of Object.keys(assets)) remove(id);
    clearDraft();
    setStarted(false);
    setTab('content');
    setToast({
      text: 'Card cleared.',
      action: {
        label: 'Undo',
        run: () => {
          setSource(snapshot.source);
          setDesign(snapshot.design);
          for (const [id, blob] of Object.entries(snapshot.blobs)) setFromBlob(id, blob);
          setToast(null);
          announce('Card restored.');
        },
      },
    });
    announce('Card cleared. Undo is available for a few seconds.');
  }, [source, design, assets, remove, setFromBlob, announce]);

  // Text typed on the landing page starts a new card here (with Undo).
  useEffect(() => {
    const handoff = takeHandoff();
    if (!handoff) return;
    const previous = { source, design };
    const hadContent = hasRenderableContent(content);
    setSource({ ...emptySource(), text: { value: handoff.text, attribution: '', as: 'auto' } });
    setDesign((d) => ({ ...d, layoutLocked: false, ...(handoff.paletteId ? { paletteId: handoff.paletteId } : {}) }));
    if (hadContent) {
      setToast({
        text: 'Started a new card from your text.',
        action: { label: 'Undo', run: () => { setSource(previous.source); setDesign(previous.design); setToast(null); } },
      });
    }
    // Runs once on mount by design.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- custom palettes & pairings ----------------------------------------
  const saveStyle = useCallback((kind, value) => {
    const key = kind === 'palette' ? 'palettes' : 'fontPairs';
    setLibrary((lib) => {
      const exists = lib[key].some((x) => x.id === value.id);
      return { ...lib, [key]: exists ? lib[key].map((x) => (x.id === value.id ? value : x)) : [...lib[key], value] };
    });
    setDesign((d) => ({ ...d, [kind === 'palette' ? 'paletteId' : 'fontPairId']: value.id }));
    setDraftStyle(null);
    announce(`Saved “${value.label}”.`);
  }, [announce]);

  const deleteStyle = useCallback((kind, id) => {
    const key = kind === 'palette' ? 'palettes' : 'fontPairs';
    const field = kind === 'palette' ? 'paletteId' : 'fontPairId';
    const fallback = kind === 'palette' ? DEFAULT_PALETTE_ID : DEFAULT_FONT_PAIR_ID;
    const item = library[key].find((x) => x.id === id);
    const index = library[key].indexOf(item);
    const wasSelected = design[field] === id;
    setLibrary((lib) => ({ ...lib, [key]: lib[key].filter((x) => x.id !== id) }));
    if (wasSelected) setDesign((d) => ({ ...d, [field]: fallback }));
    setDraftStyle(null);
    if (!item) return;
    setToast({
      text: `Deleted “${item.label}”.`,
      action: {
        label: 'Undo',
        run: () => {
          setLibrary((lib) => {
            const list = [...lib[key]];
            list.splice(index, 0, item);
            return { ...lib, [key]: list };
          });
          if (wasSelected) setDesign((d) => ({ ...d, [field]: id }));
          setToast(null);
        },
      },
    });
    announce(`Deleted “${item.label}”.`);
  }, [library, design, announce]);

  // ---- shuffle -----------------------------------------------------------
  const shuffle = useCallback(() => {
    if (!env || !hasRenderableContent(content)) return;
    const previous = design;
    const next = shuffleDesign(content, design, { ...env, palettes: library.palettes, fontPairs: library.fontPairs });
    if (!next) {
      const msg = 'No other combination fits this content at this size. Try a taller size or shorter text.';
      setToast({ text: msg, level: 'error' });
      announce(msg);
      return;
    }
    setDraftStyle(null);
    setDesign(next);
    const summary = [
      getLayout(next.layoutId)?.label,
      getPalette(next.paletteId, library.palettes).label,
      getFontPair(next.fontPairId, library.fontPairs).label,
      getBackground(next.backgroundId).label,
    ].join(' · ');
    setToast({
      text: summary,
      action: {
        label: 'Undo',
        run: () => {
          setDesign(previous);
          setToast(null);
          announce('Previous design restored.');
        },
      },
    });
    announce(`Shuffled: ${summary}.`);
  }, [env, content, design, library, announce]);

  // ---- export ------------------------------------------------------------
  const runExport = useCallback(async () => {
    if (exporting || !env) return;
    setExporting(true);
    announce('Exporting…');
    try {
      const result = await exportCard({ schemaVersion: 1, content, design: shownDesign }, exportFormat, {
        env,
        images: imageElements,
        textures,
        ensureFonts: async () => {
          await loadFonts();
          await document.fonts.ready;
        },
        ensureImages: () => Promise.all(Object.values(imageElements).map((img) => img.decode?.().catch(() => {}))),
      });
      const msg = `Saved ${result.filename} (${result.width} × ${result.height}).`;
      setToast({ text: msg });
      announce(msg);
    } catch (e) {
      const msg = e instanceof ExportError ? e.message : 'Export failed unexpectedly. Your card is unchanged — try again.';
      setToast({ text: msg, level: 'error' });
      announce(msg);
    } finally {
      setExporting(false);
    }
  }, [exporting, env, content, shownDesign, exportFormat, imageElements, textures, announce]);

  const output = resolveOutput(shownDesign);
  const canExport = Boolean(scene?.ok && scene.fits && !exporting);
  const exportBlockReason = !renderable
    ? 'Add content to export.'
    : scene && !scene.fits
      ? 'Content doesn’t fit at this size.'
      : null;

  const exportControl = (
    <ExportControl
      format={exportFormat}
      onFormat={setExportFormat}
      onExport={runExport}
      exporting={exporting}
      disabled={!canExport}
      reason={exportBlockReason}
      output={output}
    />
  );

  const contentPanel = (
    <ContentPanel
      source={source}
      content={content}
      assets={assets}
      onMode={setMode}
      onChange={updateSource}
      onFetch={fetchLink}
      onImage={addImage}
      onRemoveImage={remove}
      compact={started}
    />
  );

  return (
    <div className={`app ${started ? 'is-editing' : 'is-empty'}`}>
      <Header
        started={started}
        sourceUrl={content.sourceUrl}
        onReset={resetAppearance}
        onClear={clearCard}
        onCopied={(ok) => announce(ok ? 'Source URL copied.' : 'Copy failed. Your browser blocked clipboard access.')}
        exportControl={started ? exportControl : null}
        onHome={() => onNavigate?.('/')}
        onShuffle={shuffle}
      />

      {!started ? (
        <main className="composer" id="main">
          <div className="composer-inner">
            <h1 className="composer-title">Paste anything.<br /><span>Get a card.</span></h1>
            <p className="composer-lede">A link, a quote, a paragraph, an image or a snippet of code. carrd composes it; you choose the finish.</p>
            {contentPanel}
          </div>
        </main>
      ) : (
        <main className="editor" id="main">
          <section className="stage" aria-label="Preview">
            <Preview
              scene={scene}
              images={imageElements}
              textures={textures}
              output={output}
              content={deferredContent}
              fontsReady={fontsReady}
              fontWarning={fontsFailed.length ? `Some fonts failed to load (${fontsFailed.map((f) => f.replace('Carrd ', '')).join(', ')}); system fonts are used instead.` : null}
            />
          </section>
          <aside className="panel" aria-label="Card settings">
            <div className="tabs" role="tablist" aria-label="Panel">
              {['content', 'design'].map((t) => (
                <button
                  key={t}
                  role="tab"
                  id={`tab-${t}`}
                  aria-selected={tab === t}
                  aria-controls={`tabpanel-${t}`}
                  className="tab"
                  onClick={() => setTab(t)}
                >
                  {t === 'content' ? 'Content' : 'Design'}
                </button>
              ))}
            </div>
            <div role="tabpanel" id="tabpanel-content" aria-labelledby="tab-content" hidden={tab !== 'content'} className="tabpanel">
              {contentPanel}
            </div>
            <div role="tabpanel" id="tabpanel-design" aria-labelledby="tab-design" hidden={tab !== 'design'} className="tabpanel">
              <DesignPanel
                design={shownDesign}
                library={library}
                draftStyle={draftStyle}
                onDraftStyle={setDraftStyle}
                onSaveStyle={saveStyle}
                onDeleteStyle={deleteStyle}
                content={deferredContent}
                env={env}
                scene={scene}
                images={imageElements}
                textures={textures}
                assets={assets}
                onChange={updateDesign}
                onBackgroundImage={(file) => addImage('background', file)}
                onRemoveBackgroundImage={() => {
                  remove('background');
                  if (design.backgroundId === 'photo') updateDesign({ backgroundId: 'paper' });
                }}
              />
            </div>
            {storageWarning && <p className="note note-warn panel-note">{storageWarning}</p>}
          </aside>
          <div className="mobile-bar">{exportControl}</div>
        </main>
      )}

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div className="sr-only" role="status" aria-live="polite">{announcement}</div>
    </div>
  );
}
