import { useSyncExternalStore } from "react";

/** Port of the Angular ThemeService: `theme` in localStorage, `app-dark-mode` class on <html>. */
const STORAGE_KEY = "theme";
const DARK_CLASS = "app-dark-mode";

let dark = false;
const listeners = new Set<() => void>();

function apply(): void {
  document.documentElement.classList.toggle(DARK_CLASS, dark);
}

export function initTheme(): void {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) dark = saved === "dark";
  } catch {
    // localStorage unavailable - stay on the light default.
  }
  apply();
}

export function isDark(): boolean {
  return dark;
}

export function toggleDarkMode(): void {
  dark = !dark;
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // ignore
  }
  apply();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useIsDark(): boolean {
  return useSyncExternalStore(subscribe, isDark, isDark);
}
