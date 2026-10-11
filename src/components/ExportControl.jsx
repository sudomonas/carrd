import { EXPORT_FORMATS } from '../render/export.js';

export default function ExportControl({ format, onFormat, onExport, exporting, disabled, reason, output }) {
  return (
    <div className="export">
      <div className="segmented segmented-sm" role="radiogroup" aria-label="File format">
        {EXPORT_FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="radio"
            aria-checked={format === f.id}
            className="seg"
            onClick={() => onFormat(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-primary export-btn"
        onClick={onExport}
        disabled={disabled}
        aria-busy={exporting}
        title={reason ?? `Download ${output.width} × ${output.height} ${format.toUpperCase()}`}
      >
        {exporting ? (
          <>
            <span className="spinner" aria-hidden="true" /> Exporting
          </>
        ) : (
          <>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 2.5v7.5M4.5 6.5 8 10l3.5-3.5M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Export
          </>
        )}
      </button>
      {reason && <span className="sr-only">{reason}</span>}
    </div>
  );
}
