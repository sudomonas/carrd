import { useCallback, useEffect, useState } from 'react';

const KEY = 'carrd:theme';
export const THEMES = ['system', 'light', 'dark'];

function read() {
  try {
    const t = localStorage.getItem(KEY);
    return THEMES.includes(t) ? t : 'system';
  } catch {
    return 'system';
  }
}

/** Theme preference: 'system' follows prefers-color-scheme; others force it. */
export function useTheme() {
  const [theme, setThemeState] = useState(read);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') delete root.dataset.theme;
    else root.dataset.theme = theme;
    try {
      if (theme === 'system') localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      /* preference just won't persist */
    }
  }, [theme]);
  const setTheme = useCallback((t) => setThemeState(THEMES.includes(t) ? t : 'system'), []);
  return [theme, setTheme];
}
