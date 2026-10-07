// Light or dark.
//
// The OS preference decides by default, and the app follows it live. The
// toolbar toggle overrides it, and the override is remembered. Choosing the
// theme the OS already asks for drops the override instead of storing it, so
// toggling twice is the way back to following the OS.
//
// The theme is a `dark` class on <html>, which Tailwind's dark: variant keys
// on (see index.css). index.html applies the same rule before first paint, so
// a dark page does not flash light while the bundle loads.

import { useState, useEffect, useLayoutEffect, useCallback } from 'react';

export const THEME_STORAGE_KEY = 'graphible-theme';
export const THEMES = { LIGHT: 'light', DARK: 'dark' };

const DARK_QUERY = '(prefers-color-scheme: dark)';

const isTheme = (value) => value === THEMES.LIGHT || value === THEMES.DARK;

export const readStoredTheme = () => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(saved) ? saved : null;
  } catch {
    return null;
  }
};

const writeStoredTheme = (theme) => {
  try {
    if (theme) {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } else {
      localStorage.removeItem(THEME_STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable in private windows; the theme still applies
    // for this session.
  }
};

const systemPrefersDark = () => {
  try {
    return window.matchMedia?.(DARK_QUERY).matches === true;
  } catch {
    return false;
  }
};

export const resolveTheme = (override, prefersDark) =>
  override ?? (prefersDark ? THEMES.DARK : THEMES.LIGHT);

// What to store after a toggle: the new theme, or null when it is what the OS
// asks for anyway.
export const nextOverride = (current, prefersDark) => {
  const next = current === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK;
  return next === resolveTheme(null, prefersDark) ? null : next;
};

export const useTheme = () => {
  const [override, setOverride] = useState(readStoredTheme);
  const [prefersDark, setPrefersDark] = useState(systemPrefersDark);

  useEffect(() => {
    const query = window.matchMedia?.(DARK_QUERY);
    if (!query) return undefined;

    const onChange = (event) => setPrefersDark(event.matches);
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);

  const theme = resolveTheme(override, prefersDark);

  // Layout effect, so the class lands in the same frame as the components that
  // read `theme` for their inline colors.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('dark', theme === THEMES.DARK);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    const stored = nextOverride(theme, prefersDark);
    writeStoredTheme(stored);
    setOverride(stored);
  }, [theme, prefersDark]);

  return { theme, isDark: theme === THEMES.DARK, toggleTheme };
};
