import { useEffect } from 'react';

export default function Toast({ text, level = 'info', action, onClose, duration = 7000 }) {
  useEffect(() => {
    const t = setTimeout(onClose, action ? 10000 : duration);
    return () => clearTimeout(t);
  }, [text, action, duration, onClose]);

  return (
    <div className={`toast toast-${level}`}>
      <span>{text}</span>
      {action && (
        <button type="button" className="toast-action" onClick={action.run}>
          {action.label}
        </button>
      )}
      <button type="button" className="toast-close" onClick={onClose} aria-label="Dismiss">
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      </button>
    </div>
  );
}
