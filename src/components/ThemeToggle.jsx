import { useTheme } from '../lib/theme.js';

const ICONS = {
  system: <path d="M3 4.5h10v6.5H3zM6 13.5h4M8 11v2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />,
  light: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 1.8v1.4M8 12.8v1.4M1.8 8h1.4M12.8 8h1.4M3.6 3.6l1 1M11.4 11.4l1 1M3.6 12.4l1-1M11.4 4.6l1-1" />
    </g>
  ),
  dark: <path d="M13 9.6A5.5 5.5 0 0 1 6.4 3a5.5 5.5 0 1 0 6.6 6.6Z" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />,
};
const NEXT = { system: 'light', light: 'dark', dark: 'system' };
const LABEL = { system: 'System', light: 'Light', dark: 'Dark' };

/** Cycles System → Light → Dark. */
export default function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  return (
    <button
      type="button"
      className="btn btn-icon theme-toggle"
      onClick={() => setTheme(NEXT[theme])}
      aria-label={`Theme: ${LABEL[theme]}. Switch to ${LABEL[NEXT[theme]]}.`}
      title={`Theme: ${LABEL[theme]}`}
    >
      <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" key={theme} className="theme-icon">
        {ICONS[theme]}
      </svg>
    </button>
  );
}
