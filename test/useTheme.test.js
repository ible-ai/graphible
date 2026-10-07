import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useTheme,
  resolveTheme,
  nextOverride,
  readStoredTheme,
  THEME_STORAGE_KEY,
} from '../src/hooks/useTheme';

// jsdom has no matchMedia. This stands in for the OS preference and lets a
// test flip it the way a user changing their system theme would.
const mockSystemTheme = (dark) => {
  const listeners = new Set();
  const query = {
    matches: dark,
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
  };
  window.matchMedia = vi.fn(() => query);
  return {
    set(next) {
      query.matches = next;
      listeners.forEach((fn) => fn({ matches: next }));
    },
  };
};

afterEach(() => {
  delete window.matchMedia;
  document.documentElement.classList.remove('dark');
});

describe('resolveTheme', () => {
  it('follows the OS when nothing is stored', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
  });

  it('lets a stored choice override the OS', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('nextOverride', () => {
  it('stores the opposite of the OS theme', () => {
    expect(nextOverride('light', false)).toBe('dark');
    expect(nextOverride('dark', true)).toBe('light');
  });

  it('stores nothing when toggling back to what the OS asks for', () => {
    expect(nextOverride('dark', false)).toBeNull();
    expect(nextOverride('light', true)).toBeNull();
  });
});

describe('readStoredTheme', () => {
  it('ignores values it did not write', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'sepia');
    expect(readStoredTheme()).toBeNull();
  });

  it('survives storage that throws', () => {
    const spy = vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    expect(readStoredTheme()).toBeNull();
    spy.mockRestore();
  });
});

describe('useTheme', () => {
  it('defaults to light without matchMedia', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('applies the OS dark preference to <html>', () => {
    mockSystemTheme(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('follows the OS live while there is no override', () => {
    const system = mockSystemTheme(false);
    const { result } = renderHook(() => useTheme());
    act(() => system.set(true));
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists a toggle and keeps it when the OS changes', () => {
    const system = mockSystemTheme(false);
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    act(() => system.set(false));
    expect(result.current.theme).toBe('dark');
  });

  it('toggling back to the OS theme clears the override', () => {
    mockSystemTheme(false);
    const { result } = renderHook(() => useTheme());

    act(() => result.current.toggleTheme());
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
  });

  it('still toggles when storage refuses writes', () => {
    mockSystemTheme(false);
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { result } = renderHook(() => useTheme());
    act(() => result.current.toggleTheme());
    expect(result.current.theme).toBe('dark');
    spy.mockRestore();
  });
});
