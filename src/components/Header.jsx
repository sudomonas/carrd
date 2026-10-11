import { useEffect, useRef, useState } from 'react';
import ThemeToggle from './ThemeToggle.jsx';

function ShuffleButton({ onShuffle }) {
  const [rolling, setRolling] = useState(false);
  return (
    <button
      type="button"
      className={`btn btn-icon shuffle-btn ${rolling ? 'is-rolling' : ''}`}
      onClick={() => {
        setRolling((r) => !r);
        onShuffle();
      }}
      aria-label="Shuffle design"
      title="Random layout, palette, typography and background"
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
        <rect x="2.25" y="2.25" width="11.5" height="11.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="5.4" cy="5.4" r="1.05" fill="currentColor" />
        <circle cx="10.6" cy="5.4" r="1.05" fill="currentColor" />
        <circle cx="8" cy="8" r="1.05" fill="currentColor" />
        <circle cx="5.4" cy="10.6" r="1.05" fill="currentColor" />
        <circle cx="10.6" cy="10.6" r="1.05" fill="currentColor" />
      </svg>
      <span className="shuffle-label">Shuffle</span>
    </button>
  );
}

export default function Header({ started, sourceUrl, onReset, onClear, onCopied, exportControl, onHome, onShuffle }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!menuRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
    menuRef.current?.querySelector('button')?.focus();
    return () => {
      document.removeEventListener('pointerdown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...menuRef.current.querySelectorAll('button')];
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  };

  const run = (fn) => () => {
    setOpen(false);
    fn();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sourceUrl);
      onCopied(true);
    } catch {
      onCopied(false);
    }
  };

  return (
    <header className="header">
      <div className="header-brand">
        <a
          className="wordmark"
          href="/"
          aria-label="carrd home"
          onClick={(e) => {
            if (!onHome || e.metaKey || e.ctrlKey) return;
            e.preventDefault();
            onHome();
          }}
        >
          carrd<span aria-hidden="true">.</span>
        </a>
        <span className="header-crumb" aria-hidden="true">Studio</span>
      </div>
      <div className="header-actions">
        {started && onShuffle && <ShuffleButton onShuffle={onShuffle} />}
        <ThemeToggle />
        {started && (
          <div className="menu-wrap">
            <button
              ref={buttonRef}
              type="button"
              className="btn btn-icon"
              aria-label="More actions"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="3.5" cy="8" r="1.3" fill="currentColor" /><circle cx="8" cy="8" r="1.3" fill="currentColor" /><circle cx="12.5" cy="8" r="1.3" fill="currentColor" /></svg>
            </button>
            {open && (
              <div className="menu" role="menu" ref={menuRef} onKeyDown={onMenuKey}>
                <button type="button" role="menuitem" onClick={run(onReset)}>Reset appearance</button>
                {sourceUrl && <button type="button" role="menuitem" onClick={run(copy)}>Copy source URL</button>}
                <button type="button" role="menuitem" className="danger" onClick={run(onClear)}>Clear card</button>
              </div>
            )}
          </div>
        )}
        {exportControl && <div className="header-export">{exportControl}</div>}
      </div>
    </header>
  );
}
