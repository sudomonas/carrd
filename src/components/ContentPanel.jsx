import { useId, useRef, useState } from 'react';
import { INPUT_MODES, looksLikeCode, looksLikeUrl, parseText, toAbsoluteUrl, EXCERPT_LIMIT } from '../model/input.js';
import { LANGUAGES, detectLanguage, languageLabel } from '../engine/code.js';
import { ACCEPTED_TYPES } from '../render/images.js';

function Field({ label, hint, children, id }) {
  return (
    <div className="field">
      <label htmlFor={id} className="label">
        {label}
        {hint && <span className="label-hint">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

function TextInput({ label, hint, value, onChange, ...rest }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <input id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)} {...rest} />
    </Field>
  );
}

function TextArea({ label, hint, value, onChange, rows = 4, describedBy, ...rest }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} id={id}>
      <textarea id={id} className="input textarea" rows={rows} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} {...rest} />
    </Field>
  );
}

function Segmented({ label, options, value, onChange }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} className="seg" onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ImageDrop({ asset, onFile, onRemove, label = 'Upload an image' }) {
  const inputRef = useRef(null);
  const [error, setError] = useState(null);
  const [drag, setDrag] = useState(false);
  const errId = useId();

  const take = async (file) => {
    setError(null);
    const msg = await onFile(file);
    if (msg) setError(msg);
  };

  const status = asset?.status;
  return (
    <div className="image-drop-wrap">
      {status === 'ready' ? (
        <div className="image-chip">
          <img src={asset.url} alt="" />
          <div className="image-chip-meta">
            <span>{asset.width} × {asset.height}</span>
            <div className="image-chip-actions">
              <button type="button" className="link-btn" onClick={() => inputRef.current?.click()}>Replace</button>
              <button type="button" className="link-btn" onClick={onRemove}>Remove</button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`image-drop ${drag ? 'is-drag' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) take(f); }}
          aria-describedby={error ? errId : undefined}
          disabled={status === 'loading'}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M12 16V5m0 0L7.5 9.5M12 5l4.5 4.5M5 19h14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          <span>{status === 'loading' ? 'Reading image…' : label}</span>
          <small>PNG, JPEG, WebP, GIF or AVIF · up to 15 MB</small>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) take(f); }}
      />
      {(error || status === 'error') && <p className="note note-error" id={errId}>{error ?? asset.error}</p>}
    </div>
  );
}

function TextMode({ s, onChange, onSwitchToLink, onSwitchToCode }) {
  const parsed = s.value.trim() ? parseText(s.value, s.attribution, 'auto') : null;
  const detected = parsed?.kind === 'quote' ? 'Quote' : 'Post';
  const isUrl = looksLikeUrl(s.value);
  const isCode = !isUrl && looksLikeCode(s.value);
  return (
    <div className="stack">
      <TextArea
        label="Text"
        hint="Quote, thought or short post"
        value={s.value}
        onChange={(v) => onChange({ value: v })}
        rows={5}
        placeholder={'“Simplicity is prerequisite for reliability.”\n— Edsger W. Dijkstra'}
      />
      {isUrl && (
        <div className="suggest">
          <span>This looks like a link.</span>
          <button type="button" className="btn btn-sm" onClick={() => onSwitchToLink(s.value.trim())}>Fetch link details</button>
        </div>
      )}
      {isCode && (
        <div className="suggest">
          <span>This looks like code.</span>
          <button type="button" className="btn btn-sm" onClick={() => onSwitchToCode(s.value)}>Use a code card</button>
        </div>
      )}
      {s.value.trim() && !isUrl && (
        <>
          <TextInput label="Attribution" hint="Optional" value={s.attribution} onChange={(v) => onChange({ attribution: v })} placeholder="Author or speaker" />
          <div className="field">
            <span className="label" id="read-as">Read as</span>
            <Segmented
              label="Read text as"
              value={s.as}
              onChange={(v) => onChange({ as: v })}
              options={[{ id: 'auto', label: `Auto · ${detected}` }, { id: 'quote', label: 'Quote' }, { id: 'post', label: 'Post' }]}
            />
          </div>
        </>
      )}
    </div>
  );
}

function LinkMode({ s, onChange, onFetch, asset, onImage, onRemoveImage }) {
  const [manual, setManual] = useState(false);
  const loading = s.status === 'loading';
  const valid = looksLikeUrl(s.url);
  const showFields = manual || s.status === 'done' || s.status === 'error' || s.title || s.excerpt;
  const noteId = useId();
  const submit = (e) => {
    e.preventDefault();
    if (valid && !loading) onFetch(toAbsoluteUrl(s.url));
  };
  return (
    <div className="stack">
      <form className="url-row" onSubmit={submit}>
        <TextInput
          label="Article URL"
          value={s.url}
          onChange={(v) => onChange({ url: v })}
          placeholder="https://example.com/article"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          aria-describedby={noteId}
          aria-invalid={s.url.trim() !== '' && !valid}
        />
        <button type="submit" className="btn" disabled={!valid || loading} aria-busy={loading}>
          {loading ? <><span className="spinner" aria-hidden="true" /> Fetching</> : 'Fetch'}
        </button>
      </form>
      <p className="hint" id={noteId}>
        Fetching sends this URL to carrd’s metadata service, which reads the page’s public title, description and image.
      </p>
      {s.url.trim() && !valid && <p className="note note-error">Enter a full web address, such as https://example.com/post.</p>}
      {s.status === 'error' && (
        <p className="note note-error" role="alert">
          {s.error} {s.fetchedUrl && <span className="mono-inline">{s.fetchedUrl}</span>}
        </p>
      )}
      {!showFields && (
        <button type="button" className="link-btn" onClick={() => setManual(true)}>Enter details manually</button>
      )}
      {showFields && (
        <>
          <TextInput label="Title" value={s.title} onChange={(v) => onChange({ title: v })} placeholder="Headline" />
          <TextArea
            label="Excerpt"
            hint={`${s.excerpt.length} chars`}
            value={s.excerpt}
            onChange={(v) => onChange({ excerpt: v, excerptTrimmed: false })}
            rows={4}
          />
          {s.excerptTrimmed && (
            <p className="hint">
              Trimmed from {s.originalExcerpt.length} to about {EXCERPT_LIMIT} characters at a sentence break. Edit it freely.{' '}
              <button type="button" className="link-btn" onClick={() => onChange({ excerpt: s.originalExcerpt, excerptTrimmed: false })}>Use full text</button>
            </p>
          )}
          <div className="row-2">
            <TextInput label="Source" value={s.sourceName} onChange={(v) => onChange({ sourceName: v })} placeholder="Publication" />
            <TextInput label="Author" value={s.author} onChange={(v) => onChange({ author: v })} placeholder="Optional" />
          </div>
          <div className="field">
            <span className="label">Thumbnail <span className="label-hint">Optional</span></span>
            <ImageDrop asset={asset} onFile={(f) => onImage('link', f)} onRemove={() => onRemoveImage('link')} label="Add a thumbnail" />
          </div>
        </>
      )}
    </div>
  );
}

function ImageMode({ s, onChange, asset, onImage, onRemoveImage }) {
  return (
    <div className="stack">
      <ImageDrop asset={asset} onFile={(f) => onImage('upload', f)} onRemove={() => onRemoveImage('upload')} />
      <TextInput label="Caption" hint="Optional" value={s.caption} onChange={(v) => onChange({ caption: v })} placeholder="A line about the image" />
      <TextInput label="Credit" hint="Optional" value={s.credit} onChange={(v) => onChange({ credit: v })} placeholder="Photographer or source" />
    </div>
  );
}

function CodeMode({ s, onChange }) {
  const detected = detectLanguage(s.value);
  return (
    <div className="stack">
      <TextInput label="Title" hint="Optional" value={s.title} onChange={(v) => onChange({ title: v })} placeholder="What this snippet does" />
      <div className="field">
        <label className="label" htmlFor="code-lang">Language</label>
        <select id="code-lang" className="input select" value={s.language} onChange={(e) => onChange({ language: e.target.value })}>
          <option value="auto">Auto{detected ? ` · ${languageLabel(detected)}` : ''}</option>
          {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
        </select>
      </div>
      <TextArea label="Code" value={s.value} onChange={(v) => onChange({ value: v })} rows={9} className="input textarea code-input" spellCheck={false} placeholder={'function greet(name) {\n  return `Hello, ${name}`;\n}'} />
      <p className="hint">Code is never edited. Long lines wrap with a marker.</p>
    </div>
  );
}

function ListMode({ s, onChange }) {
  return (
    <div className="stack">
      <TextInput label="Title" hint="Optional" value={s.title} onChange={(v) => onChange({ title: v })} placeholder="Three things worth knowing" />
      <TextArea label="Items" hint="One per line" value={s.value} onChange={(v) => onChange({ value: v })} rows={6} placeholder={'Small tools stay maintained\nDefaults matter more than options\nShip the boring version first'} />
    </div>
  );
}

export default function ContentPanel({ source, assets, onMode, onChange, onFetch, onImage, onRemoveImage, compact }) {
  const mode = source.mode;
  const set = (m) => (patch) => onChange(m, patch);
  return (
    <div className={`content-panel ${compact ? 'is-compact' : ''}`}>
      <div className="mode-tabs" role="radiogroup" aria-label="Content type">
        {INPUT_MODES.map((m) => (
          <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} className="mode-tab" onClick={() => onMode(m.id)}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="mode-body" key={mode}>
        {mode === 'text' && (
          <TextMode
            s={source.text}
            onChange={set('text')}
            onSwitchToLink={(url) => { onChange('text', { value: '' }); onMode('link'); onChange('link', { url }); onFetch(toAbsoluteUrl(url)); }}
            onSwitchToCode={(code) => { onChange('code', { value: code }); onChange('text', { value: '' }); onMode('code'); }}
          />
        )}
        {mode === 'link' && <LinkMode s={source.link} onChange={set('link')} onFetch={onFetch} asset={assets.link} onImage={onImage} onRemoveImage={onRemoveImage} />}
        {mode === 'image' && <ImageMode s={source.image} onChange={set('image')} asset={assets.upload} onImage={onImage} onRemoveImage={onRemoveImage} />}
        {mode === 'code' && <CodeMode s={source.code} onChange={set('code')} />}
        {mode === 'list' && <ListMode s={source.list} onChange={set('list')} />}
      </div>
    </div>
  );
}
