import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { LAYOUTS } from '../engine/layouts/index.js';
import { composeCard, eligibility, selectLayout } from '../engine/compose.js';
import { PALETTES, getPalette } from '../config/palettes.js';
import { FONT_PAIRS } from '../config/typography.js';
import { BACKGROUNDS } from '../config/backgrounds.js';
import { OUTPUT_PRESETS, CUSTOM_LIMITS, validateCustomSize } from '../config/outputs.js';
import { ACCEPTED_TYPES } from '../render/images.js';
import SceneCanvas from './SceneCanvas.jsx';
import { PaletteEditor, FontPairEditor } from './StyleEditors.jsx';
import { LIBRARY_LIMIT, newId } from '../model/library.js';

const Check = () => (
  <svg className="check" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path d="M3.5 8.5 6.5 11.5 12.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Section({ title, aside, children, id }) {
  return (
    <section className="control" aria-labelledby={id}>
      <div className="control-head">
        <h2 className="control-title" id={id}>{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

const THUMB_WIDTH = 84;

function LayoutControl({ design, content, env, scene, images, texture, onChange }) {
  // Real miniatures: each eligible layout composed with the current content.
  const thumbs = useMemo(() => {
    if (!env) return [];
    const base = { ...design };
    return LAYOUTS.filter((l) => eligibility(l, content, base, env).ok).map((l) => ({
      layout: l,
      scene: composeCard({ content, design: base }, env, { layoutId: l.id, fallback: false }),
    }));
    // design.layoutId intentionally excluded: thumbnails don't depend on it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, env, design.paletteId, design.fontPairId, design.backgroundId, design.outputPresetId, design.custom]);

  const active = scene?.layoutId ?? design.layoutId;
  const auto = !design.layoutLocked;
  return (
    <Section
      title="Layout"
      id="ctl-layout"
      aside={
        auto ? (
          <span className="badge" title="carrd picks the layout that suits your content">Auto</span>
        ) : (
          <button
            type="button"
            className="link-btn"
            onClick={() => onChange({ layoutId: selectLayout(content, design, env) ?? design.layoutId, layoutLocked: false })}
          >
            Use auto
          </button>
        )
      }
    >
      <div className="thumbs" role="radiogroup" aria-labelledby="ctl-layout">
        {thumbs.map(({ layout, scene: s }) => (
          <button
            key={layout.id}
            type="button"
            role="radio"
            aria-checked={active === layout.id}
            className="thumb"
            onClick={() => onChange({ layoutId: layout.id, layoutLocked: true })}
            title={layout.description}
          >
            <span className="thumb-frame" style={{ width: THUMB_WIDTH }}>
              {s.ok && <SceneCanvas scene={s} displayWidth={THUMB_WIDTH} images={images} texture={texture} />}
              {!s.fits && <span className="thumb-warn" title="Doesn't fit at this size">!</span>}
            </span>
            <span className="thumb-label">
              {active === layout.id && <Check />}
              {layout.label}
            </span>
          </button>
        ))}
      </div>
      {thumbs.length < LAYOUTS.length && (
        <p className="hint">{LAYOUTS.length - thumbs.length} layouts hidden because they don’t suit this content.</p>
      )}
    </Section>
  );
}


const Plus = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
);

/** Shared behaviour for a library-backed control (palettes, pairings). */
function useStyleEditing(kind, onDraftStyle) {
  const [editing, setEditing] = useState(null); // { isNew, initial }
  const onDraft = useCallback((value) => onDraftStyle({ kind, value }), [kind, onDraftStyle]);
  const close = useCallback(() => {
    setEditing(null);
    onDraftStyle(null);
  }, [onDraftStyle]);
  return { editing, setEditing, onDraft, close };
}

function PaletteControl({ value, library, onChange, onDraftStyle, onSaveStyle, onDeleteStyle }) {
  const { editing, setEditing, onDraft, close } = useStyleEditing('palette', onDraftStyle);
  const all = [...PALETTES, ...library.palettes];
  const selectedCustom = library.palettes.find((p) => p.id === value);
  const full = library.palettes.length >= LIBRARY_LIMIT;

  const startNew = () => {
    const base = getPalette(value, library.palettes);
    setEditing({ isNew: true, initial: { id: newId('custom'), label: `My palette ${library.palettes.length + 1}`, tone: 'custom', custom: true, roles: { ...base.roles } } });
  };

  return (
    <Section
      title="Palette"
      id="ctl-palette"
      aside={selectedCustom && !editing ? (
        <button type="button" className="link-btn" onClick={() => setEditing({ isNew: false, initial: selectedCustom })}>Edit “{selectedCustom.label}”</button>
      ) : null}
    >
      <div className="swatches" role="radiogroup" aria-labelledby="ctl-palette">
        {all.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={value === p.id}
            className="swatch"
            onClick={() => {
              close();
              onChange({ paletteId: p.id });
            }}
            title={`${p.label}${p.custom ? ' (yours)' : ` (${p.tone})`}`}
          >
            <span className="swatch-chip" style={{ background: p.roles.canvas, borderColor: p.roles.divider }}>
              <span className="swatch-text" style={{ background: p.roles.text }} />
              <span className="swatch-accent" style={{ background: p.roles.accent }} />
              {value === p.id && <span className="swatch-check" style={{ color: p.roles.text }}><Check /></span>}
            </span>
            <span className="swatch-label">{p.label}</span>
          </button>
        ))}
        <button type="button" className="swatch swatch-new" onClick={startNew} disabled={full || Boolean(editing)} title={full ? `Up to ${LIBRARY_LIMIT} palettes` : 'Create a palette'}>
          <span className="swatch-chip"><Plus /></span>
          <span className="swatch-label">New</span>
        </button>
      </div>
      {editing && (
        <PaletteEditor
          key={editing.initial.id}
          initial={editing.initial}
          isNew={editing.isNew}
          library={library}
          onDraft={onDraft}
          onCancel={close}
          onSave={(p) => {
            onSaveStyle('palette', p);
            setEditing(null);
          }}
          onDelete={() => {
            onDeleteStyle('palette', editing.initial.id);
            setEditing(null);
          }}
        />
      )}
    </Section>
  );
}

function TypeControl({ value, library, onChange, onDraftStyle, onSaveStyle, onDeleteStyle }) {
  const { editing, setEditing, onDraft, close } = useStyleEditing('fontPair', onDraftStyle);
  const all = [...FONT_PAIRS, ...library.fontPairs];
  const selectedCustom = library.fontPairs.find((f) => f.id === value);
  const full = library.fontPairs.length >= LIBRARY_LIMIT;

  const startNew = () => {
    setEditing({ isNew: true, initial: { id: newId('customfont'), label: `My pairing ${library.fontPairs.length + 1}`, spec: { display: 'fraunces', text: 'inter', code: 'jetbrains-mono' } } });
  };

  return (
    <Section
      title="Typography"
      id="ctl-type"
      aside={selectedCustom && !editing ? (
        <button type="button" className="link-btn" onClick={() => setEditing({ isNew: false, initial: selectedCustom })}>Edit “{selectedCustom.label}”</button>
      ) : null}
    >
      <div className="type-grid" role="radiogroup" aria-labelledby="ctl-type">
        {all.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={value === f.id}
            className="type-option"
            onClick={() => {
              close();
              onChange({ fontPairId: f.id });
            }}
          >
            <span className="type-sample" aria-hidden="true" style={{ fontFamily: `"${f.display.family}", ${f.display.fallback}`, fontWeight: f.display.weight }}>
              Aa
            </span>
            <span className="type-text">
              <span className="type-label">{f.label}{value === f.id && <Check />}</span>
              <span className="type-note">{f.note}</span>
            </span>
          </button>
        ))}
        <button type="button" className="type-option type-new" onClick={startNew} disabled={full || Boolean(editing)} title={full ? `Up to ${LIBRARY_LIMIT} pairings` : 'Create a pairing'}>
          <span className="type-sample" aria-hidden="true"><Plus /></span>
          <span className="type-text">
            <span className="type-label">New pairing</span>
            <span className="type-note">Mix bundled fonts</span>
          </span>
        </button>
      </div>
      {editing && (
        <FontPairEditor
          key={editing.initial.id}
          initial={editing.initial}
          isNew={editing.isNew}
          onDraft={onDraft}
          onCancel={close}
          onSave={(f) => {
            onSaveStyle('fontPair', f);
            setEditing(null);
          }}
          onDelete={() => {
            onDeleteStyle('fontPair', editing.initial.id);
            setEditing(null);
          }}
        />
      )}
    </Section>
  );
}

function BackgroundControl({ value, content, assets, onChange, onUpload, onRemove }) {
  const fileRef = useRef(null);
  const [error, setError] = useState(null);
  const hasPhoto = assets.background?.status === 'ready';
  const loading = assets.background?.status === 'loading';
  const hasSource = Boolean(content.image);
  const hintId = useId();

  const pick = async (file) => {
    setError(null);
    const msg = await onUpload(file);
    if (msg) setError(msg);
    else onChange({ backgroundId: 'photo' });
  };

  return (
    <Section title="Background" id="ctl-bg">
      <div className="chips" role="radiogroup" aria-labelledby="ctl-bg">
        {BACKGROUNDS.map((b) => {
          const disabled = b.id === 'source' && !hasSource;
          const label = b.id === 'photo' && !hasPhoto ? (loading ? 'Reading…' : 'Photo…') : b.label;
          return (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={value === b.id}
              className="chip"
              disabled={disabled || (b.id === 'photo' && loading)}
              aria-describedby={disabled ? hintId : undefined}
              onClick={() => {
                if (b.id === 'photo' && !hasPhoto) fileRef.current?.click();
                else onChange({ backgroundId: b.id });
              }}
            >
              {value === b.id && <Check />}
              {label}
            </button>
          );
        })}
      </div>
      {!hasSource && <p className="hint" id={hintId}>Source image is available when the content has an image.</p>}
      {hasPhoto && (
        <div className="inline-actions">
          <img src={assets.background.url} alt="" className="mini-thumb" />
          <button type="button" className="link-btn" onClick={() => fileRef.current?.click()}>Replace photo</button>
          <button type="button" className="link-btn" onClick={onRemove}>Remove</button>
        </div>
      )}
      {error && <p className="note note-error">{error}</p>}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) pick(f); }}
      />
    </Section>
  );
}

function SizeControl({ design, onChange }) {
  const [w, setW] = useState(String(design.custom.width));
  const [h, setH] = useState(String(design.custom.height));
  const [error, setError] = useState(null);
  const errId = useId();

  useEffect(() => {
    setW(String(design.custom.width));
    setH(String(design.custom.height));
  }, [design.custom.width, design.custom.height]);

  // Applies valid sizes immediately; invalid input keeps the last valid size.
  const update = (nw, nh) => {
    setW(nw);
    setH(nh);
    const v = validateCustomSize(nw, nh);
    if (v.ok) {
      setError(null);
      onChange({ outputPresetId: 'custom', custom: { width: v.width, height: v.height } });
    } else setError(v.error);
  };

  const custom = design.outputPresetId === 'custom';
  return (
    <Section title="Size" id="ctl-size">
      <div className="sizes" role="radiogroup" aria-labelledby="ctl-size">
        {[...OUTPUT_PRESETS, { id: 'custom', label: 'Custom', width: design.custom.width, height: design.custom.height }].map((p) => {
          const ratio = p.width / p.height;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={design.outputPresetId === p.id}
              className="size"
              onClick={() => onChange({ outputPresetId: p.id })}
            >
              <span className="size-shape" aria-hidden="true">
                <span style={{ width: ratio >= 1 ? 22 : 22 * ratio, height: ratio >= 1 ? 22 / ratio : 22 }} />
              </span>
              <span className="size-label">{p.label}</span>
              <span className="size-dims">{p.width}×{p.height}</span>
            </button>
          );
        })}
      </div>
      {custom && (
        <div className="custom-size">
          <label className="field-inline">
            <span className="label">Width</span>
            <input className="input" inputMode="numeric" value={w} onChange={(e) => update(e.target.value.replace(/\D/g, ''), h)} aria-invalid={Boolean(error)} aria-describedby={error ? errId : undefined} />
          </label>
          <span className="times" aria-hidden="true">×</span>
          <label className="field-inline">
            <span className="label">Height</span>
            <input className="input" inputMode="numeric" value={h} onChange={(e) => update(w, e.target.value.replace(/\D/g, ''))} aria-invalid={Boolean(error)} aria-describedby={error ? errId : undefined} />
          </label>
        </div>
      )}
      {custom && (
        <p className={error ? 'note note-error' : 'hint'} id={errId} role={error ? 'alert' : undefined}>
          {error
            ? `${error} Keeping ${design.custom.width} × ${design.custom.height}.`
            : `${CUSTOM_LIMITS.minSide}–${CUSTOM_LIMITS.maxSide} px per side, up to ${CUSTOM_LIMITS.maxArea / 1e6} MP.`}
        </p>
      )}
    </Section>
  );
}

export default function DesignPanel({ design, library, onDraftStyle, onSaveStyle, onDeleteStyle, content, env, scene, images, texture, assets, onChange, onBackgroundImage, onRemoveBackgroundImage }) {
  const styleProps = { library, onChange, onDraftStyle, onSaveStyle, onDeleteStyle };
  return (
    <div className="design-panel">
      <LayoutControl design={design} content={content} env={env} scene={scene} images={images} texture={texture} onChange={onChange} />
      <PaletteControl value={design.paletteId} {...styleProps} />
      <TypeControl value={design.fontPairId} {...styleProps} />
      <BackgroundControl
        value={design.backgroundId}
        content={content}
        assets={assets}
        onChange={onChange}
        onUpload={onBackgroundImage}
        onRemove={onRemoveBackgroundImage}
      />
      <SizeControl design={design} onChange={onChange} />
    </div>
  );
}
