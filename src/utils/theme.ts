import { ThemePreference } from '../types/finance';

export const THEME_STORAGE_KEY = 'keuangan_theme';

export function getStoredThemePreference(): ThemePreference {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') {
      return raw;
    }
  } catch {
    // Ignore storage read errors
  }
  return 'light';
}

export function resolveIsDark(pref: ThemePreference): boolean {
  if (pref === 'dark') return true;
  if (pref === 'light') return false;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return false;
}

export function applyThemeToDocument(pref: ThemePreference): boolean {
  const isDark = resolveIsDark(pref);
  if (typeof document !== 'undefined') {
    document.documentElement.classList.toggle('dark', isDark);
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', isDark ? '#0b1110' : '#0f766e');
    }
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Ignore storage write errors
  }
  return isDark;
}
