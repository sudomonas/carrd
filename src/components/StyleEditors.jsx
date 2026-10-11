import { useEffect, useId, useState } from 'react';
import { PALETTES, PALETTE_ROLES } from '../config/palettes.js';
import { FONT_PAIRS } from '../config/typography.js';
import { FAMILIES, CODE_FAMILIES, buildFontPair, getFamily } from '../config/typography.js';

/** Case-insensitive check against every other entry's name. */
const nameTaken = (name, id, entries) => entries.some((e) => e.id !== id && e.label.trim().toLowerCase() === name.trim().toLowerCase());
import { NAME_LIMIT, paletteChecks } from '../model/library.js';

const HEX = /^#[0-9a-f]{6}$/i;

function HexField({ role, value, onChange }) {
  const [text, setText] = useState(value);
  const id = useId();
  useEffect(() => setText(value), [value]);
  return (
    <div className="role">
      <input
        type="color"
        className="role-picker"
        value={value.toLowerCase()}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        aria-label={`${role.label} colour picker`}
      />
      <label htmlFor={id} className="role-label">{role.label}</label>
      <input
        id={id}
        className="input role-hex"
        value={text}
        maxLength={7}
        spellCheck={false}
        aria-invalid={!HEX.test(text)}
        onChange={(e) => {
          const v = e.target.value.trim();
          const withHash = v.startsWith('#') ? v : `#${v}`;
          setText(withHash);
          if (HEX.test(withHash)) onChange(withHash.toUpperCase());
        }}
        onBlur={() => setText(value)}
      />
    </div>
  );
}

function EditorActions({ isNew, onCancel, onSave, onDelete, saveLabel, canSave }) {
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="style-editor-actions">
      {!isNew && (
        <button
          type="button"
          className={`link-btn danger-link ${confirm ? 'is-confirm' : ''}`}
          onClick={() => (confirm ? onDelete() : setConfirm(true))}
          onBlur={() => setConfirm(false)}
        >
          {confirm ? 'Click again to delete' : 'Delete'}
        </button>
      )}
      <span className="spacer" />
      <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
      <button type="button" className="btn btn-sm btn-primary" onClick={onSave} disabled={!canSave}>{saveLabel}</button>
    </div>
  );
}

/**
 * Edits a palette's six semantic roles. Every change is previewed live on
 * the card through `onDraft`; nothing is stored until Save.
 */
export function PaletteEditor({ initial, isNew, library, onDraft, onSave, onCancel, onDelete }) {
  const [palette, setPalette] = useState(initial);
  const nameId = useId();
  useEffect(() => onDraft(palette), [palette, onDraft]);

  const setRole = (role, hex) => setPalette((p) => ({ ...p, roles: { ...p.roles, [role]: hex } }));
  const checks = paletteChecks(palette.roles);
  const taken = nameTaken(palette.label, palette.id, [...PALETTES, ...library.palettes]);
  const sources = [...PALETTES, ...library.palettes.filter((p) => p.id !== palette.id)];

  return (
    <div className="style-editor" role="group" aria-labelledby={`${nameId}-title`}>
      <div className="style-editor-head">
        <h3 id={`${nameId}-title`}>{isNew ? 'New palette' : 'Edit palette'}</h3>
        <span className="live-dot">Live preview</span>
      </div>
      <div className="row-2">
        <div className="field">
          <label className="label" htmlFor={nameId}>Name</label>
          <input id={nameId} className="input" value={palette.label} maxLength={NAME_LIMIT} aria-invalid={taken} aria-describedby={taken ? `${nameId}-taken` : undefined} onChange={(e) => setPalette((p) => ({ ...p, label: e.target.value }))} />
          {taken && <span className="field-error" id={`${nameId}-taken`}>That name is already used.</span>}
        </div>
        <div className="field">
          <label className="label" htmlFor={`${nameId}-from`}>Start from</label>
          <select
            id={`${nameId}-from`}
            className="input select"
            value=""
            onChange={(e) => {
              const src = sources.find((p) => p.id === e.target.value);
              if (src) setPalette((p) => ({ ...p, roles: { ...src.roles } }));
            }}
          >
            <option value="" disabled>Copy colours…</option>
            {sources.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div className="roles">
        {PALETTE_ROLES.map((r) => (
          <HexField key={r.id} role={r} value={palette.roles[r.id]} onChange={(hex) => setRole(r.id, hex)} />
        ))}
      </div>
      <ul className="checks" aria-label="Contrast checks">
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? 'ok' : 'warn'}>
            <span>{c.label}</span>
            <span className="ratio">
              {c.ratio.toFixed(1)}:1 {c.ok ? '✓' : `· needs ${c.min}`}
            </span>
          </li>
        ))}
      </ul>
      <EditorActions
        isNew={isNew}
        canSave={palette.label.trim().length > 0 && !taken}
        saveLabel={isNew ? 'Save palette' : 'Save changes'}
        onCancel={onCancel}
        onDelete={onDelete}
        onSave={() => onSave({ ...palette, label: palette.label.trim() })}
      />
    </div>
  );
}

function FamilySelect({ label, value, onChange, options }) {
  const id = useId();
  const groups = [...new Set(options.map((f) => f.category))];
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      <select id={id} className="input select" value={value} onChange={(e) => onChange(e.target.value)}>
        {groups.map((g) => (
          <optgroup key={g} label={g}>
            {options.filter((f) => f.category === g).map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

/** Builds a pairing from bundled families; sizes stay with the engine. */
export function FontPairEditor({ initial, isNew, library, onDraft, onSave, onCancel, onDelete }) {
  const [label, setLabel] = useState(initial.label);
  const [spec, setSpec] = useState(initial.spec);
  const nameId = useId();
  const pair = buildFontPair({ id: initial.id, label: label.trim() || 'My pairing', ...spec });
  useEffect(() => onDraft(buildFontPair({ id: initial.id, label: label.trim() || 'My pairing', ...spec })), [label, spec, initial.id, onDraft]);

  const taken = nameTaken(label, initial.id, [...FONT_PAIRS, ...library.fontPairs]);
  const css = (face) => ({ fontFamily: `"${face.family}", ${face.fallback}`, fontWeight: face.weight, fontStyle: face.style ?? 'normal' });
  return (
    <div className="style-editor" role="group" aria-labelledby={`${nameId}-title`}>
      <div className="style-editor-head">
        <h3 id={`${nameId}-title`}>{isNew ? 'New pairing' : 'Edit pairing'}</h3>
        <span className="live-dot">Live preview</span>
      </div>
      <div className="field">
        <label className="label" htmlFor={nameId}>Name</label>
        <input id={nameId} className="input" value={label} maxLength={NAME_LIMIT} aria-invalid={taken} aria-describedby={taken ? `${nameId}-taken` : undefined} onChange={(e) => setLabel(e.target.value)} />
        {taken && <span className="field-error" id={`${nameId}-taken`}>That name is already used.</span>}
      </div>
      <div className="row-2">
        <FamilySelect label="Headline" value={spec.display} options={FAMILIES} onChange={(display) => setSpec((s) => ({ ...s, display }))} />
        <FamilySelect label="Body" value={spec.text} options={FAMILIES} onChange={(text) => setSpec((s) => ({ ...s, text }))} />
      </div>
      <FamilySelect label="Code" value={spec.code} options={CODE_FAMILIES} onChange={(code) => setSpec((s) => ({ ...s, code }))} />
      <div className="type-specimen" aria-hidden="true">
        <span className="specimen-meta" style={{ ...css(pair.meta), letterSpacing: `${pair.meta.tracking}em` }}>{getFamily(spec.text).label.toUpperCase()}</span>
        <span className="specimen-head" style={css(pair.display)}>Small tools win</span>
        <span className="specimen-quote" style={css(pair.quote)}>“Less, but better.”</span>
        <span className="specimen-body" style={css(pair.text)}>Focused tools outlast sprawling suites because they do one thing well.</span>
        <span className="specimen-code" style={css(pair.mono)}>{'const card = compose(content);'}</span>
      </div>
      <EditorActions
        isNew={isNew}
        canSave={label.trim().length > 0 && !taken}
        saveLabel={isNew ? 'Save pairing' : 'Save changes'}
        onCancel={onCancel}
        onDelete={onDelete}
        onSave={() => onSave(buildFontPair({ id: initial.id, label: label.trim(), ...spec }))}
      />
    </div>
  );
}
